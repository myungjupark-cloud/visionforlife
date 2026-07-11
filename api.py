#!/usr/bin/env python3

"""정적 파일 + 마인드맵 운영자 API 서버."""



from __future__ import annotations



import json

import os

import re

import socket

import sqlite3

import subprocess

import threading

import urllib.error

import urllib.request

from datetime import datetime, timezone

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from urllib.parse import parse_qs, urlparse



from rag_search import search_topic, search_topic_fts_only

try:
    from deploy_thegospel import deploy_mindmap_after_save, deploy_to_thegospel
except ImportError:
    def deploy_mindmap_after_save():
        return {"ok": False, "skipped": True, "reason": "deploy module not installed"}

    def deploy_to_thegospel(files=None):
        return {"ok": False, "skipped": True, "reason": "deploy module not installed"}

from auth_store import (
    ROLE_LEARNER,
    ROLE_OPERATOR,
    STATUS_ACTIVE,
    STATUS_DISABLED,
    get_all_progress_summary,
    get_course_progress,
    get_unread_operator_message,
    init_db,
    list_users,
    login_user,
    logout_user,
    mark_operator_message_read,
    register_user,
    set_user_role,
    set_user_status,
    update_user_goals,
    update_user_name,
    upsert_operator_message,
    upsert_progress,
    user_from_token,
)
from courses import (
    catalog_meta,
    create_catalog,
    create_course,
    find_catalog_for_course,
    is_valid_slug,
    learnable_node_ids,
    list_all_courses,
    list_catalog_slugs,
    load_catalog_courses,
    load_catalogs_index,
    load_mindmap,
    save_mindmap,
    sync_catalog_from_mindmap,
    update_catalog,
    update_course,
)



ROOT = os.path.dirname(os.path.abspath(__file__))

DEFAULT_COURSE = ""

MINDMAP_PATH = os.path.join(ROOT, "data", "courses", DEFAULT_COURSE, "mindmap.json")

CONFIG_PATH = os.path.join(ROOT, "config.local.json")

CONFIG_EXAMPLE = os.path.join(ROOT, "config.example.json")

DEFAULT_SEARCH_DB = os.path.join(os.path.dirname(ROOT), "bible-qna", "search.db")

SIBLING_TOPIC_MAP_CONFIG = os.path.join(os.path.dirname(ROOT), "bible-topic-map", "config.local.json")
BIBLE_QNA_API_PHP = os.path.join(os.path.dirname(ROOT), "bible-qna", "_RAG빌드", "구축스크립트", "api.php")

PORT = int(os.environ.get("PORT", "8780"))





def load_config() -> dict:

    path = CONFIG_PATH if os.path.isfile(CONFIG_PATH) else CONFIG_EXAMPLE

    try:

        with open(path, encoding="utf-8") as f:

            return json.load(f)

    except (OSError, json.JSONDecodeError):

        return {"adminPin": "4464572"}





def read_json_body(handler: SimpleHTTPRequestHandler) -> dict:

    length = int(handler.headers.get("Content-Length", 0))

    raw = handler.rfile.read(length) if length else b"{}"

    return json.loads(raw.decode("utf-8") or "{}")





