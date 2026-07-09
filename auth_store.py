#!/usr/bin/env python3
"""VisionforLife — 회원·세션 저장 (SQLite)."""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
import time
from typing import Any

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "data", "visionforlife.db")

SESSION_TTL_SEC = 30 * 24 * 3600


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE COLLATE NOCASE,
              password_hash TEXT NOT NULL,
              name TEXT NOT NULL DEFAULT '',
              role TEXT NOT NULL DEFAULT 'learner',
              goals TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at REAL NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS user_progress (
              user_id INTEGER NOT NULL,
              course_slug TEXT NOT NULL,
              node_id TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'visited',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (user_id, course_slug, node_id),
              FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2_sha256$" + salt.hex() + "$" + digest.hex()


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_hex, digest_hex = stored.split("$", 2)
        if algo != "pbkdf2_sha256":
            return False
        salt = bytes.fromhex(salt_hex)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _user_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "goals": row["goals"],
        "createdAt": row["created_at"],
    }


def register_user(email: str, password: str, name: str = "") -> dict[str, Any]:
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("올바른 이메일을 입력하세요")
    if len(password or "") < 8:
        raise ValueError("비밀번호는 8자 이상이어야 합니다")
    pw_hash = _hash_password(password)
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    with _connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)",
                (email, pw_hash, (name or "").strip(), now),
            )
        except sqlite3.IntegrityError:
            raise ValueError("이미 가입된 이메일입니다") from None
        user_id = cur.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row)


def login_user(email: str, password: str) -> tuple[dict[str, Any], str]:
    email = (email or "").strip().lower()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row or not _verify_password(password or "", row["password_hash"]):
            raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다")
        token = secrets.token_urlsafe(32)
        expires = time.time() + SESSION_TTL_SEC
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, row["id"], expires),
        )
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
    return _user_row_to_dict(row), token


def user_from_token(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM users u
            JOIN sessions s ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, time.time()),
        ).fetchone()
    return _user_row_to_dict(row) if row else None


def logout_user(token: str | None) -> None:
    if not token:
        return
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def upsert_progress(user_id: int, course_slug: str, node_id: str, status: str) -> None:
    status = status if status in ("visited", "completed") else "visited"
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO user_progress (user_id, course_slug, node_id, status, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, course_slug, node_id) DO UPDATE SET
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (user_id, course_slug, node_id, status, _now_iso()),
        )


def get_course_progress(user_id: int, course_slug: str) -> dict[str, Any]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT node_id, status, updated_at FROM user_progress
            WHERE user_id = ? AND course_slug = ?
            ORDER BY updated_at ASC
            """,
            (user_id, course_slug),
        ).fetchall()
    nodes: dict[str, str] = {}
    last_node_id = None
    for row in rows:
        nodes[row["node_id"]] = row["status"]
        last_node_id = row["node_id"]
    visited = sum(1 for s in nodes.values() if s in ("visited", "completed"))
    completed = sum(1 for s in nodes.values() if s == "completed")
    return {
        "nodes": nodes,
        "lastNodeId": last_node_id,
        "visitedCount": visited,
        "completedCount": completed,
    }


def update_user_goals(user_id: int, goals: str) -> dict[str, Any]:
    goals = (goals or "").strip()
    with _connect() as conn:
        conn.execute("UPDATE users SET goals = ? WHERE id = ?", (goals, user_id))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise ValueError("user not found")
    return _user_row_to_dict(row)


def list_users(limit: int = 200) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 200), 500))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.email, u.name, u.role, u.goals, u.created_at,
                   COUNT(DISTINCT p.course_slug) AS course_count,
                   COUNT(p.node_id) AS node_count
            FROM users u
            LEFT JOIN user_progress p ON p.user_id = u.id
            GROUP BY u.id
            ORDER BY u.id ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "goals": row["goals"],
            "createdAt": row["created_at"],
            "courseCount": int(row["course_count"] or 0),
            "nodeCount": int(row["node_count"] or 0),
        }
        for row in rows
    ]


def get_all_progress_summary(user_id: int) -> dict[str, dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT course_slug, node_id, status, updated_at FROM user_progress
            WHERE user_id = ?
            ORDER BY updated_at ASC
            """,
            (user_id,),
        ).fetchall()
    by_course: dict[str, dict[str, Any]] = {}
    for row in rows:
        slug = row["course_slug"]
        if slug not in by_course:
            by_course[slug] = {"nodes": {}, "lastNodeId": None, "visitedCount": 0, "completedCount": 0}
        entry = by_course[slug]
        entry["nodes"][row["node_id"]] = row["status"]
        entry["lastNodeId"] = row["node_id"]
    for entry in by_course.values():
        nodes = entry["nodes"]
        entry["visitedCount"] = sum(1 for s in nodes.values() if s in ("visited", "completed"))
        entry["completedCount"] = sum(1 for s in nodes.values() if s == "completed")
    return by_course
