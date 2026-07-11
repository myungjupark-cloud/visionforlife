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

STATUS_PENDING = "pending"
STATUS_ACTIVE = "active"
STATUS_DISABLED = "disabled"
ROLE_LEARNER = "learner"
ROLE_OPERATOR = "operator"


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {str(r["name"]) for r in rows}


def _migrate(conn: sqlite3.Connection) -> None:
    cols = _table_columns(conn, "users")
    if "status" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
        )
        conn.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''")
    if "role" not in cols:
        conn.execute(
            "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'learner'"
        )
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS operator_messages (
          user_id INTEGER PRIMARY KEY,
          body TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          read_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )


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
              status TEXT NOT NULL DEFAULT 'pending',
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
        _migrate(conn)


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


def _row_status(row: sqlite3.Row) -> str:
    try:
        value = row["status"]
    except (IndexError, KeyError):
        value = STATUS_ACTIVE
    return str(value or STATUS_ACTIVE)


def _row_role(row: sqlite3.Row) -> str:
    try:
        value = row["role"]
    except (IndexError, KeyError):
        value = ROLE_LEARNER
    return str(value or ROLE_LEARNER)


def normalize_phone(raw: str) -> str:
    """Digits-only input → 010-3193-4530 style. Raises ValueError if invalid."""
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("01"):
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    if len(digits) == 10 and digits.startswith("01"):
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    raise ValueError("올바른 휴대폰 번호를 입력하세요 (예: 010-3193-4530)")


def _user_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    phone = row["email"]
    return {
        "id": row["id"],
        "phone": phone,
        "email": phone,  # legacy alias (column still named email)
        "name": row["name"],
        "role": _row_role(row),
        "status": _row_status(row),
        "goals": row["goals"],
        "createdAt": row["created_at"],
    }


def register_user(phone: str, password: str, name: str = "") -> dict[str, Any]:
    phone = normalize_phone(phone)
    if len(password or "") < 6:
        raise ValueError("비밀번호는 6자 이상이어야 합니다")
    pw_hash = _hash_password(password)
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    with _connect() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO users (email, password_hash, name, role, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (phone, pw_hash, (name or "").strip(), ROLE_LEARNER, STATUS_PENDING, now),
            )
        except sqlite3.IntegrityError:
            raise ValueError("이미 등록된 휴대폰 번호입니다") from None
        user_id = cur.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row)


def login_user(phone: str, password: str) -> tuple[dict[str, Any], str]:
    phone = normalize_phone(phone)
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (phone,)).fetchone()
        if not row or not _verify_password(password or "", row["password_hash"]):
            raise ValueError("휴대폰 번호 또는 비밀번호가 올바르지 않습니다")
        status = _row_status(row)
        if status == STATUS_PENDING:
            raise ValueError("승인 대기 중입니다. 운영자 승인 후 로그인할 수 있습니다")
        if status == STATUS_DISABLED:
            raise ValueError("이용이 제한된 계정입니다")
        if status != STATUS_ACTIVE:
            raise ValueError("로그인할 수 없는 계정입니다")
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
        if not row:
            return None
        if _row_status(row) != STATUS_ACTIVE:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None
    return _user_row_to_dict(row)


def logout_user(token: str | None) -> None:
    if not token:
        return
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def clear_user_sessions(user_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


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


def update_user_name(user_id: int, name: str) -> dict[str, Any]:
    name = (name or "").strip()
    if not name:
        raise ValueError("이름을 입력하세요")
    if len(name) > 40:
        raise ValueError("이름은 40자 이하여야 합니다")
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("회원을 찾을 수 없습니다")
        conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row)


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row) if row else None


def set_user_status(user_id: int, status: str) -> dict[str, Any]:
    if status not in (STATUS_PENDING, STATUS_ACTIVE, STATUS_DISABLED):
        raise ValueError("invalid status")
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("회원을 찾을 수 없습니다")
        conn.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
        if status != STATUS_ACTIVE:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row)


def set_user_role(user_id: int, role: str) -> dict[str, Any]:
    if role not in (ROLE_LEARNER, ROLE_OPERATOR):
        raise ValueError("invalid role")
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("회원을 찾을 수 없습니다")
        if _row_status(row) != STATUS_ACTIVE and role == ROLE_OPERATOR:
            raise ValueError("활성 회원만 운영자로 임명할 수 있습니다")
        conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_row_to_dict(row)


def upsert_operator_message(user_id: int, body: str) -> dict[str, Any]:
    body = (body or "").strip()
    if not body:
        raise ValueError("안내 내용을 입력하세요")
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("회원을 찾을 수 없습니다")
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO operator_messages (user_id, body, created_at, read_at)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(user_id) DO UPDATE SET
              body = excluded.body,
              created_at = excluded.created_at,
              read_at = NULL
            """,
            (user_id, body, now),
        )
    return {"userId": user_id, "body": body, "createdAt": now, "readAt": None}


def get_unread_operator_message(user_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT user_id, body, created_at, read_at
            FROM operator_messages
            WHERE user_id = ? AND (read_at IS NULL OR read_at = '')
            """,
            (user_id,),
        ).fetchone()
    if not row or not str(row["body"] or "").strip():
        return None
    return {
        "userId": row["user_id"],
        "body": row["body"],
        "createdAt": row["created_at"],
        "readAt": row["read_at"],
    }


def mark_operator_message_read(user_id: int) -> None:
    with _connect() as conn:
        conn.execute(
            """
            UPDATE operator_messages
            SET read_at = ?
            WHERE user_id = ? AND (read_at IS NULL OR read_at = '')
            """,
            (_now_iso(), user_id),
        )


def list_users(limit: int = 200) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 200), 500))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.email, u.name, u.role, u.status, u.goals, u.created_at,
                   COUNT(DISTINCT p.course_slug) AS course_count,
                   COUNT(p.node_id) AS node_count
            FROM users u
            LEFT JOIN user_progress p ON p.user_id = u.id
            GROUP BY u.id
            ORDER BY
              CASE u.status
                WHEN 'pending' THEN 0
                WHEN 'active' THEN 1
                ELSE 2
              END,
              u.id ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "phone": row["email"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"] or ROLE_LEARNER,
            "status": row["status"] or STATUS_ACTIVE,
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
