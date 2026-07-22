(function (global) {
  'use strict';

  var NAME2AB = {
    '마태복음': '마', '창세기': '창', '마가복음': '막', '출애굽기': '출', '누가복음': '눅', '레위기': '레',
    '민수기': '민', '요한복음': '요', '사도행전': '행', '신명기': '신', '로마서': '롬', '여호수아': '수',
    '고린도전서': '고전', '사사기': '삿', '고린도후서': '고후', '룻기': '룻', '갈라디아서': '갈',
    '사무엘상': '삼상', '사무엘하': '삼하', '에베소서': '엡', '빌립보서': '빌', '열왕기상': '왕상',
    '골로새서': '골', '열왕기하': '왕하', '데살로니가전서': '살전', '역대상': '대상', '데살로니가후서': '살후',
    '역대하': '대하', '디모데전서': '딤전', '에스라': '스', '느헤미야': '느', '디모데후서': '딤후',
    '디도서': '딛', '에스더': '에', '빌레몬서': '몬', '욥기': '욥', '시편': '시', '히브리서': '히',
    '야고보서': '약', '잠언': '잠', '베드로전서': '벧전', '전도서': '전', '베드로후서': '벧후',
    '아가': '아', '요한일서': '요일', '이사야': '사', '예레미야': '렘', '요한이서': '요이',
    '예레미야애가': '애', '요한삼서': '요삼', '에스겔': '겔', '유다서': '유', '다니엘': '단',
    '요한계시록': '계', '호세아': '호', '요엘': '욜', '아모스': '암', '오바댜': '옵', '오바다': '옵',
    '요나': '욘', '미가': '미', '나훔': '나', '하박국': '합', '스바냐': '습', '학개': '학', '스가랴': '슥',
    '말라기': '말'
  };

  var BOOK_TOKENS = [];
  (function () {
    var seen = {};
    Object.keys(NAME2AB).concat(Object.values(NAME2AB)).forEach(function (s) {
      if (!seen[s]) { seen[s] = 1; BOOK_TOKENS.push(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
    });
    BOOK_TOKENS.sort(function (a, b) { return b.length - a.length; });
  })();

  var DASH = '‐‑‒–—―－\\-~';
  var HALF = '[上하下]?';
  var BOOK_GUARD = '(?<![가-힣])';
  var BOOK_ALT = BOOK_TOKENS.join('|');
  var VCONT = '(?:\\s*[,，과]\\s*|\\s+)(\\d+)\\s*절';

  function stripHalf(s) {
    // 반절 표기(2:4하, 4절下)만 제거. 하박국·사무엘하 등 책이름의 '하'는 유지.
    return String(s).replace(/([0-9절])[上하下]+$/g, "$1");
  }

  function abbr(bookToken) {
    return NAME2AB[bookToken] || bookToken;
  }

  function formatRef(ab, ch, v1, v2, vEndCh) {
    if (vEndCh != null && vEndCh !== ch) return ab + ' ' + ch + ':' + v1 + '-' + vEndCh + ':' + v2;
    if (v2 != null && v2 !== v1) return ab + ' ' + ch + ':' + v1 + '-' + v2;
    return ab + ' ' + ch + ':' + v1;
  }

  function addMatch(matches, start, end, ref, label) {
    if (end <= start) return;
    matches.push({ start: start, end: end, ref: ref, label: stripHalf(label) });
  }

  function overlaps(matches, start, end) {
    for (var i = 0; i < matches.length; i++) {
      var h = matches[i];
      if (start < h.end && end > h.start) return true;
    }
    return false;
  }

  function findChapterContext(text, beforeIndex, maxLookback) {
    var slice = text.slice(Math.max(0, beforeIndex - (maxLookback || 280)), beforeIndex);
    var re = new RegExp(BOOK_GUARD + '(' + BOOK_ALT + ')\\s*(\\d+)\\s*장', 'g');
    var last = null;
    var m;
    while ((m = re.exec(slice)) !== null) last = m;
    if (!last) return null;
    var base = Math.max(0, beforeIndex - (maxLookback || 280));
    return {
      book: abbr(last[1]),
      ch: parseInt(last[2], 10),
      start: base + last.index,
      end: base + last.index + last[0].length
    };
  }

  /** 절만 있을 때 장 번호 — 앞 문맥의 첫 N장, 없으면 1장 */
  function resolveChapterForVerse(text, beforeIndex, defaultBookAbbr) {
    var slice = text.slice(Math.max(0, beforeIndex - 400), beforeIndex);
    var first = null;
    var re = new RegExp('(?:' + BOOK_ALT + '\\s*)?(\\d+)\\s*장', 'g');
    var m;
    while ((m = re.exec(slice)) !== null) {
      if (first === null) first = parseInt(m[1], 10);
    }
    if (first !== null) return first;
    return defaultBookAbbr ? 1 : null;
  }

  function resolveBookForVerse(text, beforeIndex, defaultBookAbbr) {
    var ctx = findChapterContext(text, beforeIndex);
    if (ctx) return ctx.book;
    return defaultBookAbbr;
  }

  function parseVerseList(str) {
    var s = String(str).trim();
    var out = [];
    if (/[,，]/.test(s)) {
      s.split(/[,，]/).forEach(function (part) {
        var m = part.match(/(\d+)/);
        if (m) out.push(parseInt(m[1], 10));
      });
      return out;
    }
    var re = /(\d+)\s*절/g;
    var m;
    while ((m = re.exec(s)) !== null) out.push(parseInt(m[1], 10));
    if (!out.length) {
      var bare = s.match(/(\d+)/g);
      if (bare) bare.forEach(function (x) { out.push(parseInt(x, 10)); });
    }
    return out;
  }

  function addVerseMatch(matches, start, end, book, ch, v, label) {
    if (overlaps(matches, start, end)) return;
    addMatch(matches, start, end, formatRef(book, ch, v, v), label);
  }

  function extendChapterVerses(matches, text, startIdx, endIdx, book, ch, firstVerse, firstEnd) {
    var end = firstEnd;
    var tail = text.slice(end);
    var moreRe = new RegExp(VCONT, 'g');
    var cm;
    while ((cm = moreRe.exec(tail)) !== null) {
      if (cm.index > 0) break;
      var v = parseInt(cm[1], 10);
      addVerseMatch(matches, end, end + cm[0].length, book, ch, v, cm[0].trim());
      end += cm[0].length;
      tail = text.slice(end);
      moreRe.lastIndex = 0;
    }
    return end;
  }

  function scanCommaRefList(text, from, to, defaultBookAbbr, matches) {
    var fullRe = new RegExp(
      '^(?:(' + BOOK_ALT + ')\\s*)?(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[' + DASH + ']\\s*(\\d+))?' + HALF
    );
    var bareRe = new RegExp('^(\\d+)' + HALF);
    var ctx = { book: defaultBookAbbr, ch: null };
    var pos = from;
    var slice, skip, fm, bm, start, end;

    while (pos < to) {
      skip = text.slice(pos, to).match(/^[\s,，]+/);
      if (skip) { pos += skip[0].length; continue; }

      slice = text.slice(pos, to);
      fm = fullRe.exec(slice);
      if (fm) {
        if (fm[1]) ctx.book = abbr(fm[1]);
        ctx.ch = parseInt(fm[2], 10);
        pos += fm[0].length;
        continue;
      }

      bm = bareRe.exec(slice);
      if (bm && ctx.ch && ctx.book) {
        start = pos;
        end = pos + bm[0].length;
        if (!overlaps(matches, start, end)) {
          addMatch(matches, start, end, formatRef(ctx.book, ctx.ch, parseInt(bm[1], 10), parseInt(bm[1], 10)), bm[0]);
        }
        pos = end;
        continue;
      }
      break;
    }
  }

  function findCommaListContinuations(text, defaultBookAbbr, matches) {
    var parenRe = /[(（]([^)）]*\d+\s*[:：]\s*\d+[^)）]*)[)）]/g;
    var startRe = new RegExp(BOOK_GUARD + '(?:(' + BOOK_ALT + ')\\s*)?(\\d+)\\s*[:：]\\s*(\\d+)', 'g');
    var m, tail;

    while ((m = parenRe.exec(text)) !== null) {
      scanCommaRefList(text, m.index + 1, m.index + 1 + m[1].length, defaultBookAbbr, matches);
    }
    while ((m = startRe.exec(text)) !== null) {
      tail = text.slice(m.index + m[0].length);
      if (!/^[\s,，]*,\s*\d/.test(tail)) continue;
      scanCommaRefList(text, m.index, text.length, defaultBookAbbr, matches);
    }
  }

  function findRefs(text, defaultBookAbbr) {
    if (!text) return [];
    var matches = [];
    var bookAlt = BOOK_ALT;
    var m;

    // 약어/전체 이름 + 장:절
    var explicitRe = new RegExp(
      BOOK_GUARD + '(' + bookAlt + ')\\s*(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[' + DASH + ']\\s*(\\d+))?' + HALF,
      'g'
    );
    while ((m = explicitRe.exec(text)) !== null) {
      var book = abbr(m[1]);
      addMatch(matches, m.index, m.index + m[0].length,
        formatRef(book, parseInt(m[2], 10), parseInt(m[3], 10), m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10)),
        m[0]);
    }

    // 책이름 N장 M절... — 개별 절 링크 또는 에서 N절까지 범위
    var chapVerseStart = new RegExp(BOOK_GUARD + '(' + bookAlt + ')\\s*(\\d+)\\s*장\\s*(\\d+)\\s*절', 'g');
    while ((m = chapVerseStart.exec(text)) !== null) {
      if (overlaps(matches, m.index, m.index + m[0].length)) continue;
      book = abbr(m[1]);
      var ch = parseInt(m[2], 10);
      var v1 = parseInt(m[3], 10);
      var end = m.index + m[0].length;
      var tail = text.slice(end);

      var rangeM = tail.match(/^\s*(?:에서|부터)\s*(\d+)\s*절까지/);
      if (rangeM) {
        var vEnd = parseInt(rangeM[1], 10);
        addMatch(matches, m.index, end + rangeM[0].length,
          formatRef(book, ch, v1, vEnd), text.slice(m.index, end + rangeM[0].length));
        continue;
      }

      addVerseMatch(matches, m.index, end, book, ch, v1, m[0]);
      extendChapterVerses(matches, text, m.index, end, book, ch, v1, end);
    }

    // 현재 책 + N장 M절 — 1장 26절
    if (defaultBookAbbr) {
      var bareChVerse = /(?<!\d)(\d+)\s*장\s*(\d+)\s*절/g;
      while ((m = bareChVerse.exec(text)) !== null) {
        if (overlaps(matches, m.index, m.index + m[0].length)) continue;
        ch = parseInt(m[1], 10);
        v1 = parseInt(m[2], 10);
        end = m.index + m[0].length;
        tail = text.slice(end);

        rangeM = tail.match(/^\s*(?:에서|부터)\s*(\d+)\s*절까지/);
        if (rangeM) {
          vEnd = parseInt(rangeM[1], 10);
          addMatch(matches, m.index, end + rangeM[0].length,
            formatRef(defaultBookAbbr, ch, v1, vEnd), text.slice(m.index, end + rangeM[0].length));
          continue;
        }

        addVerseMatch(matches, m.index, end, defaultBookAbbr, ch, v1, m[0]);
        extendChapterVerses(matches, text, m.index, end, defaultBookAbbr, ch, v1, end);
      }

      // 절만 — 1절, 3절부터 (앞 문맥의 장 + 현재 책)
      var bareVerseOnly = /(?<!\d)(?<!\s장\s*)(\d+)\s*절/g;
      while ((m = bareVerseOnly.exec(text)) !== null) {
        var vStart = m.index;
        var vEnd = m.index + m[0].length;
        if (overlaps(matches, vStart, vEnd)) continue;
        ch = resolveChapterForVerse(text, vStart, defaultBookAbbr);
        book = resolveBookForVerse(text, vStart, defaultBookAbbr);
        if (!ch || !book) continue;
        addVerseMatch(matches, vStart, vEnd, book, ch, parseInt(m[1], 10), m[0]);
      }
    }

    // 괄호 안 절 — (7, 29절) 각각 별도 링크
    var parenRe = /[(（]([^)）]*?\d+[^)）]*?)[)）]/g;
    while ((m = parenRe.exec(text)) !== null) {
      if (!/\d/.test(m[1]) || m[1].indexOf('절') < 0) continue;
      var ctx = findChapterContext(text, m.index);
      if (!ctx) continue;

      var inner = m[1];
      var verses = parseVerseList(inner);
      if (!verses.length) continue;

      var parenStart = m.index + 1;
      verses.forEach(function (v) {
        var idx = inner.indexOf(String(v));
        if (idx < 0) return;
        var lab = inner.slice(idx);
        var labM = lab.match(/^\d+\s*절?/);
        var labText = labM ? labM[0] : String(v);
        addVerseMatch(matches, parenStart + idx, parenStart + idx + labText.length, ctx.book, ctx.ch, v, labText);
      });
    }

    // 교차 장 범위
    var crossRe = new RegExp(
      '(?<!\\d)' + BOOK_GUARD + '(' + bookAlt + ')\\s*(\\d+)\\s*[:：]\\s*(\\d+)\\s*[' + DASH + ']\\s*(\\d+)\\s*[:：]\\s*(\\d+)' + HALF,
      'g'
    );
    while ((m = crossRe.exec(text)) !== null) {
      if (overlaps(matches, m.index, m.index + m[0].length)) continue;
      book = abbr(m[1]);
      addMatch(matches, m.index, m.index + m[0].length,
        formatRef(book, parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[5], 10), parseInt(m[4], 10)),
        m[0]);
    }

    if (defaultBookAbbr) {
      var bareCross = new RegExp(
        '(?<!\\d)(?<!:)(?<!：)(\\d+)\\s*[:：]\\s*(\\d+)\\s*[' + DASH + ']\\s*(\\d+)\\s*[:：]\\s*(\\d+)' + HALF,
        'g'
      );
      while ((m = bareCross.exec(text)) !== null) {
        if (overlaps(matches, m.index, m.index + m[0].length)) continue;
        addMatch(matches, m.index, m.index + m[0].length,
          formatRef(defaultBookAbbr, parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[4], 10), parseInt(m[3], 10)),
          m[0]);
      }

      var bareSimple = new RegExp(
        '(?<!\\d)(?<!:)(?<!：)(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[' + DASH + ']\\s*(\\d+))?' + HALF + '(?!\\d)(?!:)(?!：)',
        'g'
      );
      while ((m = bareSimple.exec(text)) !== null) {
        if (overlaps(matches, m.index, m.index + m[0].length)) continue;
        addMatch(matches, m.index, m.index + m[0].length,
          formatRef(defaultBookAbbr, parseInt(m[1], 10), parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10)),
          m[0]);
      }
    }

    findCommaListContinuations(text, defaultBookAbbr, matches);

    matches.sort(function (a, b) {
      return a.start - b.start || (b.end - b.start) - (a.end - a.start);
    });
    var kept = [];
    var cursor = 0;
    matches.forEach(function (hit) {
      if (hit.start < cursor) return;
      kept.push(hit);
      cursor = hit.end;
    });
    return kept;
  }

  function splitToParts(text, defaultBookAbbr) {
    var hits = findRefs(text, defaultBookAbbr);
    if (!hits.length) return [{ text: text }];
    var parts = [];
    var pos = 0;
    hits.forEach(function (hit) {
      if (hit.start > pos) parts.push({ text: text.slice(pos, hit.start) });
      parts.push({ ref: hit.ref, label: hit.label });
      pos = hit.end;
    });
    if (pos < text.length) parts.push({ text: text.slice(pos) });
    return parts;
  }

  function abbrForBookName(name) {
    return NAME2AB[name] || null;
  }

  global.ScrLink = {
    NAME2AB: NAME2AB,
    findRefs: findRefs,
    splitToParts: splitToParts,
    abbrForBookName: abbrForBookName
  };
})(typeof window !== 'undefined' ? window : globalThis);
