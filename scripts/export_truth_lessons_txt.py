#!/usr/bin/env python3
"""진리공과 앱 데이터(교정 반영) → 권별 읽는 txt 16개.

    python scripts/export_truth_lessons_txt.py "<저장 폴더>"

저장 폴더는 인자로 준다(폴더 위치가 옮겨진 적이 있어 코드에 박지 않는다).
  - 2026-10-23: E:\\내 드라이브\\주의회복의 진리\\진리공과
  - 2026-10-25 이후: 성경연구 QnA 가 E:\\내 드라이브\\Projects\\성경연구 QnA 소스자료\\08_진리공과\\진리공과 로 옮김
처음 뽑은 원문(교정 전) txt 가 폴더 안에 있으면 `원문(교정전)` 하위 폴더로 옮겨 둔다(덮어쓰지 않음).
지난번에 만든 `(교정본)` 파일은 새로 덮어쓴다. 마크다운 기호(##, ###, **)만 걷어 내고 글은 그대로.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
DATA = Path(__file__).resolve().parents[1] / "data" / "courses"


def plain(md: str) -> str:
    out = []
    for line in md.splitlines():
        s = re.sub(r"^#{1,3}\s+", "", line)
        s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
        out.append(s.rstrip())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    dest = Path(sys.argv[1])
    dest.mkdir(parents=True, exist_ok=True)
    old = dest / "원문(교정전)"
    old.mkdir(exist_ok=True)
    for f in dest.glob("*.txt"):
        if "(교정본)" in f.name:
            continue
        t = old / f.name
        if not t.exists():
            shutil.move(str(f), str(t))

    n_files = n_lessons = 0
    for lv in range(1, 5):
        for v in range(1, 5):
            mm = json.loads((DATA / f"tl-{lv}-{v}" / "mindmap.json").read_text(encoding="utf-8"))
            parts = [f"진리 공과 — 제{lv}단계 제{v}권", mm["meta"]["subtitle"].split(" · ")[-1], ""]
            for n in mm["nodes"][1:]:
                parts += ["=" * 60, n["title"], "=" * 60, "", plain(n["description"]), "", ""]
                n_lessons += 1
            (dest / f"진리 공과 {lv}단계 {v}권 (교정본).txt").write_text(
                "\n".join(parts).rstrip() + "\n", encoding="utf-8")
            n_files += 1
    print(f"wrote {n_files} files, {n_lessons} lessons -> {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
