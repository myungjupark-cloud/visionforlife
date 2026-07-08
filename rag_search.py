# -*- coding: utf-8 -*-
"""search.db FTS + Voyage 임베딩 재정렬 (bible-qna / bible-topic-map 과 동일 원리)."""
from __future__ import annotations

import json
import re
import sqlite3
import struct
import urllib.request
from typing import Any

_TOK = re.compile(r"[가-힣]+|[a-z0-9]+")


def bigrams(text: str) -> list[str]:
    text = text.lower()
    toks: list[str] = []
    for m in _TOK.finditer(text):
        s = m.group()
        if "\uac00" <= s[0] <= "\ud7a3":
            if len(s) == 1:
                toks.append(s)
            else:
                toks.extend(s[i : i + 2] for i in range(len(s) - 1))
        else:
            toks.append(s)
    return toks


def is_compact_korean(text: str) -> bool:
    t = re.sub(r"\s+", "", text.strip())
    n = len(t)
    return 4 <= n <= 24 and bool(re.fullmatch(r"[가-힣]+", t))


def compact_split_variants(q: str) -> list[str]:
    q = re.sub(r"\s+", "", q.strip())
    q = re.sub(r"[?!\.，。]+$", "", q)
    out: list[str] = []
    suf = ("뜻은", "의미는", "무슨뜻", "의미", "이란", "정의", "설명", "뜻", "란")
    for s in suf:
        if q.endswith(s) and len(q) > len(s) + 1:
            base = q[: -len(s)]
            if len(base) >= 2:
                out.extend([base + " " + s, base])
    n = len(q)
    if n >= 4:
        for i in range(2, n - 1):
            a, b = q[:i], q[i:]
            if len(a) >= 2 and len(b) >= 2:
                out.append(a + " " + b)
    return out


def fts_match_string(text: str, relaxed: bool = False) -> str:
    clean = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    terms = [t for t in clean.split() if len(t) >= 2][:12]
    compact_whole = is_compact_korean(text)
    groups: list[str] = []
    for t in terms:
        bs = bigrams(t)
        if not bs:
            continue
        if len(bs) == 1:
            groups.append(f'"{bs[0]}"')
        elif relaxed and compact_whole and len(terms) == 1:
            groups.append("(" + " OR ".join(f'"{x}"' for x in bs) + ")")
        else:
            groups.append("(" + " AND ".join(f'"{x}"' for x in bs) + ")")
    return " OR ".join(groups)


def fts_query_ids(conn: sqlite3.Connection, match: str, lim: int) -> list[int]:
    if not match:
        return []
    cur = conn.execute(
        "SELECT rowid FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?",
        (match, lim),
    )
    return [int(r[0]) for r in cur.fetchall()]


def fts_candidates(conn: sqlite3.Connection, text: str, lim: int) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()

    def merge(ids: list[int]) -> bool:
        for i in ids:
            if i in seen:
                continue
            seen.add(i)
            out.append(i)
            if len(out) >= lim:
                return True
        return False

    if merge(fts_query_ids(conn, fts_match_string(text, False), lim)):
        return out
    if is_compact_korean(text):
        for v in compact_split_variants(text):
            if merge(fts_query_ids(conn, fts_match_string(v, False), lim)):
                return out
        merge(fts_query_ids(conn, fts_match_string(text, True), lim))
    return out


def voyage_embed(text: str, key: str, model: str = "voyage-4-lite", dim: int = 512) -> list[float]:
    body = {"input": [text], "model": model, "input_type": "query", "output_dimension": dim}
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        "https://api.voyageai.com/v1/embeddings",
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["data"][0]["embedding"]


def quantize_emb(emb: list[float]) -> list[int]:
    norm = sum(x * x for x in emb) ** 0.5 or 1.0
    out: list[int] = []
    for x in emb:
        v = round(x / norm * 127)
        out.append(max(-127, min(127, v)))
    return out


def db_meta(conn: sqlite3.Connection) -> tuple[str, int]:
    model, dim = "voyage-4-lite", 512
    try:
        for k, v in conn.execute("SELECT k, v FROM meta"):
            if k == "model":
                model = str(v)
            elif k == "dim":
                dim = int(v)
    except sqlite3.Error:
        pass
    return model, dim


def rerank_candidates(
    conn: sqlite3.Connection,
    cands: list[int],
    qi: list[int],
    k: int,
    corpus: str = "",
) -> list[dict[str, Any]]:
    if not cands:
        return []
    dim = len(qi)
    placeholders = ",".join("?" * len(cands))
    sql = f"SELECT id,type,corpus,source,ref,text,vec FROM docs WHERE id IN ({placeholders})"
    params: list[Any] = list(cands)
    if corpus:
        sql += " AND corpus = ?"
        params.append(corpus)
    rows = conn.execute(sql, params).fetchall()
    scored: list[dict[str, Any]] = []
    fmt = "b" * dim
    for row in rows:
        rid, typ, corp, source, ref, text, vec_blob = row
        if not vec_blob or len(vec_blob) < dim:
            continue
        v = struct.unpack(fmt, vec_blob[:dim])
        dot = sum(qi[i] * v[i] for i in range(dim))
        scored.append({
            "id": rid,
            "type": typ,
            "corpus": corp,
            "source": source,
            "ref": ref,
            "text": text,
            "score": dot,
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]


def fetch_chunks_by_ids(conn: sqlite3.Connection, ids: list[int]) -> list[dict[str, Any]]:
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(
        f"SELECT id,type,corpus,source,ref,text FROM docs WHERE id IN ({placeholders})",
        ids,
    ).fetchall()
    by_id = {int(r[0]): r for r in rows}
    out: list[dict[str, Any]] = []
    for i in ids:
        row = by_id.get(i)
        if not row:
            continue
        rid, typ, corp, source, ref, text = row
        out.append({
            "id": rid,
            "type": typ,
            "corpus": corp,
            "source": source,
            "ref": ref,
            "text": text,
        })
    return out


def search_topic_fts_only(
    conn: sqlite3.Connection,
    query: str,
    *,
    cand: int = 400,
    topk: int = 8,
) -> list[dict[str, Any]]:
    q = query.strip()
    if not q:
        return []
    ids = fts_candidates(conn, q, cand)[:topk]
    return fetch_chunks_by_ids(conn, ids)


def search_topic(
    conn: sqlite3.Connection,
    query: str,
    voyage_key: str,
    *,
    cand: int = 400,
    topk: int = 8,
    corpus: str = "",
) -> list[dict[str, Any]]:
    q = query.strip()
    if not q:
        return []
    ids = fts_candidates(conn, q, cand)
    if not ids:
        return []
    model, dim = db_meta(conn)
    emb = voyage_embed(q, voyage_key, model=model, dim=dim)
    qi = quantize_emb(emb)
    if len(qi) != dim:
        qi = qi[:dim]
    return rerank_candidates(conn, ids, qi, topk, corpus)
