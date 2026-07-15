#!/usr/bin/env python3
"""천지창조/*.txt → 비공개 카탈로그 genesis / 과정 1 (제1~10과)

큰 본문은 Agent로 열지 말고 이 스크립트로만 반영하세요.
  python scripts/import_cheonji_chapters.py
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_SLUG = "genesis"
COURSE_SLUG = "1"
COURSE_TITLE = "천지창조"
SUBTITLE = "당신은 이 전시관의 관람객인가, 주인공인가?"
DESCRIPTION = (
    "많은 사람들이 하나님에 대한 이해가 부족하고 사람의 존재에 대한 이해가 부족하여 "
    "인생의 목표도 잘 모르고 세상의 흐름을 따라 떠돌아 다니듯 살아갑니다. "
    "정상적으로 보이는 이 세상이 사실은 사람들이 하나님을 잊고 살아가도록 만든 "
    "세상의 풍조와 유행과 문화이고, 이를 따라 사는 것이 얼마나 값어치 없는지 이해가 될겁니다."
)

# H2 오타 보정 (원본 ## 제목)
TITLE_FIXES = {
    "율법에 담인 증언": "율법에 담긴 증언",
}


def find_src_dir() -> Path:
    preferred = ROOT / "천지창조"
    if preferred.is_dir() and list(preferred.glob("01_*.txt")):
        return preferred
    for p in ROOT.iterdir():
        if p.is_dir() and list(p.glob("01_*.txt")):
            return p
    raise FileNotFoundError("천지창조 폴더(01_*.txt)를 찾지 못했습니다.")


def parse_file(path: Path, num: int) -> tuple[str, str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    i = 0
    while i < len(lines) and (not lines[i].strip() or lines[i].lstrip().startswith("#")):
        i += 1
    body = "\n".join(lines[i:]).strip()

    title: str | None = None
    for ln in lines:
        m = re.match(r"^##\s+(.+)$", ln.strip())
        if m:
            title = m.group(1).strip()
            break
    if not title:
        for ln in lines:
            m = re.match(r"^#\s*\d+\.\s*(.+?)(?:\s*[—\-–]\s*.+)?$", ln.strip())
            if m:
                title = m.group(1).strip()
                break
    if not title:
        title = f"{num}과"

    title = TITLE_FIXES.get(title, title)
    title = re.split(r"\s*[—\-–]\s*", title, maxsplit=1)[0].strip()

    for wrong, right in TITLE_FIXES.items():
        body = body.replace(f"## {wrong}", f"## {right}", 1)

    return title, body


def build_mindmap(lessons: list[tuple[int, str, str]]) -> dict:
    now = datetime.now(timezone.utc).astimezone().isoformat()
    nodes: list[dict] = [
        {
            "id": "root",
            "title": COURSE_TITLE,
            "description": (
                "창조의 목적과 과정을 이해하면 하나님과 인류에 대해 많은 것을 알 수 있습니다.\n\n"
                "아래에서 **제1과**부터 순서대로 공부하세요."
            ),
            "scripture": "",
            "x": 0,
            "y": 0,
        }
    ]
    edges: list[dict] = []
    prev: str | None = None
    for num, title, body in lessons:
        nid = f"lesson-{num:02d}"
        nodes.append(
            {
                "id": nid,
                "title": f"제{num}과 {title}",
                "description": body,
                "scripture": "",
                "x": 0,
                "y": 0,
            }
        )
        edges.append({"id": f"e-root-{nid}", "from": "root", "to": nid, "type": "hierarchy"})
        if prev:
            edges.append({"id": f"e-seq-{prev}-{nid}", "from": prev, "to": nid, "type": "cross"})
        prev = nid

    return {
        "version": 2,
        "courseSlug": COURSE_SLUG,
        "catalogSlug": CATALOG_SLUG,
        "rootId": "root",
        "meta": {
            "title": COURSE_TITLE,
            "subtitle": SUBTITLE,
            "catalogSlug": CATALOG_SLUG,
            "layout": "linear",
            "updatedAt": now,
        },
        "nodes": nodes,
        "edges": edges,
    }


def main() -> int:
    srcdir = find_src_dir()
    files = sorted(srcdir.glob("*.txt"))
    if len(files) < 1:
        print(f"소스 없음: {srcdir}", file=sys.stderr)
        return 1

    lessons: list[tuple[int, str, str]] = []
    for idx, f in enumerate(files, 1):
        title, body = parse_file(f, idx)
        lessons.append((idx, title, body))
        print(f"{idx:02d} {title} ({len(body)} chars)")

    sys.path.insert(0, str(ROOT))
    import courses as c

    if not c.catalog_meta(CATALOG_SLUG):
        print(f"카탈로그 없음: {CATALOG_SLUG}", file=sys.stderr)
        return 1

    if c.course_slug_available(COURSE_SLUG):
        c.create_course(
            CATALOG_SLUG,
            COURSE_SLUG,
            COURSE_TITLE,
            subtitle=SUBTITLE,
            description=DESCRIPTION,
        )
    else:
        c.update_course(
            CATALOG_SLUG,
            COURSE_SLUG,
            COURSE_TITLE,
            subtitle=SUBTITLE,
            description=DESCRIPTION,
        )

    mindmap = build_mindmap(lessons)
    path = c.save_mindmap(COURSE_SLUG, mindmap)
    print(f"[OK] 카탈로그={CATALOG_SLUG} 과정={COURSE_SLUG} 노드={len(mindmap['nodes'])} → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