def send_json(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    handler.send_response(status)

    handler.send_header("Content-Type", "application/json; charset=utf-8")

    handler.send_header("Content-Length", str(len(body)))

    handler.end_headers()

    handler.wfile.write(body)


SESSION_COOKIE = "vfl_session"


def session_token_from_handler(handler: SimpleHTTPRequestHandler) -> str | None:
    cookie = handler.headers.get("Cookie") or ""
    for part in cookie.split(";"):
        part = part.strip()
        if part.startswith(SESSION_COOKIE + "="):
            return part.split("=", 1)[1].strip()
    hdr = (handler.headers.get("X-VFL-Session") or "").strip()
    if hdr:
        return hdr
    query = parse_qs(urlparse(handler.path).query)
    q = str((query.get("vfl_token") or [""])[0]).strip()
    if q:
        return q
    auth = (handler.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def set_session_cookie(handler: SimpleHTTPRequestHandler, token: str, max_age: int = 30 * 24 * 3600) -> None:
    handler.send_header(
        "Set-Cookie",
        f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}",
    )


def clear_session_cookie(handler: SimpleHTTPRequestHandler) -> None:
    handler.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0")


def send_json_with_cookies(
    handler: SimpleHTTPRequestHandler,
    status: int,
    payload: dict,
    cookies: list[str] | None = None,
) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    if cookies:
        for c in cookies:
            handler.send_header("Set-Cookie", c)
    handler.end_headers()
    handler.wfile.write(body)





def progress_percent_for_slug(slug: str, summary: dict) -> int:
    try:
        data = load_mindmap(slug)
        total = len(learnable_node_ids(data))
        if total <= 0:
            return 0
        visited = int(summary.get("visitedCount") or 0)
        return min(100, round(visited * 100 / total))
    except (FileNotFoundError, OSError, json.JSONDecodeError, KeyError, TypeError):
        return 0


def course_progress_payload(slug: str, summary: dict) -> dict:
    return {
        "percent": progress_percent_for_slug(slug, summary),
        "lastNodeId": summary.get("lastNodeId"),
        "visitedCount": int(summary.get("visitedCount") or 0),
        "completedCount": int(summary.get("completedCount") or 0),
        "nodes": summary.get("nodes") or {},
    }


def admin_pin_required() -> bool:
    return bool(load_config().get("adminPinRequired", True))


def verify_admin_pin(data: dict, handler: SimpleHTTPRequestHandler | None = None) -> bool:
    if not admin_pin_required():
        return True
    if handler and _is_localhost(handler):
        return True
    pin = str(data.get("pin", "")).strip()
    expected = str(load_config().get("adminPin", "4464572")).strip()
    return pin == expected


def _is_localhost(handler: SimpleHTTPRequestHandler) -> bool:
    host = (handler.headers.get("Host") or "").split(":")[0].lower()
    if host in ("localhost", "127.0.0.1"):
        return True
    # Private LAN / Tailscale — local operator PC only
    if re.fullmatch(r"192\.168\.\d{1,3}\.\d{1,3}", host):
        return True
    if re.fullmatch(r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}", host):
        return True
    if re.fullmatch(r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}", host):
        return True
    if re.fullmatch(r"100\.\d{1,3}\.\d{1,3}\.\d{1,3}", host):
        return True
    return False


def admin_pin_ok(handler: SimpleHTTPRequestHandler, pin: str) -> bool:
    if not admin_pin_required():
        return True
    if _is_localhost(handler):
        return True
    expected = str(load_config().get("adminPin", "4464572")).strip()
    return str(pin or "").strip() == expected


def current_user(handler: SimpleHTTPRequestHandler) -> dict | None:
    return user_from_token(session_token_from_handler(handler))


def is_main_admin(handler: SimpleHTTPRequestHandler, pin: str = "") -> bool:
    return admin_pin_ok(handler, pin)


def is_operator_user(user: dict | None) -> bool:
    return bool(user and user.get("role") == ROLE_OPERATOR and user.get("status") == STATUS_ACTIVE)


def require_main_admin(handler: SimpleHTTPRequestHandler, data: dict | None = None, pin: str = "") -> bool:
    data = data or {}
    pin_value = str(pin or data.get("pin") or "").strip()
    return is_main_admin(handler, pin_value)


def require_pin_or_operator(
    handler: SimpleHTTPRequestHandler,
    data: dict | None = None,
    pin: str = "",
) -> tuple[bool, dict | None]:
    """Returns (allowed, operator_user_or_None). Main admin (PIN) or role=operator."""
    data = data or {}
    pin_value = str(pin or data.get("pin") or "").strip()
    if is_main_admin(handler, pin_value):
        return True, None
    user = current_user(handler)
    if is_operator_user(user):
        return True, user
    return False, None


def resolve_course_slug(raw: str | None) -> str:
    slug = (raw or "").strip()
    if not slug:
        cfg = load_config()
        slug = str(cfg.get("defaultCourse") or "").strip()
    if not slug:
        raise ValueError("invalid course slug")
    if not is_valid_slug(slug):
        raise ValueError("invalid course slug")
    return slug


def resolve_search_db(cfg: dict) -> str:

    path = str(cfg.get("searchDb") or cfg.get("search_db") or "").strip()

    if path and os.path.isfile(path):

        return os.path.abspath(path)

    if os.path.isfile(DEFAULT_SEARCH_DB):

        return os.path.abspath(DEFAULT_SEARCH_DB)

    return ""





def resolve_voyage_key(cfg: dict) -> str:

    key = str(cfg.get("voyage_key") or cfg.get("voyageKey") or "").strip()

    if key:

        return key

    key = os.environ.get("VOYAGE_API_KEY", "").strip()

    if key:

        return key

    if os.path.isfile(SIBLING_TOPIC_MAP_CONFIG):

        try:

            with open(SIBLING_TOPIC_MAP_CONFIG, encoding="utf-8") as f:

                sibling = json.load(f)

            key = str(sibling.get("voyage_key") or sibling.get("voyageKey") or "").strip()

            if key:

                return key

        except (OSError, json.JSONDecodeError, TypeError):

            pass

    if os.path.isfile(BIBLE_QNA_API_PHP):

        try:

            with open(BIBLE_QNA_API_PHP, encoding="utf-8") as f:

                src = f.read()

            m = re.search(r"\$VOYAGE_KEY\s*=\s*'([^']+)'", src)

            if m and m.group(1).strip():

                return m.group(1).strip()

        except OSError:

            pass

    return ""





def build_search_query(question: str, context: str = "") -> str:

    parts = [p.strip() for p in (context, question) if p and p.strip()]

    return " ".join(parts)





def build_rag_context(chunks: list[dict]) -> str:

    parts: list[str] = []

    for chunk in chunks[:8]:

        ref = chunk.get("ref") or ""

        src = chunk.get("source") or ""

        text = str(chunk.get("text") or "")[:1200]

        parts.append(f"({src} · {ref})\n{text}")

    return "\n\n".join(parts)





def rag_sources(chunks: list[dict]) -> list[dict]:

    out: list[dict] = []

    for chunk in chunks[:8]:

        out.append({

            "source": chunk.get("source") or "",

            "ref": chunk.get("ref") or "",

        })

    return out





def search_rag_chunks(question: str, context: str, cfg: dict) -> tuple[list[dict], str]:

    db_path = resolve_search_db(cfg)

    if not db_path:

        return [], "no_db"



    query = build_search_query(question, context)

    voyage_key = resolve_voyage_key(cfg)

    try:

        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)

        try:

            if voyage_key:

                chunks = search_topic(conn, query, voyage_key, topk=8)

                mode = "voyage" if chunks else "empty"

            else:

                chunks = search_topic_fts_only(conn, query, topk=8)

                mode = "fts_only" if chunks else "empty"

        finally:

            conn.close()

        return chunks, mode

    except (sqlite3.Error, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, KeyError, ValueError) as exc:

        print(f"[RAG] search failed: {exc}")

        return [], "error"





