#!/usr/bin/env python3
"""생명공과 1–48과 로컬 Ollama 요약 → markdown 저장."""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from import_shengming_gonggwa import SRC, parse_lessons  # noqa: E402

OUT_DIR = ROOT / "data" / "courses" / "shengming-gonggwa"
OUT_MD = OUT_DIR / "lesson-summaries.md"
OUT_JSON = OUT_DIR / "lesson-summaries.json"
PROGRESS = OUT_DIR / "lesson-summaries.progress.json"

SYSTEM = """당신은 성경 교육 교재를 요약하는 편집자입니다.
주어진 공과 본문만 근거로 핵심을 요약하세요.
규칙:
- 한국어로 작성
- 최대 10줄 (가능하면 5~8줄)
- 각 줄은 한 문장 또는 짧은 불릿
- 과장·추측·본문에 없는 내용 금지
- 마크다운 제목(#)은 쓰지 말 것 (본문 요약만)
- 불릿을 쓰면 "- "로 시작"""


def load_config() -> dict:
    path = ROOT / "config.local.json"
    if not path.is_file():
        path = ROOT / "config.example.json"
    return json.loads(path.read_text(encoding="utf-8"))


def ask_summary(model: str, base_url: str, title: str, body: str, cfg: dict) -> str:
    ollama = cfg.get("ollama") or {}
    options = {
        "temperature": 0.25,
        "num_predict": 800,
        "num_ctx": int(ollama.get("numCtx") or ollama.get("num_ctx") or 16384),
    }
    text = body.strip()
    if len(text) > 12000:
        text = text[:12000] + "\n\n…(이하 생략)"

    user = (
        f"공과 제목: {title}\n\n"
        f"=== 본문 ===\n{text}\n\n"
        "위 본문을 최대 10줄로 요약해 주세요. 제목 줄은 넣지 마세요."
    )
    payload = {
        "model": model,
        "stream": False,
        "think": False,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "options": options,
    }
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as res:
        data = json.loads(res.read().decode("utf-8"))
    msg = data.get("message") or {}
    content = str(msg.get("content") or "").strip()
    if not content:
        # gemma thinking 모드 잔여 대비
        content = str(msg.get("thinking") or "").strip()
    if not content:
        raise RuntimeError("empty ollama response")
    return clean_summary(content)


def clean_summary(text: str) -> str:
    lines = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        # 모델이 제목을 다시 쓴 경우 제거
        if re.match(r"^#{1,3}\s*", line):
            continue
        if re.match(r"^제\s*\d+\s*과", line):
            continue
        lines.append(line)
        if len(lines) >= 10:
            break
    return "\n".join(lines).strip()


def render_md(items: list[dict]) -> str:
    parts = [
        "# 생명공과 과별 요약",
        "",
        "로컬 AI로 정리한 1–48과 요약입니다. 각 과 설명 앞에 붙이거나 참고용으로 쓰세요.",
        "",
    ]
    for item in sorted(items, key=lambda x: x["num"]):
        parts.append(f"## 제{item['num']}과 {item['title']}")
        parts.append("")
        parts.append(item["summary"])
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def load_progress() -> dict[int, dict]:
    if not PROGRESS.is_file():
        return {}
    raw = json.loads(PROGRESS.read_text(encoding="utf-8"))
    out: dict[int, dict] = {}
    for item in raw.get("lessons") or []:
        out[int(item["num"])] = item
    return out


def save_progress(by_num: dict[int, dict]) -> None:
    items = [by_num[k] for k in sorted(by_num)]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PROGRESS.write_text(
        json.dumps({"lessons": items, "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    OUT_JSON.write_text(
        json.dumps({"lessons": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUT_MD.write_text(render_md(items), encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if not SRC.is_file():
        print("원본 없음:", SRC)
        return 1

    cfg = load_config()
    ollama = cfg.get("ollama") or {}
    base_url = str(ollama.get("baseUrl", "http://127.0.0.1:11434"))
    model = str(ollama.get("model", "gemma4:12b"))

    # health
    try:
        with urllib.request.urlopen(f"{base_url.rstrip('/')}/api/tags", timeout=5) as res:
            res.read()
    except Exception as exc:
        print("Ollama 연결 실패:", base_url, exc)
        return 1

    intro, lessons = parse_lessons(SRC.read_text(encoding="utf-8"))
    print(f"과 수: {len(lessons)}, model={model}")
    by_num = load_progress()
    print(f"이미 완료: {len(by_num)}")

    for num, title, body in lessons:
        if num in by_num and by_num[num].get("summary"):
            print(f"skip 제{num}과")
            continue
        heading = f"제{num}과 {title}"
        print(f"요약 중… {heading} ({len(body)}자)", flush=True)
        t0 = time.time()
        try:
            summary = ask_summary(model, base_url, heading, body, cfg)
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            print(f"실패 제{num}과: {exc}")
            save_progress(by_num)
            return 2
        by_num[num] = {
            "num": num,
            "title": title,
            "summary": summary,
            "seconds": round(time.time() - t0, 1),
        }
        save_progress(by_num)
        print(f"  OK {by_num[num]['seconds']}s, {len(summary.splitlines())}줄 → {OUT_MD.name}", flush=True)

    save_progress(by_num)
    print("완료:", OUT_MD)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
