#!/usr/bin/env node
/** 전 과정 mindmap에서 stripHalf(구)가 책이름 '하' 등을 깨뜨리는 사례 검사 */
"use strict";

const fs = require("fs");
const path = require("path");

global.window = global;
require(path.join(__dirname, "..", "scr-link.js"));

function stripHalfOld(s) {
  return String(s).replace(/[上하下]/g, "");
}
function stripHalfNew(s) {
  return String(s).replace(/([0-9절])[上하下]+$/g, "$1");
}

const root = path.join(__dirname, "..", "data", "courses");
const issues = [];
let files = 0;
let refs = 0;
let affectedOld = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "mindmap.json") scan(p);
  }
}

function scan(file) {
  files += 1;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const slug = path.basename(path.dirname(file));
  for (const node of data.nodes || []) {
    const texts = [node.title, node.description, node.scripture].filter(Boolean);
    for (const text of texts) {
      const hits = ScrLink.findRefs(String(text));
      for (const hit of hits) {
        refs += 1;
        const raw = String(text).slice(hit.start, hit.end);
        const oldL = stripHalfOld(raw);
        const newL = stripHalfNew(raw);
        const curL = hit.label;
        if (oldL !== newL) {
          affectedOld += 1;
          issues.push({
            kind: "old-bug",
            slug,
            node: node.id,
            raw,
            oldLabel: oldL,
            newLabel: newL,
            currentLabel: curL,
            ctx: String(text)
              .slice(Math.max(0, hit.start - 16), Math.min(String(text).length, hit.end + 16))
              .replace(/\s+/g, " "),
          });
        }
        if (curL !== raw && curL !== newL) {
          issues.push({
            kind: "unexpected-label",
            slug,
            node: node.id,
            raw,
            currentLabel: curL,
            expectedNew: newL,
            ctx: String(text)
              .slice(Math.max(0, hit.start - 16), Math.min(String(text).length, hit.end + 16))
              .replace(/\s+/g, " "),
          });
        }
      }
    }
  }
}

walk(root);

const oldBugs = issues.filter((x) => x.kind === "old-bug");
const unexpected = issues.filter((x) => x.kind === "unexpected-label");

// 책이름에 上/하/下 포함 여부 요약
const booksWithHa = Object.keys(ScrLink.NAME2AB).filter((n) => /[上하下]/.test(n));
const abbrWithHa = [...new Set(Object.values(ScrLink.NAME2AB))].filter((n) => /[上하下]/.test(n));

const out = {
  files,
  refs,
  booksWithHa,
  abbrWithHa,
  oldBugWouldAffect: affectedOld,
  unexpectedLabel: unexpected.length,
  oldBugSamples: oldBugs.slice(0, 40),
  unexpectedSamples: unexpected.slice(0, 20),
};

const outPath = path.join(__dirname, "..", "data", "_stripHalf-audit.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      files,
      refs,
      booksWithHa,
      abbrWithHa,
      oldBugWouldAffect: affectedOld,
      unexpectedLabel: unexpected.length,
      report: outPath,
    },
    null,
    2
  )
);