def rag_system_prompt() -> str:

    return (

        "깊이 있고 읽기 쉬운 전문. "

        "당신은 회복역·라이프스터디·워치만 니·위트니스 리 등 주님의 회복 자료에 정통하고 깊이 있는 전문가입니다. "

        "질문자의 질문 목적을 잘 이해하고 답하세요. "

        "장중하고 깊이 있는 문장으로 답하세요. "

        "아래 [검색 자료]만 근거로 답하되, 답변 본문에는 출처 번호·각주·인용 표기를 넣지 마세요. "

        "[1], [2] 같은 번호, 「관련 근거」 열, 「출처」 열, 각주, 링크 형식 인용을 절대 쓰지 마세요. "

        "표를 쓸 때도 내용 열만 두고 근거·출처 열은 만들지 마세요. "

        "자료에 없는 내용은 추측하지 말고, "

        "「제공된 자료에서 명확히 확인되지 않습니다」라고 말하세요. "

        "한국어로 명확하고 따뜻하게 답하세요. "

        "아래 마크다운 형식으로 구체화해 답하세요. "

        "소제목은 ## 💡 제목 또는 ### 제목 형식을 사용하세요. "

        "비교·정리가 필요하면 마크다운 표(| 열1 | 열2 |)를 사용하세요. "

        "목록은 - 항목 형식, 섹션 구분은 --- 한 줄을 사용하세요. "

        "굵게는 꼭 필요할 때만 쓰고, 이모지(💡 ✨ 🙏 📖 등)는 적당히 사용하세요."

    )





def model_only_system_prompt() -> str:

    return (

        "당신은 성경과 기독교 신앙에 정통한 조력자입니다. "

        "외부 자료·search.db 없이, 모델이 학습한 성경 이해와 신학 지식만으로 답하세요. "

        "성경 구절을 자연스럽게 인용해도 되나 [1] 같은 번호·각주·「관련 근거」 열은 넣지 마세요. "

        "한국어로 명확하고 따뜻하게 답하세요. "

        "아래 마크다운 형식으로 구조화해 답하세요. "

        "소제목은 ## 💡 제목 또는 ### 제목 형식을 사용하세요. "

        "비교·정리가 필요하면 마크다운 표(| 열1 | 열2 |)를 사용하세요. "

        "목록은 - 항목 형식, 섹션 구분은 --- 한 줄을 사용하세요. "

        "**굵게**는 꼭 필요할 때만 쓰고, 이모지(💡 ✨ 🙏 📖 등)는 적당히 사용하세요."

    )





def plain_system_prompt() -> str:

    return model_only_system_prompt()





def clean_ai_answer(text: str) -> str:

    if not text:

        return text

    text = re.sub(r"\s*\[\d+\]", "", text)

    lines = text.splitlines()

    out: list[str] = []

    drop_last_col = False

    for line in lines:

        stripped = line.strip()

        if "|" not in stripped:

            drop_last_col = False

            out.append(line)

            continue

        cells = [c.strip() for c in stripped.strip("|").split("|")]

        if not cells:

            out.append(line)

            continue

        if any(re.search(r"관련\s*근거|^출처$", c) for c in cells):

            drop_last_col = True

            if len(cells) > 1:

                out.append("| " + " | ".join(cells[:-1]) + " |")

            continue

        if drop_last_col and len(cells) > 1:

            out.append("| " + " | ".join(cells[:-1]) + " |")

            continue

        out.append(line)

    return "\n".join(out).strip()





def model_only_disclaimer(rag_mode: str) -> str:

    if rag_mode == "no_db":

        reason = "search.db를 찾을 수 없어"

    elif rag_mode == "error":

        reason = "search.db 검색 중 오류가 발생하여"

    else:

        reason = "search.db에서 관련 자료를 찾지 못해"

    return (

        f"> ⚠️ **{reason}** 아래 답변은 로컬 AI 모델의 일반 지식으로 작성되었습니다. "

        "자료 기반 답변이 아닐 수 있으니 확인이 필요합니다.\n\n---\n\n"

    )





def ollama_options(cfg: dict) -> dict:

    ollama = cfg.get("ollama") or {}

    num_predict = int(ollama.get("numPredict") or ollama.get("num_predict") or 4096)

    num_ctx = int(ollama.get("numCtx") or ollama.get("num_ctx") or 16384)

    temperature = float(ollama.get("temperature") or 0.35)

    return {

        "num_predict": max(1024, num_predict),

        "num_ctx": max(8192, num_ctx),

        "temperature": temperature,

    }





def ollama_chat_payload(model: str, system: str, user: str, cfg: dict) -> dict:

    body: dict = {

        "model": model,

        "messages": [

            {"role": "system", "content": system},

            {"role": "user", "content": user},

        ],

        "stream": False,

        "options": ollama_options(cfg),

    }

    if "gemma" in model.lower():

        body["think"] = False

    return body





def length_limit_notice() -> str:

    return (

        "\n\n---\n\n"

        "> ⚠️ **답변이 길이 제한에 도달해 여기서 잘렸을 수 있습니다.** "

        "같은 주제를 나눠서 다시 질문해 보세요."

    )





def rag_preflight_error(rag_mode: str) -> dict:

    if rag_mode == "no_db":

        msg = "RAG 실패 — search.db를 찾을 수 없습니다. 로컬 AI로 전환하지 않았습니다."

    elif rag_mode == "error":

        msg = "RAG 실패 — search.db 검색 중 오류가 발생했습니다. 로컬 AI로 전환하지 않았습니다."

    else:

        msg = "RAG 실패 — search.db에서 관련 자료를 찾지 못했습니다. 로컬 AI로 전환하지 않았습니다."

    return {

        "ok": False,

        "error": msg,

        "askMode": "rag",

        "rag": {"mode": rag_mode, "sourceCount": 0, "sources": []},

    }





