#!/usr/bin/env python3
"""VisionforLife — 과정 카탈로그·mindmap 경로."""

from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
COURSES_DIR = os.path.join(ROOT, "data", "courses")
CATALOG_PATH = os.path.join(COURSES_DIR, "catalog.json")

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_catalog() -> dict:
    if not os.path.isfile(CATALOG_PATH):
        return {"version": 1, "courses": []}
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def list_course_slugs() -> list[str]:
    catalog = load_catalog()
    slugs = [str(c.get("slug", "")).strip() for c in catalog.get("courses", [])]
    return [s for s in slugs if s]


def is_valid_slug(slug: str) -> bool:
    slug = (slug or "").strip()
    if not slug or not SLUG_RE.match(slug):
        return False
    if slug in list_course_slugs():
        return True
    return os.path.isfile(mindmap_path(slug))


def mindmap_path(slug: str) -> str:
    return os.path.join(COURSES_DIR, slug, "mindmap.json")


def load_mindmap(slug: str) -> dict:
    path = mindmap_path(slug)
    if not os.path.isfile(path):
        raise FileNotFoundError(slug)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_mindmap(slug: str, data: dict) -> str:
    path = mindmap_path(slug)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return path


def learnable_node_ids(data: dict) -> list[str]:
    root_id = data.get("rootId")
    nodes = data.get("nodes") or []
    return [n["id"] for n in nodes if n.get("id") and n["id"] != root_id]


def course_meta_from_catalog(slug: str) -> dict | None:
    for course in load_catalog().get("courses", []):
        if course.get("slug") == slug:
            return course
    return None
