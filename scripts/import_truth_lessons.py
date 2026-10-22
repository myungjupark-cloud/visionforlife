#!/usr/bin/env python3
"""진리공과(위트니스 리 《진리 공과》 1~4단계 16권) HWP → 진리서재 카탈로그·과정·mindmap.json

    python scripts/import_truth_lessons.py            # HWP 추출 + 변환 → data/
    python scripts/import_truth_lessons.py --stage D  # data/ 대신 D 폴더에 쓴다(검토용)

원본: E:\\내 드라이브\\권혁br 자료 정리\\회복\\진리 공과 01 02 03 04\\진리 공과 0L-0V*.hwp (권마다 하나)
추출: hwp5txt(pyhwp) → .cache/truth-lessons/*.txt
원칙(Bible QnA 경험): 짧은 줄을 버리지 않는다. 과 경계는 본문의 '제N과 제목' 머리표로 잡고
목차 줄(앞뒤가 다른 번호 머리표)은 뺀다. 과 제목은 목차·머리표 중 더 완전한 쪽 + 오타 교정.
오독 교정은 scripts/truth_lessons_fixes.py (사람이 승인한 것만).
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
HWP_DIR = Path(r"E:\내 드라이브\권혁br 자료 정리\회복\진리 공과 01 02 03 04")
HWP5TXT = Path(r"C:\Users\admin\AppData\Local\hermes\hermes-agent\venv\Scripts\hwp5txt.exe")
SRC = ROOT / ".cache" / "truth-lessons"
OUT = ROOT / "data"
if "--stage" in sys.argv:
    OUT = Path(sys.argv[sys.argv.index("--stage") + 1])

CATALOG_SLUG = "truth-lessons"
CATALOG_TITLE = "진리공과"

HEAD = re.compile(r"^\s*[제재]\s*0?(\d+)\s*과\s+(.+?)\s*$")
RUNNING = re.compile(r"^\s*\(\s*제\s*\d+\s*과[^)]*\)\s*$")
SECTION = {"개요": "개요", "본문": "본문", "요약": "요약", "요점": "요점", "질문": "질문"}
ROMAN = re.compile(r"^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)\.\s*(.+)$")
UPPER = re.compile(r"^([A-Z])\.\s*(.+)$")
NUM = re.compile(r"^(\d{1,2})\.\s*(.+)$")
LOWER = re.compile(r"^([a-z])\.\s*(.+)$")
PAREN = re.compile(r"^\((\d{1,2}|[a-z])\)\s*(.+)$")
SENT_END = re.compile(r"((니|습니|였|었|었습니|한|된|이)다|요|까)[.?!”\"’]*\s*$|[.?!]\s*$")
TERMINAL = re.compile(r"([.?!。…]|[”\"’')\]]|[다요죠까라음임함됨짐]\s*[.]?)$")

stats = {"joined": 0, "join_samples": [], "no_outline": [], "no_body": [], "empty": []}


# 원본(HWP)의 확실한 오타만 고친다. 전체 자료에서 맞는 꼴(신언자 594회 등)과 대조해 정했다.
FIXES = [
    ("창초", "창조"), ("잠일 하나님", "삼일 하나님"), ("잠얼 하나님", "삼일 하나님"), ("잠열성", "삼일성"),
    ("그라스도", "그리스도"), ("누렴", "누림"), ("제샤장", "제사장"), ("나살인", "나실인"), ("살아 았는", "살아 있는"),
    ("신성환 삼일성", "신성한 삼일성"), ("분매를", "분배를"), ("완전한 구권", "완전한 구원"), ("거치선", "거치신"),
    ("거치 신 삼일", "거치신 삼일"), ("이례", "이레"), ("선언자", "신언자"), ("세우신 연약", "세우신 언약"),
    ("짐승의 가축", "짐승의 가죽"), ("신약의주요", "신약의 주요"), ("주요관점", "주요 관점"), ("겉 옷", "겉옷"),
    ("휴거 01", "휴거 (1)"), ("휴거 02", "휴거 (2)"),
]
fix_count = {}


sys.path.insert(0, str(HERE))
import truth_lessons_fixes as tl_fixes  # noqa: E402  사람이 승인한 오독 교정표


def _tok(m):
    w = m.group(0)
    r = tl_fixes.TOKEN.get(w)
    if r and r != w:
        fix_count["@" + w] = fix_count.get("@" + w, 0) + 1
        return r
    return w


def fix_typos(s: str) -> str:
    for a, b in FIXES + tl_fixes.PHRASE:
        if a in s:
            fix_count[a] = fix_count.get(a, 0) + s.count(a)
            s = s.replace(a, b)
    return re.sub(r"[가-힣]+", _tok, s)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("－", "-").replace("–", "-")).strip()


def clean_title(s: str) -> str:
    s = fix_typos(norm(s))
    s = re.sub(r"\s*\.\s*$", "", s)                 # 끝의 ' .'
    s = re.sub(r"(\S)\(", r"\1 (", s)               # '관점(1)' → '관점 (1)'
    s = re.sub(r"\s*-\s*", " - ", s)                # 줄표 앞뒤 한 칸
    s = re.sub(r"(관점 \(\d+\)) (?!-)", r"\1 - ", s)  # '관점 (8) 새 예루살렘' → '관점 (8) - 새 예루살렘'
    return s.strip()


def compact(s: str) -> int:
    return len(re.sub(r"[\s\-().,]", "", s))


def outline_level(s: str) -> int | None:
    if ROMAN.match(s):
        return 1
    if UPPER.match(s):
        return 2
    if NUM.match(s):
        return 3
    if LOWER.match(s):
        return 4
    if PAREN.match(s):
        return 5
    return None


def split_lessons(lines: list[str]):
    """본문 머리표 위치 찾기: '제N과 제목' 다음 몇 줄 안에 개요/본문이 오는 곳(목차는 제외)."""
    def neighbor(i, step, reach=3):
        j = i + step
        while 0 <= j < len(lines) and abs(j - i) <= reach:
            s = lines[j].strip()
            if s and not RUNNING.match(s):
                return s
            j += step
        return ""

    starts = []
    seen = set()
    for i, l in enumerate(lines):
        m = HEAD.match(l)
        if not m:
            continue
        n = int(m.group(1))
        # 목차 줄: 앞이나 뒤가 '다른 번호'의 과 머리표
        is_toc = False
        for s in (neighbor(i, -1), neighbor(i, 1)):
            hm = HEAD.match(s)
            if hm and int(hm.group(1)) != n:
                is_toc = True
        if is_toc or n in seen:
            continue
        if starts and n < starts[-1][0]:
            continue
        seen.add(n)
        # 같은 과 머리표가 두 줄(짧은 것·긴 것)이면 더 긴 제목을 쓴다
        title = norm(m.group(2))
        nm = HEAD.match(neighbor(i, 1))
        if nm and int(nm.group(1)) == n and len(norm(nm.group(2))) > len(title):
            title = norm(nm.group(2))
        starts.append((n, title, i))
    # 목차 제목(본문 머리표보다 오타가 적다). 목차 줄 = 앞뒤가 다른 번호 머리표인 줄
    toc = {}
    for i, l in enumerate(lines):
        m = HEAD.match(l)
        if not m:
            continue
        n = int(m.group(1))
        for s in (neighbor(i, -1), neighbor(i, 1)):
            hm = HEAD.match(s)
            if hm and int(hm.group(1)) != n:
                toc.setdefault(n, norm(m.group(2)))
    fixed = []
    for n, title, i in starts:
        # 더 완전한 쪽(부제까지 있는 쪽)을 고르고, 같으면 본문 머리표를 쓴다. 오타는 교정표로 고친다.
        t = toc.get(n)
        b, c = clean_title(title), clean_title(t) if t else ""
        final = c if c and compact(c) > compact(b) + 2 else b
        if final != b:
            stats.setdefault("title_diff", []).append(f"제{n}과 '{b}' → '{final}'")
        fixed.append((n, final, i))
    starts = fixed
    out = []
    for k, (n, title, i) in enumerate(starts):
        j = starts[k + 1][2] if k + 1 < len(starts) else len(lines)
        out.append((n, title, lines[i + 1:j]))
    return out


def parse_sections(body: list[str]):
    # 표시별 조각을 순서대로 모은다. '개요' 표시 없이 바로 요점이 시작되는 과가 있다.
    segs = [["개요", []]]
    for raw in body:
        s = raw.strip()
        if HEAD.match(s) or RUNNING.match(s):
            continue
        if s in SECTION:
            segs.append([SECTION[s], []])
            continue
        segs[-1][1].append(raw.rstrip())
    segs = [sg for sg in segs if any(l.strip() for l in sg[1]) or sg[0] != "개요"]
    names = [n for n, _ in segs]
    # 원본 표시 실수 보정: 같은 표시가 두 번이면 첫째=개요, 둘째=본문
    if "본문" not in names and names.count("개요") >= 2:
        k = [i for i, n in enumerate(names) if n == "개요"][1]
        segs[k][0] = "본문"
        stats.setdefault("fixed", []).append("개요×2→개요+본문")
    elif "개요" not in names and names.count("본문") >= 2:
        k = names.index("본문")
        segs[k][0] = "개요"
        stats.setdefault("fixed", []).append("본문×2→개요+본문")
    sec = {}
    for n, ls in segs:
        sec.setdefault(n, []).extend(ls)
    return sec


def paragraphs(lines: list[str]) -> list[str]:
    """빈 줄로 나뉜 문단 대신, 원본은 줄 하나가 문단 하나다. 끊긴 문장만 잇는다."""
    items = [l.strip() for l in lines]
    out: list[str] = []
    pending_blank = False
    for s in items:
        if not s:
            pending_blank = True
            continue
        # 낱말 중간에서 끊긴 긴 줄만 잇는다(찬송 가사처럼 짧은 줄은 그대로 둔다)
        if (out and is_text(out[-1]) and is_text(s) and not TERMINAL.search(out[-1])
                and len(out[-1]) >= 60 and len(s) >= 30 and re.search(r"[가-힣]$", out[-1]) and re.match(r"[가-힣]", s)):
            # 문장이 끝나지 않은 채 끊긴 줄 → 이어 붙인다
            stats["joined"] += 1
            if len(stats["join_samples"]) < 25:
                stats["join_samples"].append((out[-1][-30:], s[:30]))
            out[-1] = out[-1] + ("" if out[-1].endswith(("-", "－")) else " ") + s
        else:
            out.append(s)
        pending_blank = False
    return out


def is_text(s: str) -> bool:
    return outline_level(s) is None and s not in SECTION


def md_outline(lines: list[str]) -> str:
    rows = []
    for s in (l.strip() for l in lines):
        if not s:
            continue
        lv = outline_level(s)
        if lv == 1:
            rows.append(f"**{s}**")
        elif lv:
            rows.append("　" * (lv - 1) + s)
        else:
            rows.append("　" * 2 + s)
    return "\n".join(rows)


def md_body(lines: list[str], outline_keys: set[str]) -> str:
    blocks = []
    for p in paragraphs(lines):
        lv = outline_level(p)
        key = norm(p)
        # 소제목은 '~함/~임' 같은 명사형으로 끝나고 짧다. '~다./~요.'로 끝나면 문장이다.
        is_head = lv is not None and (key in outline_keys or (len(p) < 80 and not SENT_END.search(p)))
        if is_head and lv == 1:
            blocks.append(f"### {p}")
        elif is_head:
            blocks.append(f"**{p}**")
        else:
            blocks.append(p)
    return "\n\n".join(blocks)


def md_plain(lines: list[str]) -> str:
    return "\n\n".join(paragraphs(lines))


def md_questions(lines: list[str]) -> str:
    return "\n".join(l.strip() for l in lines if l.strip())


def lesson_markdown(vol: str, n: int, title: str, body: list[str]) -> str:
    sec = parse_sections(body)
    parts = []
    outline = sec.get("개요", [])
    keys = {norm(l) for l in outline if l.strip()}
    if not any(l.strip() for l in outline):
        stats["no_outline"].append(f"{vol} 제{n}과")
    else:
        parts.append("## 개요\n\n" + md_outline(outline))
    if any(l.strip() for l in sec.get("본문", [])):
        parts.append("## 본문\n\n" + md_body(sec["본문"], keys))
    else:
        stats["no_body"].append(f"{vol} 제{n}과")
    for name in ("요약", "요점"):
        if any(l.strip() for l in sec.get(name, [])):
            parts.append(f"## {name}\n\n" + md_plain(sec[name]))
    if any(l.strip() for l in sec.get("질문", [])):
        parts.append("## 질문\n\n" + md_questions(sec["질문"]))
    text = fix_typos("\n\n".join(parts).strip())
    if len(text) < 300:
        stats["empty"].append(f"{vol} 제{n}과 ({len(text)}자)")
    return text


def extract_hwp():
    """권마다 HWP 하나(16권). 이미 뽑은 txt가 원본보다 새것이면 건너뛴다."""
    SRC.mkdir(parents=True, exist_ok=True)
    exe = str(HWP5TXT) if HWP5TXT.exists() else (shutil.which("hwp5txt") or "hwp5txt")
    for hwp in sorted(HWP_DIR.glob("진리 공과 0*.hwp")):
        txt = SRC / (hwp.stem + ".txt")
        if txt.exists() and txt.stat().st_mtime >= hwp.stat().st_mtime:
            continue
        subprocess.run([exe, "--output", str(txt), str(hwp)], check=True, stderr=subprocess.DEVNULL)
        print("extracted", hwp.name)


def add_catalog_entry():
    """data/catalogs.json 에 진리공과를 넣는다(이미 있으면 그대로). 비공개 카탈로그들 앞자리에."""
    p = OUT / "catalogs.json"
    if not p.exists():
        return
    idx = json.loads(p.read_text(encoding="utf-8"))
    cats = idx["catalogs"]
    if any(c.get("slug") == CATALOG_SLUG for c in cats):
        return
    shown = [int(c.get("order") or 0) for c in cats if (c.get("visibility") or "public") != "private"]
    order = (max(shown) if shown else 0) + 1
    for c in cats:
        if int(c.get("order") or 0) >= order:
            c["order"] = int(c["order"]) + 1
    cats.append({"slug": CATALOG_SLUG, "title": CATALOG_TITLE,
                 "description": "위트니스 리의 《진리 공과》 1~4단계 16권 · 220과 — 성경의 기본 진리를 단계별로",
                 "order": order, "visibility": "members", "published": True})
    cats.sort(key=lambda c: int(c.get("order") or 0))
    p.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print("catalog added at order", order)


def main():
    extract_hwp()
    OUT.mkdir(exist_ok=True)
    now = datetime.now(timezone.utc).astimezone().isoformat()
    courses = []
    total = 0
    for f in sorted(SRC.glob("진리 공과 0*.txt")):
        m = re.search(r"0(\d)-0(\d)", f.stem)
        lv, vol = int(m.group(1)), int(m.group(2))
        vkey = f"{lv}-{vol}"
        lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        lessons = split_lessons(lines)
        slug = f"tl-{lv}-{vol}"
        first, last = lessons[0][0], lessons[-1][0]
        ctitle = f"{lv}단계 {vol}권"
        sub = f"진리공과 · {lv}단계 {vol}권 · 제{first}~{last}과"
        listing = "\n".join(f"- 제{n}과 {t}" for n, t, _ in lessons)
        desc = (f"# 진리공과 {lv}단계 {vol}권\n\n"
                f"위트니스 리의 《진리 공과》 {lv}단계 {vol}권입니다. **제{first}과**부터 순서대로 공부하세요.\n\n"
                f"각 과는 **개요 → 본문 → 요약 → 질문** 순서로 되어 있습니다.\n\n{listing}")
        nodes = [{"id": "root", "title": ctitle, "description": desc, "scripture": "", "x": 0, "y": 0}]
        edges = []
        for n, t, body in lessons:
            nid = f"lesson-{n:02d}"
            nodes.append({"id": nid, "title": f"제{n}과 {t}", "description": lesson_markdown(vkey, n, t, body),
                          "scripture": "", "x": 0, "y": 0})
            edges.append({"id": f"e-root-{nid}", "from": "root", "to": nid, "type": "hierarchy"})
        mm = {"version": 2, "catalogSlug": CATALOG_SLUG, "rootId": "root",
              "meta": {"title": ctitle, "subtitle": sub, "catalogSlug": CATALOG_SLUG, "layout": "linear", "updatedAt": now},
              "nodes": nodes, "edges": edges}
        d = OUT / "courses" / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "mindmap.json").write_text(json.dumps(mm, ensure_ascii=False, indent=2), encoding="utf-8")
        courses.append({"slug": slug, "title": ctitle, "subtitle": sub, "description": desc,
                        "order": len(courses) + 1, "createdAt": now})
        total += len(lessons)
        print(f"{slug}: {len(lessons)}과 (제{first}~{last}과)")
    cd = OUT / "catalogs" / CATALOG_SLUG
    cd.mkdir(parents=True, exist_ok=True)
    (cd / "courses.json").write_text(json.dumps({"version": 1, "catalogSlug": CATALOG_SLUG, "courses": courses},
                                                ensure_ascii=False, indent=2), encoding="utf-8")
    add_catalog_entry()
    print("TOTAL lessons:", total)
    print("joined broken lines:", stats["joined"])
    for a, b in stats["join_samples"]:
        print("   …", a, "‖", b)
    print("no outline:", stats["no_outline"])
    print("no body:", stats["no_body"])
    print("short:", stats["empty"])
    print("marker fixes:", stats.get("fixed"))
    print("typo fixes: kinds", len(fix_count), "total", sum(fix_count.values()))
    print("title diffs:", len(stats.get("title_diff", [])))
    for x in stats.get("title_diff", []):
        print("   ", x)


if __name__ == "__main__":
    main()
