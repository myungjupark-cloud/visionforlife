#!/usr/bin/env python3
"""생명공과 요약 문장 끝을 평서형(~다)으로 통일 (로컬 Ollama)."""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "courses" / "shengming-gonggwa"
SRC_JSON = OUT_DIR / "lesson-summaries.json"
OUT_MD = OUT_DIR / "lesson-summaries.md"
OUT_JSON = OUT_DIR / "lesson-summaries.json"
PROGRESS = OUT_DIR / "lesson-summaries.tone.progress.json"

SYSTEM = """당신은 한국어 문체 교정기입니다.
규칙:
1. 각 줄의 **문장 끝마침만** 존댓말이 아닌 평서형으로 바꿉니다. (예: ~합니다→~한다, ~입니다→~이다, ~습니다→알맞은 ~다/~는다/~다)
2. 의미·순서·불릿(- )·줄 수는 유지합니다.
3. 본문 중간에 있는 호칭·경어 어간은 꼭 필요할 때만 자연스럽게 맞추되, 내용을 바꾸거나 문장을 추가·삭제하지 마세요.
4. 출력은 변환된 요약 본문만. 제목·설명·코드블록 금지."""

POLITE_RE = re.compile(r"(습니다|입니다|십니다)")


def load_config() -> dict:
    path = ROOT / "config.local.json"
    if not path.is_file():
        path = ROOT / "config.example.json"
    return json.loads(path.read_text(encoding="utf-8"))


def needs_convert(text: str) -> bool:
    return bool(POLITE_RE.search(text or ""))


def rule_based(text: str) -> str:
    """고빈도 어미 우선 치환 (빠르고 일관적)."""
    lines = []
    for raw in text.splitlines():
        line = raw
        # 긴 패턴부터
        reps = [
            ("하셨습니다", "하셨다"),
            ("했습니다", "했다"),
            ("었습니다", "었다"),
            ("았습니다", "았다"),
            ("였습니다", "였다"),
            ("셨습니다", "셨다"),
            ("하십니다", "하신다"),
            ("주십니다", "주신다"),
            ("이십니다", "이다"),
            ("것입니다", "것이다"),
            ("것입니다", "것이다"),
            ("입니다", "이다"),
            ("합니다", "한다"),
            ("됩니다", "된다"),
            ("집니다", "진다"),
            ("립니다", "린다"),
            ("깁니다", "긴다"),
            ("킵니다", "킨다"),
            ("줍니다", "준다"),
            ("납니다", "난다"),
            ("있습니다", "있다"),
            ("없습니다", "없다"),
            ("같습니다", "같다"),
            ("많습니다", "많다"),
            ("좋습니다", "좋다"),
            ("얻습니다", "얻는다"),
            ("받습니다", "받는다"),
            ("믿습니다", "믿는다"),
            ("삼습니다", "삼는다"),
            ("찾습니다", "찾는다"),
            ("넣습니다", "넣는다"),
            ("읽습니다", "읽는다"),
            ("죽습니다", "죽는다"),
            ("삽니다", "산다"),
            ("압니다", "안다"),
            ("갑니다", "간다"),
            ("옵니다", "온다"),
            ("봅니다", "본다"),
            ("섭니다", "선다"),
            ("눕니다", "눕는다"),
            ("씁니다", "쓴다"),
            ("입니다", "이다"),
            ("습니다", "다"),  # 남은 습니다만 최후
        ]
        for a, b in reps:
            line = line.replace(a, b)
        lines.append(line)
    return "\n".join(lines)


def ask_ollama(model: str, base_url: str, text: str) -> str:
    payload = {
        "model": model,
        "stream": False,
        "think": False,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": "다음 요약의 문장 끝만 평서형(~다)으로 바꿔 주세요.\n\n" + text,
            },
        ],
        "options": {"temperature": 0.1, "num_predict": 900, "num_ctx": 8192},
    }
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        data = json.loads(res.read().decode("utf-8"))
    msg = data.get("message") or {}
    out = str(msg.get("content") or "").strip()
    if not out:
        out = str(msg.get("thinking") or "").strip()
    if not out:
        raise RuntimeError("empty response")
    # strip accidental fences/titles
    lines = []
    for line in out.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        if not s:
            continue
        if s.startswith("```"):
            continue
        if re.match(r"^#{1,3}\s*", s):
            continue
        if re.match(r"^제\s*\d+\s*과", s):
            continue
        lines.append(line.rstrip())
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


def save_all(items: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"lessons": items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MD.write_text(render_md(items), encoding="utf-8")
    PROGRESS.write_text(
        json.dumps({"lessons": items, "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    data = json.loads(SRC_JSON.read_text(encoding="utf-8"))
    lessons = list(data.get("lessons") or [])
    cfg = load_config()
    ollama = cfg.get("ollama") or {}
    base_url = str(ollama.get("baseUrl", "http://127.0.0.1:11434"))
    model = str(ollama.get("model", "gemma4:12b"))

    # 1) 규칙 기반 1차
    for item in lessons:
        item["summary"] = rule_based(item.get("summary") or "")

    left = [it for it in lessons if needs_convert(it.get("summary") or "")]
    print(f"규칙 적용 후 남은 존댓말 과: {len(left)} / {len(lessons)}")

    # 2) 남은 것만 로컬 AI
    for item in lessons:
        text = item.get("summary") or ""
        if not needs_convert(text):
            continue
        print(f"AI 교정 제{item['num']}과 …", flush=True)
        try:
            converted = ask_ollama(model, base_url, text)
            # 안전: AI가 줄여 버리면 규칙본 유지 + 재시도 없이 rule만
            if converted and len(converted) >= max(20, int(len(text) * 0.5)):
                item["summary"] = rule_based(converted)
            else:
                print(f"  skip weak AI output, keep rule-based")
        except Exception as exc:
            print(f"  AI 실패, 규칙본 유지: {exc}")
        save_all(lessons)

    # 최종 규칙 한 번 더
    for item in lessons:
        item["summary"] = rule_based(item.get("summary") or "")
    save_all(lessons)

    left2 = sum(1 for it in lessons if needs_convert(it.get("summary") or ""))
    polite = sum(len(POLITE_RE.findall(it.get("summary") or "")) for it in lessons)
    print(f"완료. 남은 존댓말 토큰 수≈{polite}, 남은 과={left2}")
    print(OUT_MD)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
