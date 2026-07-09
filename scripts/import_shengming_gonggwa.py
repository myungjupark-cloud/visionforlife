#!/usr/bin/env python3
"""생명공과 정리 텍스트 → VisionforLife 카탈로그·과정·mindmap.json"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"C:\Projects\kgbr-text-tools\라이프스터디단행본\20260709_생명공과_전체_p1-351_정리.txt")

CATALOG_SLUG = "life-study"
COURSE_SLUG = "shengming-gonggwa"
LESSON_RE = re.compile(r"^제\s*(\d+)\s*과\s+(.+)$")


def parse_lessons(text: str) -> tuple[str, list[tuple[int, str, str]]]:
    intro_parts: list[str] = []
    lessons: list[tuple[int, str, str]] = []
    current_num: int | None = None
    current_title = ""
    current_lines: list[str] = []

    def flush():
        nonlocal current_num, current_title, current_lines
        if current_num is not None:
            body = "\n".join(current_lines).strip()
            lessons.append((current_num, current_title, body))
        current_num = None
        current_title = ""
        current_lines = []

    for line in text.splitlines():
        m = LESSON_RE.match(line.strip())
        if m:
            flush()
            current_num = int(m.group(1))
            current_title = m.group(2).strip()
            continue
        if current_num is None:
            if line.strip() in ("차례",) or re.match(r"^\d+\.\s", line.strip()):
                continue
            if line.strip():
                intro_parts.append(line.strip())
        else:
            current_lines.append(line)

    flush()
    lessons.sort(key=lambda x: x[0])
    intro = "\n\n".join(intro_parts).strip()
    return intro, lessons


def build_mindmap(intro: str, lessons: list[tuple[int, str, str]]) -> dict:
    now = datetime.now(timezone.utc).astimezone().isoformat()
    nodes = [
        {
            "id": "root",
            "title": "생명공과",
            "description": (
                "새로 믿은 이들을 위한 48과 공과입니다. 아래에서 **제1과**부터 순서대로 공부하세요.\n\n"
                + (f"## 설명과 교통\n\n{intro}" if intro else "")
            ).strip(),
            "scripture": "",
            "x": 0,
            "y": 0,
        }
    ]
    edges: list[dict] = []

    prev_id: str | None = None
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
        if prev_id:
            edges.append({"id": f"e-seq-{prev_id}-{nid}", "from": prev_id, "to": nid, "type": "cross"})
        prev_id = nid

    return {
        "version": 2,
        "courseSlug": COURSE_SLUG,
        "catalogSlug": CATALOG_SLUG,
        "rootId": "root",
        "meta": {
            "title": "생명공과",
            "subtitle": "Witness Lee · 개정 2판",
            "catalogSlug": CATALOG_SLUG,
            "updatedAt": now,
        },
        "nodes": nodes,
        "edges": edges,
    }


def main() -> int:
    if not SRC.is_file():
        print(f"소스 없음: {SRC}", file=sys.stderr)
        return 1

    intro, lessons = parse_lessons(SRC.read_text(encoding="utf-8"))
    if len(lessons) != 48:
        print(f"경고: 과 {len(lessons)}개 (48 예상)", file=sys.stderr)

    sys.path.insert(0, str(ROOT))
    import courses as c

    catalogs = c.load_catalogs_index()
    if not c.catalog_meta(CATALOG_SLUG):
        catalogs["catalogs"].append(
            {
                "slug": CATALOG_SLUG,
                "title": "생명공과",
                "description": "새로 믿은 이들의 가정·집회를 위한 48과 공과",
                "order": max([int(x.get("order") or 0) for x in catalogs.get("catalogs", [])] + [0]) + 1,
            }
        )
        c.save_catalogs_index(catalogs)
        c.save_catalog_courses(CATALOG_SLUG, {"version": 1, "catalogSlug": CATALOG_SLUG, "courses": []})

    if c.course_slug_available(COURSE_SLUG):
        c.create_course(
            CATALOG_SLUG,
            COURSE_SLUG,
            "생명공과",
            subtitle="Witness Lee · 개정 2판 · 48과",
            description="제1과부터 순서대로 공부하세요.",
        )
    else:
        c.update_course(
            CATALOG_SLUG,
            COURSE_SLUG,
            "생명공과",
            subtitle="Witness Lee · 개정 2판 · 48과",
            description="제1과부터 순서대로 공부하세요.",
        )

    mindmap = build_mindmap(intro, lessons)
    c.save_mindmap(COURSE_SLUG, mindmap)
    print(f"[OK] 카탈로그={CATALOG_SLUG} 과정={COURSE_SLUG} 노드={len(mindmap['nodes'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
