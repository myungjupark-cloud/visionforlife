#!/usr/bin/env python3
"""VisionforLife — 카탈로그·과정·mindmap 경로."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
CATALOGS_INDEX_PATH = os.path.join(DATA_DIR, "catalogs.json")
CATALOGS_DIR = os.path.join(DATA_DIR, "catalogs")
COURSES_DIR = os.path.join(DATA_DIR, "courses")

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_catalogs_index() -> dict:
    if not os.path.isfile(CATALOGS_INDEX_PATH):
        return {"version": 1, "catalogs": []}
    with open(CATALOGS_INDEX_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_catalogs_index(data: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CATALOGS_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def catalog_courses_path(catalog_slug: str) -> str:
    return os.path.join(CATALOGS_DIR, catalog_slug, "courses.json")


def load_catalog_courses(catalog_slug: str) -> dict:
    path = catalog_courses_path(catalog_slug)
    if not os.path.isfile(path):
        return {"version": 1, "catalogSlug": catalog_slug, "courses": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_catalog_courses(catalog_slug: str, data: dict) -> None:
    os.makedirs(os.path.dirname(catalog_courses_path(catalog_slug)), exist_ok=True)
    data["catalogSlug"] = catalog_slug
    with open(catalog_courses_path(catalog_slug), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def list_catalog_slugs() -> list[str]:
    return [
        str(c.get("slug", "")).strip()
        for c in load_catalogs_index().get("catalogs", [])
        if str(c.get("slug", "")).strip()
    ]


def catalog_slug_available(slug: str) -> bool:
    slug = (slug or "").strip()
    if not slug or not SLUG_RE.match(slug):
        return False
    if slug in list_catalog_slugs():
        return False
    return not os.path.isdir(os.path.join(CATALOGS_DIR, slug))


def create_catalog(slug: str, title: str, description: str = "") -> dict:
    slug = (slug or "").strip()
    title = (title or "").strip() or slug
    if not catalog_slug_available(slug):
        raise ValueError("catalog slug unavailable or invalid")

    index = load_catalogs_index()
    catalogs = list(index.get("catalogs") or [])
    order = max([int(c.get("order") or 0) for c in catalogs] + [0]) + 1
    entry = {
        "slug": slug,
        "title": title,
        "description": (description or "").strip(),
        "order": order,
        "published": False,
    }
    catalogs.append(entry)
    index["catalogs"] = catalogs
    save_catalogs_index(index)
    save_catalog_courses(slug, {"version": 1, "catalogSlug": slug, "courses": []})
    return entry


def update_catalog(slug: str, title: str, description: str = "") -> dict:
    slug = (slug or "").strip()
    title = (title or "").strip()
    if not slug or not title:
        raise ValueError("slug and title required")

    index = load_catalogs_index()
    catalogs = list(index.get("catalogs") or [])
    idx = next((i for i, c in enumerate(catalogs) if c.get("slug") == slug), None)
    if idx is None:
        raise ValueError("catalog not found")

    entry = dict(catalogs[idx])
    entry["title"] = title
    entry["description"] = (description or "").strip()
    catalogs[idx] = entry
    index["catalogs"] = catalogs
    save_catalogs_index(index)
    return entry


def catalog_meta(slug: str) -> dict | None:
    for catalog in load_catalogs_index().get("catalogs", []):
        if catalog.get("slug") == slug:
            return catalog
    return None


def list_course_slugs() -> list[str]:
    slugs: list[str] = []
    for catalog_slug in list_catalog_slugs():
        for course in load_catalog_courses(catalog_slug).get("courses", []):
            s = str(course.get("slug", "")).strip()
            if s:
                slugs.append(s)
    return slugs


def find_catalog_for_course(course_slug: str) -> str | None:
    course_slug = (course_slug or "").strip()
    for catalog_slug in list_catalog_slugs():
        for course in load_catalog_courses(catalog_slug).get("courses", []):
            if course.get("slug") == course_slug:
                return catalog_slug
    return None


def list_all_courses() -> list[dict]:
    out: list[dict] = []
    for catalog_slug in list_catalog_slugs():
        meta = catalog_meta(catalog_slug) or {}
        for course in load_catalog_courses(catalog_slug).get("courses", []):
            slug = str(course.get("slug", "")).strip()
            if not slug:
                continue
            item = dict(course)
            item["catalogSlug"] = catalog_slug
            item["catalogTitle"] = meta.get("title") or catalog_slug
            out.append(item)
    return out


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


def course_meta_from_catalog(catalog_slug: str, course_slug: str) -> dict | None:
    for course in load_catalog_courses(catalog_slug).get("courses", []):
        if course.get("slug") == course_slug:
            return course
    return None


def course_slug_available(slug: str) -> bool:
    slug = (slug or "").strip()
    if not slug or not SLUG_RE.match(slug):
        return False
    if slug in list_course_slugs():
        return False
    return not os.path.isdir(os.path.join(COURSES_DIR, slug))


def create_course(
    catalog_slug: str,
    slug: str,
    title: str,
    subtitle: str = "",
    description: str = "",
) -> dict:
    catalog_slug = (catalog_slug or "").strip()
    slug = (slug or "").strip()
    title = (title or "").strip() or slug
    if not catalog_meta(catalog_slug):
        raise ValueError("catalog not found")
    if not course_slug_available(slug):
        raise ValueError("course slug unavailable or invalid")

    catalog = load_catalog_courses(catalog_slug)
    courses = list(catalog.get("courses") or [])
    order = max([int(c.get("order") or 0) for c in courses] + [0]) + 1
    entry = {
        "slug": slug,
        "title": title,
        "subtitle": (subtitle or "").strip(),
        "description": (description or "").strip(),
        "order": order,
    }
    courses.append(entry)
    catalog["courses"] = courses
    save_catalog_courses(catalog_slug, catalog)

    now = datetime.now(timezone.utc).astimezone().isoformat()
    mindmap = {
        "version": 2,
        "courseSlug": slug,
        "catalogSlug": catalog_slug,
        "rootId": "root",
        "meta": {
            "title": title,
            "subtitle": (subtitle or "").strip(),
            "catalogSlug": catalog_slug,
            "updatedAt": now,
        },
        "nodes": [
            {
                "id": "root",
                "title": title,
                "description": (description or "").strip()
                or "아래 1단계 주제 중 하나를 선택해 이어가세요.",
                "scripture": "",
                "x": 0,
                "y": 0,
            }
        ],
        "edges": [],
    }
    save_mindmap(slug, mindmap)
    entry["catalogSlug"] = catalog_slug
    return entry


def update_course(
    catalog_slug: str,
    slug: str,
    title: str,
    subtitle: str = "",
    description: str = "",
) -> dict:
    catalog_slug = (catalog_slug or "").strip()
    slug = (slug or "").strip()
    title = (title or "").strip()
    if not catalog_slug or not slug or not title:
        raise ValueError("catalog, slug and title required")

    catalog = load_catalog_courses(catalog_slug)
    courses = list(catalog.get("courses") or [])
    idx = next((i for i, c in enumerate(courses) if c.get("slug") == slug), None)
    if idx is None:
        raise ValueError("course not found")

    entry = dict(courses[idx])
    entry["title"] = title
    entry["subtitle"] = (subtitle or "").strip()
    entry["description"] = (description or "").strip()
    courses[idx] = entry
    catalog["courses"] = courses
    save_catalog_courses(catalog_slug, catalog)

    try:
        data = load_mindmap(slug)
    except FileNotFoundError:
        entry["catalogSlug"] = catalog_slug
        return entry

    root_id = data.get("rootId")
    now = datetime.now(timezone.utc).astimezone().isoformat()
    meta = data.setdefault("meta", {})
    meta["title"] = title
    meta["subtitle"] = entry["subtitle"]
    meta["catalogSlug"] = catalog_slug
    meta["updatedAt"] = now
    data["catalogSlug"] = catalog_slug

    for node in data.get("nodes") or []:
        if node.get("id") == root_id:
            node["title"] = title
            break

    save_mindmap(slug, data)
    entry["catalogSlug"] = catalog_slug
    return entry


def sync_catalog_from_mindmap(course_slug: str, data: dict) -> bool:
    catalog_slug = find_catalog_for_course(course_slug)
    if not catalog_slug:
        return False

    catalog = load_catalog_courses(catalog_slug)
    courses = list(catalog.get("courses") or [])
    idx = next((i for i, c in enumerate(courses) if c.get("slug") == course_slug), None)
    if idx is None:
        return False

    root_id = data.get("rootId")
    root_title = ""
    for node in data.get("nodes") or []:
        if node.get("id") == root_id:
            root_title = str(node.get("title") or "").strip()
            break

    meta = data.get("meta") or {}
    subtitle = str(meta.get("subtitle") or "").strip()
    entry = dict(courses[idx])
    changed = False

    if root_title and entry.get("title") != root_title:
        entry["title"] = root_title
        changed = True
    if entry.get("subtitle") != subtitle:
        entry["subtitle"] = subtitle
        changed = True

    if not changed:
        return False

    courses[idx] = entry
    catalog["courses"] = courses
    save_catalog_courses(catalog_slug, catalog)
    return True
