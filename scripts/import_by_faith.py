#!/usr/bin/env python3
"""믿음으로_말미암아_살리라_p6-120.truthlib.txt → 학습주제(카탈로그)·과정·mindmap.json

장(1–12)을 과(제1과–제12과)로 매핑합니다.
  python scripts/import_by_faith.py
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "믿음으로_말미암아_살리라_p6-120.truthlib.txt"

CATALOG_SLUG = "by-faith"
COURSE_SLUG = "by-faith"
COURSE_TITLE = "믿음으로 말미암아 살리라"
SUBTITLE = "워치만 니 · 12과"
DESCRIPTION = (
    "# 믿음으로 말미암아 살리라 — 의미와 목표\n\n"
    "1. 그리스도인의 정상 생활이 **믿음으로 사는 생활**임을 분명히 합니다.\n"
    "2. 율법·의지·옳고 그름이 아닌, 그리스도의 생명이 우리를 살게 하시는 길을 배웁니다.\n"
    "3. 얕은 생활에서 깊은 생활로, 외면적 신앙에서 내면적 신앙으로 들어가도록 인도합니다.\n"
    "4. 제단과 장막, 세월을 아끼는 삶까지 — 믿음의 원칙을 일상에서 적용합니다.\n\n"
    "아래에서 **제1과**부터 순서대로 공부하세요."
)

CHAPTER_RE = re.compile(r"^(\d+)장\s+(.+)$")
NUM_SUB_RE = re.compile(r"^\((\d+)\)\s*(.+)$")
NUM_DOT_RE = re.compile(r"^(\d+)\.\s+(.+)$")
SCRIPTURE_RE = re.compile(
    r"^(?:"
    r"창|출|레|민|신|수|삿|룻|삼상|삼하|왕상|왕하|대상|대하|스|느|에|욥|시|잠|전|아|"
    r"사|렘|애|겔|단|호|욜|암|옵|욘|미|나|합|습|학|슥|말|"
    r"마|막|눅|요|행|롬|고전|고후|갈|엡|빌|골|살전|살후|딤전|딤후|딛|몬|히|약|벧전|벧후|요일|요이|요삼|유|계"
    r"|로마서|마태복음|마가복음|누가복음|요한복음|사도행전|고린도전서|고린도후서|갈라디아서|에베소서|빌립보서|"
    r"골로새서|데살로니가전서|데살로니가후서|디모데전서|디모데후서|히브리서|요한계시록"
    r")\s*\d+"
)
VERSE_END_RE = re.compile(
    r"(?:니라|로다|이라|하니라|하시니라|하시니|하리라|있으리라|없느니라|것이라|말이로다|"
    r"하였느니라|말씀하시니라|하시더라|하였더라|이로구나|말라|들으라|주오|좋으리)\.?$"
)

TITLE_FIXES = {
    "그리스도인의 생활 원칙성경": "그리스도인의 생활 원칙 — 성경",
}

PROSE_END_RE = re.compile(
    r"(?:다\.|요\.|까\.|네\.|다|요|까|네|죠|다!|요!|"
    r"하였다|했다|한다|된다|있다|없다|것이다|말이다)\.?$"
)
QUESTION_TITLE_RE = re.compile(r"(?:인가|는가|것인가|있는가|무엇인가|하는가|될까|일까)\??$")


def parse_chapters(text: str) -> list[tuple[int, str, str]]:
    chapters: list[tuple[int, str, str]] = []
    current_num: int | None = None
    current_title = ""
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_num, current_title, current_lines
        if current_num is not None:
            body = "\n".join(current_lines).strip()
            title = TITLE_FIXES.get(current_title, current_title)
            chapters.append((current_num, title, body))
        current_num = None
        current_title = ""
        current_lines = []

    for line in text.splitlines():
        m = CHAPTER_RE.match(line.strip())
        if m:
            flush()
            current_num = int(m.group(1))
            current_title = m.group(2).strip()
            continue
        if current_num is None:
            continue
        current_lines.append(line)

    flush()
    chapters.sort(key=lambda x: x[0])
    return chapters


def _is_scripture_ref(s: str) -> bool:
    return bool(SCRIPTURE_RE.match(s)) and len(s) < 48 and not s.endswith(("다.", "다", "요."))


def _is_bible_verse(s: str) -> bool:
    if len(s) < 10:
        return False
    if VERSE_END_RE.search(s):
        return True
    if re.search(r"(하라|할지니라|말하노니|가로되|이르시되)", s) and len(s) < 120:
        return True
    return False


def _is_heading_candidate(s: str, *, next_long: bool) -> bool:
    if len(s) > 44 or len(s) < 3:
        return False
    if s.startswith(("…", "...", "(", "기도", "아,", "오,")):
        return False
    if _is_scripture_ref(s) or _is_bible_verse(s):
        return False
    if s.endswith(("!", "…", ",", "，", ";", ":")):
        return False
    if QUESTION_TITLE_RE.search(s):
        return True
    if NUM_DOT_RE.match(s):
        return True
    if PROSE_END_RE.search(s) or VERSE_END_RE.search(s):
        return False
    if not next_long:
        return False
    if len(s) <= 10 and " " not in s and "—" not in s and "–" not in s and "-" not in s:
        return False
    return True


def _looks_like_poem_line(s: str) -> bool:
    if len(s) >= 40:
        return False
    if _is_scripture_ref(s) or NUM_SUB_RE.match(s) or NUM_DOT_RE.match(s):
        return False
    if QUESTION_TITLE_RE.search(s):
        return False
    if PROSE_END_RE.search(s) and len(s) > 28:
        return False
    return True


def _next_nonempty(lines: list[str], start: int) -> str:
    for j in range(start, len(lines)):
        t = lines[j].strip()
        if t:
            return t
    return ""


def format_body(raw: str) -> str:
    """원문 단락을 가독성 있는 마크다운으로 정리."""
    lines = raw.splitlines()
    out: list[str] = []
    i = 0
    after_ref = False
    in_poem = False

    while i < len(lines):
        s = lines[i].strip()
        i += 1

        if not s:
            in_poem = False
            # after_ref는 유지 — 참조와 구절 사이 빈 줄이 흔함
            if out and out[-1] != "":
                out.append("")
            continue

        if "시가 있다" in s:
            out.append(s)
            out.append("")
            in_poem = True
            continue

        if in_poem:
            out.append(f"> {s}")
            continue

        if s.startswith("(") and s.endswith(")") and len(s) < 60:
            if out and out[-1] != "":
                out.append("")
            out.append(f"*{s}*")
            out.append("")
            continue

        sub = NUM_SUB_RE.match(s)
        if sub:
            after_ref = False
            if out and out[-1] != "":
                out.append("")
            out.append(f"### ({sub.group(1)}) {sub.group(2).strip()}")
            out.append("")
            continue

        if _is_scripture_ref(s):
            if out and out[-1] != "":
                out.append("")
            out.append(f"**{s}**")
            out.append("")
            after_ref = True
            continue

        if after_ref:
            out.append(f"> {s}")
            out.append("")
            after_ref = False
            continue

        nxt = _next_nonempty(lines, i)
        next_long = len(nxt) >= 48

        if NUM_DOT_RE.match(s) and len(s) < 55:
            if out and out[-1] != "":
                out.append("")
            out.append(f"## {s}")
            out.append("")
            continue

        # 시 블록: 짧은 행 3줄 이상 연속
        if _looks_like_poem_line(s) and nxt and _looks_like_poem_line(nxt) and not next_long:
            poem = [s]
            while i < len(lines):
                peek = lines[i].strip()
                if not peek:
                    break
                if not _looks_like_poem_line(peek):
                    break
                poem.append(peek)
                i += 1
            if len(poem) >= 3:
                if out and out[-1] != "":
                    out.append("")
                for pl in poem:
                    out.append(f"> {pl}")
                out.append("")
                continue
            out.append(s)
            continue

        if _is_heading_candidate(s, next_long=next_long):
            if out and out[-1] != "":
                out.append("")
            out.append(f"## {s}")
            out.append("")
            continue

        out.append(s)

    cleaned: list[str] = []
    blank = 0
    for line in out:
        if line == "":
            blank += 1
            if blank <= 1:
                cleaned.append("")
        else:
            blank = 0
            cleaned.append(line)

    text = "\n".join(cleaned).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def build_mindmap(lessons: list[tuple[int, str, str]]) -> dict:
    now = datetime.now(timezone.utc).astimezone().isoformat()
    nodes: list[dict] = [
        {
            "id": "root",
            "title": COURSE_TITLE,
            "description": DESCRIPTION,
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
        # 생명공과와 동일: root→1과→2과… 연쇄 (과 끝에서 「다음 과」 표시)
        if prev is None:
            edges.append({"id": f"e-root-{nid}", "from": "root", "to": nid, "type": "hierarchy"})
        else:
            edges.append({"id": f"e-{prev}-{nid}", "from": prev, "to": nid, "type": "hierarchy"})
        prev = nid

    return {
        "version": 2,
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
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    if not SRC.is_file():
        print(f"소스 없음: {SRC}", file=sys.stderr)
        return 1

    chapters = parse_chapters(SRC.read_text(encoding="utf-8"))
    if len(chapters) != 12:
        print(f"경고: 장 {len(chapters)}개 (12 예상)", file=sys.stderr)

    lessons: list[tuple[int, str, str]] = []
    for num, title, raw in chapters:
        body = format_body(raw)
        lessons.append((num, title, body))
        print(f"{num:02d} 제{num}과 {title} ({len(body)} chars)")

    sys.path.insert(0, str(ROOT))
    import courses as c

    catalogs = c.load_catalogs_index()
    if not c.catalog_meta(CATALOG_SLUG):
        catalogs["catalogs"].append(
            {
                "slug": CATALOG_SLUG,
                "title": COURSE_TITLE,
                "description": "믿음으로 사는 그리스도인의 정상 생활 — 12과",
                "order": 5,
                "visibility": "public",
                "published": True,
            }
        )
        c.save_catalogs_index(catalogs)
        c.save_catalog_courses(
            CATALOG_SLUG,
            {"version": 1, "catalogSlug": CATALOG_SLUG, "courses": []},
        )
        print(f"[OK] 카탈로그 생성: {CATALOG_SLUG}")

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
    c.save_mindmap(COURSE_SLUG, mindmap)
    print(f"[OK] 카탈로그={CATALOG_SLUG} 과정={COURSE_SLUG} 노드={len(mindmap['nodes'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