def ai_fail(ask_mode: str, error: str, rag_mode: str = "", source_count: int = 0) -> dict:

    payload: dict = {"ok": False, "error": error, "askMode": ask_mode}

    if ask_mode == "model":

        payload["rag"] = {"mode": "chosen_model_only", "sourceCount": 0, "sources": []}

    else:

        payload["rag"] = {

            "mode": rag_mode or "failed",

            "sourceCount": source_count,

            "sources": [],

        }

    return payload





def ask_ollama(

    question: str,

    context: str = "",

    chunks: list[dict] | None = None,

    rag_mode: str = "",

    ask_mode: str = "rag",

) -> dict:

    question = str(question or "").strip()

    if not question:

        return ai_fail(ask_mode, "질문이 비어 있습니다")



    cfg = load_config()

    ollama = cfg.get("ollama") or {}

    base_url = str(ollama.get("baseUrl", "http://127.0.0.1:11434")).rstrip("/")

    model = str(ollama.get("model", "gemma4:12b"))

    chunks = chunks or []

    is_model = ask_mode == "model" or rag_mode == "chosen_model_only"

    if is_model:

        system = model_only_system_prompt()

    else:

        system = rag_system_prompt()



    user_parts: list[str] = []

    if context:

        user_parts.append(f"맥락: {context}")

    if not is_model:

        if chunks:

            user_parts.append("=== 검색 자료 ===\n" + build_rag_context(chunks))

        else:

            return rag_preflight_error(rag_mode or "empty")

    user_parts.append(f"질문: {question}")

    user = "\n\n".join(user_parts)



    payload = json.dumps(ollama_chat_payload(model, system, user, cfg)).encode("utf-8")



    req = urllib.request.Request(

        f"{base_url}/api/chat",

        data=payload,

        headers={"Content-Type": "application/json"},

        method="POST",

    )

    try:

        with urllib.request.urlopen(req, timeout=300) as res:

            data = json.loads(res.read().decode("utf-8"))

    except urllib.error.HTTPError as exc:

        detail = exc.read().decode("utf-8", errors="replace")

        return ai_fail(

            ask_mode,

            f"{'로컬 AI' if is_model else 'RAG'} 실패 — Ollama 오류 ({exc.code}). {'RAG' if is_model else '로컬 AI'}로 전환하지 않았습니다.",

            rag_mode=rag_mode,

        )

    except urllib.error.URLError as exc:

        label = "로컬 AI" if is_model else "RAG"

        other = "RAG" if is_model else "로컬 AI"

        return ai_fail(

            ask_mode,

            f"{label} 실패 — Ollama에 연결할 수 없습니다. {other}로 전환하지 않았습니다.",

            rag_mode=rag_mode,

        )

    except TimeoutError:

        label = "로컬 AI" if is_model else "RAG"

        other = "RAG" if is_model else "로컬 AI"

        return ai_fail(

            ask_mode,

            f"{label} 실패 — 응답 시간이 초과되었습니다. {other}로 전환하지 않았습니다.",

            rag_mode=rag_mode,

        )



    message = data.get("message") or {}

    answer = clean_ai_answer(str(message.get("content", "")).strip())

    if not answer:

        label = "로컬 AI" if is_model else "RAG"

        other = "RAG" if is_model else "로컬 AI"

        return ai_fail(

            ask_mode,

            f"{label} 실패 — 빈 응답이 반환되었습니다. {other}로 전환하지 않았습니다.",

            rag_mode=rag_mode,

        )



    done_reason = str(data.get("done_reason") or "")

    if done_reason == "length":

        answer += length_limit_notice()



    resolved_ask_mode = "model" if is_model else "rag"

    result = {

        "ok": True,

        "answer": answer,

        "model": model,

        "doneReason": done_reason or "stop",

        "askMode": resolved_ask_mode,

    }

    if is_model:

        result["rag"] = {"mode": "chosen_model_only", "sourceCount": 0, "sources": []}

    else:

        result["rag"] = {

            "mode": rag_mode,

            "sourceCount": len(chunks),

            "sources": rag_sources(chunks),

        }

    return result





def ask_with_rag(question: str, context: str = "") -> dict:

    cfg = load_config()

    chunks, rag_mode = search_rag_chunks(question, context, cfg)

    if not chunks:

        return rag_preflight_error(rag_mode)

    return ask_ollama(question, context, chunks=chunks, rag_mode=rag_mode)





def ask_ai(question: str, context: str = "", mode: str = "rag") -> dict:

    question = str(question or "").strip()

    if not question:

        resolved = "model" if str(mode or "rag").strip().lower() in ("model", "local", "model_only", "ollama") else "rag"

        return ai_fail(resolved, "질문이 비어 있습니다")

    mode = str(mode or "rag").strip().lower()

    if mode in ("model", "local", "model_only", "ollama"):

        return ask_ollama(question, context, chunks=[], rag_mode="chosen_model_only", ask_mode="model")

    chunks, rag_mode = search_rag_chunks(question, context, load_config())

    if not chunks:

        return rag_preflight_error(rag_mode)

    return ask_ollama(question, context, chunks=chunks, rag_mode=rag_mode, ask_mode="rag")





def is_tailscale_ip(ip: str) -> bool:

    parts = ip.split(".")

    if len(parts) != 4:

        return False

    try:

        first, second = int(parts[0]), int(parts[1])

    except ValueError:

        return False

    return first == 100 and 64 <= second <= 127





def cors_origins(cfg: dict) -> list[str]:

    remote = cfg.get("remoteAccess") or {}

    origins = remote.get("corsOrigins") or []

    if isinstance(origins, str):

        origins = [origins]

    return [str(o).strip() for o in origins if str(o).strip()]





def is_local_dev_origin(origin: str) -> bool:
    """Allow browser previews / Live Server talking to local api.py."""
    try:
        u = urlparse(origin)
    except Exception:
        return False
    if u.scheme not in ("http", "https"):
        return False
    host = (u.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return True
    # private LAN (phone testing against PC serve.bat)
    parts = host.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        a, b = int(parts[0]), int(parts[1])
        if a == 10 or a == 192 and b == 168 or a == 172 and 16 <= b <= 31:
            return True
    return False





def auto_deploy_on_save(cfg: dict) -> bool:

    remote = cfg.get("remoteAccess") or {}

    if "autoDeployOnSave" in remote:

        return bool(remote.get("autoDeployOnSave"))

    return True





def _deploy_mindmap_background() -> None:

    try:

        result = deploy_mindmap_after_save()

        if result.get("ok"):

            files = ", ".join(result.get("files") or [])

            print(f"[deploy] OK thegospel.kr ({files})")

        else:

            print(f"[deploy] failed: {result.get('error')}")

    except Exception as exc:

        print(f"[deploy] error: {exc}")





class VisionforLifeHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):

        super().__init__(*args, directory=ROOT, **kwargs)



    def _maybe_send_cors(self) -> None:

        origin = self.headers.get("Origin", "").strip()

        if not origin:

            return

        allowed = origin in cors_origins(load_config()) or is_local_dev_origin(origin)

        if allowed:

            self.send_header("Access-Control-Allow-Origin", origin)

            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")

            self.send_header("Access-Control-Allow-Headers", "Content-Type")

            self.send_header("Access-Control-Allow-Credentials", "true")

            self.send_header("Vary", "Origin")



    def end_headers(self) -> None:

        path = urlparse(self.path).path

        if path.startswith("/api/"):

            self._maybe_send_cors()

        if path.endswith((".html", ".js", ".css")) or path in ("/", ""):

            self.send_header("Cache-Control", "no-cache, must-revalidate")

        super().end_headers()



    def do_OPTIONS(self) -> None:

        path = urlparse(self.path).path

        if path.startswith("/api/"):

            self.send_response(204)

            self.end_headers()

            return

        self.send_error(404)



    def do_GET(self) -> None:

        path = urlparse(self.path).path

        if path in ("/config.local.json", "/config.local.json/"):

            self.send_error(404)

            return

        if path == "/api/health":

            cfg = load_config()

            db_path = resolve_search_db(cfg)

            voyage_key = resolve_voyage_key(cfg)

            send_json(self, 200, {

                "ok": True,

                "service": "visionforlife",

                "rag": {

                    "searchDb": db_path or None,

                    "searchDbReady": bool(db_path),

                    "voyageKeyReady": bool(voyage_key),

                },

            })

            return

        if path == "/api/hymn/titles":
            # Proxy hymn-app titles.json (avoids CORS when editing on localhost).
            try:
                req = urllib.request.Request(
                    "https://thegospel.kr/hymnapp/titles.json",
                    headers={"User-Agent": "VisionforLife/1.0", "Accept": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=20) as res:
                    titles = json.loads(res.read().decode("utf-8"))
                if not isinstance(titles, list):
                    raise ValueError("invalid titles payload")
                send_json(self, 200, {"ok": True, "titles": titles})
            except Exception as exc:
                send_json(self, 502, {"ok": False, "error": f"hymn titles unavailable: {exc}"})
            return

        if path == "/api/auth/me":
            token = session_token_from_handler(self)
            user = user_from_token(token)
            send_json(self, 200, {"ok": bool(user), "user": user})
            return

        if path == "/api/auth/notice":
            user = current_user(self)
            if not user:
                send_json(self, 401, {"ok": False, "error": "login required"})
                return
            notice = get_unread_operator_message(user["id"])
            send_json(self, 200, {"ok": True, "notice": notice})
            return

        if path == "/api/admin/users":
            query = parse_qs(urlparse(self.path).query)
            pin = str((query.get("pin") or [""])[0]).strip()
            allowed, op_user = require_pin_or_operator(self, pin=pin)
            if not allowed:
                send_json(self, 403, {"ok": False, "error": "admin or operator required"})
                return
            # Pure operator session (no PIN) must not get main-admin UI, even on localhost bypass.
            if op_user and not pin:
                is_main = False
            else:
                is_main = is_main_admin(self, pin)
            send_json(self, 200, {"ok": True, "users": list_users(), "isMainAdmin": is_main})
            return

        if path == "/api/admin/local-pin":
            if not _is_localhost(self):
                send_json(self, 403, {"ok": False, "error": "local only"})
                return
            pin = str(load_config().get("adminPin", "4464572")).strip()
            send_json(self, 200, {"ok": True, "pin": pin})
            return

        if path == "/api/catalogs":
            index = load_catalogs_index()
            send_json(self, 200, {"ok": True, "catalogs": index.get("catalogs", [])})
            return

        if path == "/api/courses":
            query = parse_qs(urlparse(self.path).query)
            catalog_slug = str((query.get("catalog") or [""])[0]).strip()
            token = session_token_from_handler(self)
            user = user_from_token(token)
            summaries = get_all_progress_summary(user["id"]) if user else {}

            if catalog_slug:
                if not catalog_meta(catalog_slug):
                    send_json(self, 404, {"ok": False, "error": "catalog not found"})
                    return
                course_items = load_catalog_courses(catalog_slug).get("courses", [])
            else:
                course_items = list_all_courses()

            courses_out = []
            for course in course_items:
                slug = str(course.get("slug", "")).strip()
                if not slug:
                    continue
                item = dict(course)
                if catalog_slug:
                    item["catalogSlug"] = catalog_slug
                summary = summaries.get(slug, {})
                if user or summary:
                    item["progress"] = course_progress_payload(slug, summary)
                else:
                    item["progress"] = None
                courses_out.append(item)
            send_json(self, 200, {"ok": True, "courses": courses_out, "catalog": catalog_slug or None})
            return

        if path == "/api/progress":
            query = parse_qs(urlparse(self.path).query)
            try:
                slug = resolve_course_slug((query.get("course") or [None])[0])
            except ValueError:
                send_json(self, 400, {"ok": False, "error": "invalid course"})
                return
            token = session_token_from_handler(self)
            user = user_from_token(token)
            if not user:
                send_json(self, 401, {"ok": False, "error": "login required"})
                return
            summary = get_course_progress(user["id"], slug)
            send_json(self, 200, {"ok": True, "course": slug, "progress": course_progress_payload(slug, summary)})
            return

        super().do_GET()



    def do_POST(self) -> None:

        path = urlparse(self.path).path

        if path == "/api/admin/verify":

            data = read_json_body(self)

            if not admin_pin_required():
                send_json(self, 200, {"ok": True})
                return

            if _is_localhost(self):
                send_json(self, 200, {"ok": True, "localBypass": True})
                return

            pin = str(data.get("pin", "")).strip()

            expected = str(load_config().get("adminPin", "4464572")).strip()

            send_json(self, 200, {"ok": pin == expected})

            return

        if path == "/api/admin/deploy":
            data = read_json_body(self)
            if not require_main_admin(self, data):
                send_json(self, 403, {"ok": False, "error": "main admin pin required"})
                return

            def _run_full_deploy() -> None:
                try:
                    result = deploy_to_thegospel()
                    if result.get("ok"):
                        files = ", ".join((result.get("files") or [])[:8])
                        print(f"[deploy] OK thegospel.kr ({files})")
                    else:
                        print(f"[deploy] failed: {result.get('error')}")
                except Exception as exc:
                    print(f"[deploy] error: {exc}")

            # Full FTP deploy can take several seconds — run in background, return immediately.
            threading.Thread(target=_run_full_deploy, daemon=True).start()
            send_json(self, 200, {
                "ok": True,
                "async": True,
                "url": "https://thegospel.kr/visionforlife/",
                "message": "thegospel.kr 배포 진행 중",
            })
            return



        if path == "/api/auth/register":
            data = read_json_body(self)
            try:
                phone = str(data.get("phone") or data.get("email") or "")
                user = register_user(
                    phone,
                    str(data.get("password", "")),
                    str(data.get("name", "")),
                )
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {
                "ok": True,
                "user": user,
                "pending": True,
                "message": "등록되었습니다. 운영자 승인 후 로그인할 수 있습니다.",
            })
            return

        if path == "/api/auth/login":
            data = read_json_body(self)
            try:
                phone = str(data.get("phone") or data.get("email") or "")
                user, token = login_user(phone, str(data.get("password", "")))
            except ValueError as exc:
                send_json(self, 401, {"ok": False, "error": str(exc)})
                return
            send_json_with_cookies(
                self,
                200,
                {"ok": True, "user": user, "token": token},
                [f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={30 * 24 * 3600}"],
            )
            return

        if path == "/api/auth/logout":
            logout_user(session_token_from_handler(self))
            send_json_with_cookies(self, 200, {"ok": True}, [f"{SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0"])
            return

        if path == "/api/auth/goals":
            token = session_token_from_handler(self)
            user = user_from_token(token)
            if not user:
                send_json(self, 401, {"ok": False, "error": "login required"})
                return
            data = read_json_body(self)
            try:
                updated = update_user_goals(user["id"], str(data.get("goals") or ""))
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "user": updated})
            return

        if path == "/api/auth/notice/read":
            user = current_user(self)
            if not user:
                send_json(self, 401, {"ok": False, "error": "login required"})
                return
            mark_operator_message_read(user["id"])
            send_json(self, 200, {"ok": True})
            return

        if path == "/api/admin/users/approve":
            data = read_json_body(self)
            allowed, _op = require_pin_or_operator(self, data)
            if not allowed:
                send_json(self, 403, {"ok": False, "error": "admin or operator required"})
                return
            try:
                user_id = int(data.get("userId") or data.get("id") or 0)
                updated = set_user_status(user_id, STATUS_ACTIVE)
            except (TypeError, ValueError) as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "user": updated})
            return

        if path == "/api/admin/users/disable":
            data = read_json_body(self)
            allowed, _op = require_pin_or_operator(self, data)
            if not allowed:
                send_json(self, 403, {"ok": False, "error": "admin or operator required"})
                return
            try:
                user_id = int(data.get("userId") or data.get("id") or 0)
                updated = set_user_status(user_id, STATUS_DISABLED)
            except (TypeError, ValueError) as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "user": updated})
            return

        if path == "/api/admin/users/set-role":
            data = read_json_body(self)
            if not require_main_admin(self, data):
                send_json(self, 403, {"ok": False, "error": "main admin pin required"})
                return
            try:
                user_id = int(data.get("userId") or data.get("id") or 0)
                role = str(data.get("role") or "").strip()
                if role not in (ROLE_LEARNER, ROLE_OPERATOR):
                    raise ValueError("role must be learner or operator")
                updated = set_user_role(user_id, role)
            except (TypeError, ValueError) as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "user": updated})
            return

        if path == "/api/admin/users/message":
            data = read_json_body(self)
            allowed, _op = require_pin_or_operator(self, data)
            if not allowed:
                send_json(self, 403, {"ok": False, "error": "admin or operator required"})
                return
            try:
                user_id = int(data.get("userId") or data.get("id") or 0)
                msg = upsert_operator_message(user_id, str(data.get("body") or data.get("message") or ""))
            except (TypeError, ValueError) as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "message": msg})
            return

        if path == "/api/admin/users/update-name":
            data = read_json_body(self)
            allowed, _op = require_pin_or_operator(self, data)
            if not allowed:
                send_json(self, 403, {"ok": False, "error": "admin or operator required"})
                return
            try:
                user_id = int(data.get("userId") or data.get("id") or 0)
                updated = update_user_name(user_id, str(data.get("name") or ""))
            except (TypeError, ValueError) as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "user": updated})
            return

        if path == "/api/catalogs":
            data = read_json_body(self)
            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return
            slug = str(data.get("slug") or "").strip()
            title = str(data.get("title") or "").strip()
            description = str(data.get("description") or "").strip()
            visibility = data.get("visibility")
            published = data.get("published")
            if not slug or not title:
                send_json(self, 400, {"ok": False, "error": "slug and title required"})
                return
            try:
                entry = create_catalog(
                    slug,
                    title,
                    description,
                    None if published is None else bool(published),
                    None if visibility is None else str(visibility),
                )
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "catalog": entry})
            return

        if path == "/api/courses":
            data = read_json_body(self)
            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return
            catalog_slug = str(data.get("catalogSlug") or data.get("catalog") or "").strip()
            slug = str(data.get("slug") or "").strip()
            title = str(data.get("title") or "").strip()
            subtitle = str(data.get("subtitle") or "").strip()
            description = str(data.get("description") or "").strip()
            if not catalog_slug:
                send_json(self, 400, {"ok": False, "error": "catalogSlug required"})
                return
            if not slug or not title:
                send_json(self, 400, {"ok": False, "error": "slug and title required"})
                return
            try:
                entry = create_course(catalog_slug, slug, title, subtitle, description)
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "course": entry})
            return

        if path == "/api/progress":
            token = session_token_from_handler(self)
            user = user_from_token(token)
            if not user:
                send_json(self, 401, {"ok": False, "error": "login required"})
                return
            data = read_json_body(self)
            try:
                slug = resolve_course_slug(str(data.get("courseSlug") or data.get("course") or ""))
            except ValueError:
                send_json(self, 400, {"ok": False, "error": "invalid course"})
                return
            node_id = str(data.get("nodeId") or data.get("node_id") or "").strip()
            if not node_id:
                send_json(self, 400, {"ok": False, "error": "nodeId required"})
                return
            status = str(data.get("status") or "visited").strip()
            upsert_progress(user["id"], slug, node_id, status)
            summary = get_course_progress(user["id"], slug)
            send_json(self, 200, {
                "ok": True,
                "course": slug,
                "progress": course_progress_payload(slug, summary),
            })
            return

        if path == "/api/mindmap":

            data = read_json_body(self)

            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return

            if not isinstance(data.get("nodes"), list) or not data.get("rootId"):

                send_json(self, 400, {"error": "invalid mindmap"})

                return

            try:
                slug = resolve_course_slug(str(data.get("courseSlug") or data.get("course_slug") or DEFAULT_COURSE))
            except ValueError:
                send_json(self, 400, {"error": "invalid course slug"})
                return

            meta = data.setdefault("meta", {})

            meta["updatedAt"] = datetime.now(timezone.utc).astimezone().isoformat()

            root_id = data.get("rootId")
            for node in data.get("nodes") or []:
                if node.get("id") == root_id:
                    root_title = str(node.get("title") or "").strip()
                    if root_title:
                        meta["title"] = root_title
                    break

            rel_path = f"data/courses/{slug}/mindmap.json"
            # Keep on-disk mindmap free of request-only fields.
            data.pop("courseSlug", None)
            data.pop("course_slug", None)
            data.pop("pin", None)
            save_mindmap(slug, data)
            catalog_synced = sync_catalog_from_mindmap(slug, data)

            payload: dict = {"ok": True, "path": rel_path, "courseSlug": slug, "catalogSynced": catalog_synced}

            cfg = load_config()

            if auto_deploy_on_save(cfg):

                threading.Thread(target=_deploy_mindmap_background, daemon=True).start()

                payload["deploy"] = {

                    "ok": True,

                    "async": True,

                    "message": "thegospel.kr 배포 진행 중",

                }

            else:

                payload["deploy"] = {"ok": False, "skipped": True, "reason": "autoDeployOnSave disabled"}

            send_json(self, 200, payload)

            return

        if path == "/api/course-image":
            import base64
            import time

            data = read_json_body(self)
            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return
            try:
                slug = resolve_course_slug(str(data.get("courseSlug") or data.get("course_slug") or ""))
            except ValueError:
                send_json(self, 400, {"error": "invalid course slug"})
                return
            raw_name = str(data.get("filename") or "image.png")
            ext = os.path.splitext(raw_name)[1].lower()
            allowed = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
            if ext not in allowed:
                send_json(self, 400, {"error": "unsupported image type"})
                return
            b64 = str(data.get("contentBase64") or data.get("content_base64") or "")
            if not b64:
                send_json(self, 400, {"error": "missing image data"})
                return
            try:
                binary = base64.b64decode(b64, validate=False)
            except Exception:
                send_json(self, 400, {"error": "invalid image data"})
                return
            if len(binary) > 4 * 1024 * 1024:
                send_json(self, 400, {"error": "image too large (max 4MB)"})
                return
            stem = os.path.splitext(os.path.basename(raw_name))[0]
            stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-._")[:40] or "image"
            saved_name = f"{int(time.time())}-{stem}{ext}"
            out_dir = os.path.join(ROOT, "data", "courses", slug, "images")
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, saved_name)
            with open(out_path, "wb") as f:
                f.write(binary)
            rel = f"data/courses/{slug}/images/{saved_name}"
            send_json(self, 200, {"ok": True, "path": rel, "filename": saved_name, "courseSlug": slug})
            return

        if path == "/api/ai/ask":

            data = read_json_body(self)

            result = ask_ai(

                str(data.get("question", "")),

                str(data.get("context", "")).strip(),

                str(data.get("mode", "rag")),

            )

            status = 200 if result.get("ok") else 502

            send_json(self, status, result)

            return



        self.send_error(404)



    def do_PATCH(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/catalogs":
            data = read_json_body(self)
            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return
            slug = str(data.get("slug") or "").strip()
            title = str(data.get("title") or "").strip()
            description = str(data.get("description") or "").strip()
            visibility = data.get("visibility", None)
            published = data.get("published", None)
            if not slug or not title:
                send_json(self, 400, {"ok": False, "error": "slug and title required"})
                return
            try:
                entry = update_catalog(
                    slug,
                    title,
                    description,
                    None if published is None else bool(published),
                    None if visibility is None else str(visibility),
                )
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "catalog": entry})
            return

        if path == "/api/courses":
            data = read_json_body(self)
            if not verify_admin_pin(data, self):
                send_json(self, 403, {"ok": False, "error": "admin pin required"})
                return
            catalog_slug = str(data.get("catalogSlug") or data.get("catalog") or "").strip()
            slug = str(data.get("slug") or "").strip()
            title = str(data.get("title") or "").strip()
            subtitle = str(data.get("subtitle") or "").strip()
            description = str(data.get("description") or "").strip()
            if not catalog_slug or not slug or not title:
                send_json(self, 400, {"ok": False, "error": "catalogSlug, slug and title required"})
                return
            try:
                entry = update_course(catalog_slug, slug, title, subtitle, description)
            except ValueError as exc:
                send_json(self, 400, {"ok": False, "error": str(exc)})
                return
            send_json(self, 200, {"ok": True, "course": entry})
            return

        self.send_error(404)



    def log_message(self, fmt: str, *args) -> None:

        print(f"[{self.log_date_time_string()}] {fmt % args}")





def lan_ip_addresses() -> list[str]:
    ips: list[str] = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
        if ip and ip not in ips:
            ips.append(ip)
    except OSError:
        pass
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


def tailscale_ip_addresses() -> list[str]:
    try:
        out = subprocess.run(
            ["tailscale", "ip", "-4"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if out.returncode == 0:
            ips = [line.strip() for line in out.stdout.splitlines() if line.strip()]
            if ips:
                return ips
    except (OSError, subprocess.TimeoutExpired):
        pass
    return [ip for ip in lan_ip_addresses() if is_tailscale_ip(ip)]


def remote_public_url(cfg: dict) -> str:
    remote = cfg.get("remoteAccess") or {}
    return str(remote.get("publicUrl") or "").strip()


def print_access_urls(port: int, cfg: dict | None = None) -> None:
    cfg = cfg or load_config()
    print(f"VisionforLife -> http://localhost:{port}/")
    print("  같은 Wi-Fi 폰에서 접속:")
    lan_ips = [ip for ip in lan_ip_addresses() if not is_tailscale_ip(ip)]
    if lan_ips:
        for ip in lan_ips:
            print(f"    http://{ip}:{port}/")
    else:
        print("    (PC IP를 찾지 못했습니다 — ipconfig 로 IPv4 확인)")
    ts_ips = tailscale_ip_addresses()
    print("  외출(LTE) - Tailscale (집 PC 켜진 상태):")
    if ts_ips:
        for ip in ts_ips:
            print(f"    http://{ip}:{port}/")
    else:
        print("    Tailscale 미연결 — setup-tailscale.bat 참고")
    public_url = remote_public_url(cfg)
    if public_url:
        print(f"  외출 - Cloudflare Tunnel: {public_url}")
    print("  폰에서 최신 내용: 운영자 저장 후 [새로고침] 버튼")
    print("  Wi-Fi 접속 안 되면 allow-phone.bat (관리자 1회)")
    print("  외출 설정: REMOTE-ACCESS.md · setup-tailscale.bat")
    print("  API: /api/auth/*, POST /api/admin/verify, POST /api/mindmap, POST /api/course-image, POST /api/ai/ask")


def main() -> None:

    init_db()

    cfg = load_config()

    db_path = resolve_search_db(cfg)

    voyage_key = resolve_voyage_key(cfg)

    server = ThreadingHTTPServer(("", PORT), VisionforLifeHandler)
    server.daemon_threads = True
    server.allow_reuse_address = True

    print_access_urls(PORT, cfg)

    print(f"  RAG: search.db={'OK ' + db_path if db_path else 'missing'}")

    print(f"  RAG: voyage={'OK' if voyage_key else 'missing (FTS only fallback)'}")

    print("  Ctrl+C to stop")

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        print("\nStopped.")





if __name__ == "__main__":

    main()

