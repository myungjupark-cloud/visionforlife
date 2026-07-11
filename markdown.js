(function (global) {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /** Keep [[aside:...]] / [[link:...]] on one logical line so line-based markdown can parse them. */
  function normalizeInlineMarkers(md) {
    return String(md || "").replace(/\[\[(aside|link):([\s\S]*?)\]\]/gi, function (_full, kind, inner) {
      return "[[" + kind + ":" + String(inner).replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim() + "]]";
    });
  }

  function inlineFormat(raw) {
    var text = String(raw || "");
    var out = "";
    var i = 0;
    while (i < text.length) {
      var aside = text.slice(i).match(/^\[\[aside:([a-zA-Z0-9_-]+)\|([^\]]+)\]\]/);
      if (aside) {
        out +=
          '<button type="button" class="desc-aside-link" data-aside-id="' +
          esc(aside[1]) +
          '">' +
          esc(aside[2].trim()) +
          "</button>";
        i += aside[0].length;
        continue;
      }
      var extLink = text.slice(i).match(/^\[\[link:(https?:\/\/[^|\]]+)\|([^\]]+)\]\]/i);
      if (extLink) {
        out +=
          '<a class="desc-ext-link" href="' +
          esc(extLink[1]) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(extLink[2].trim()) +
          "</a>";
        i += extLink[0].length;
        continue;
      }
      if (text[i] === "*" && text[i + 1] === "*") {
        var end = text.indexOf("**", i + 2);
        if (end > i) {
          out += "<strong>" + esc(text.slice(i + 2, end)) + "</strong>";
          i = end + 2;
          continue;
        }
      }
      var nextAside = text.indexOf("[[aside:", i);
      var nextLink = text.indexOf("[[link:", i);
      var nextBold = text.indexOf("**", i);
      var next = text.length;
      if (nextAside >= i && nextAside < next) next = nextAside;
      if (nextLink >= i && nextLink < next) next = nextLink;
      if (nextBold >= i && nextBold < next) next = nextBold;
      if (next === i) {
        out += esc(text[i]);
        i += 1;
      } else {
        out += esc(text.slice(i, next));
        i = next;
      }
    }
    return out;
  }

  function isTableRow(line) {
    return /^\|.+\|$/.test(String(line || "").trim());
  }

  function isTableSep(line) {
    return /^\|[\s:\-|]+\|$/.test(String(line || "").trim());
  }

  function parseTableRow(line) {
    return String(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) {
      return c.trim();
    });
  }

  function renderTable(header, rows) {
    var head = "<thead><tr>" + header.map(function (cell) {
      return "<th>" + inlineFormat(cell) + "</th>";
    }).join("") + "</tr></thead>";
    var body = "<tbody>" + rows.map(function (row) {
      return "<tr>" + row.map(function (cell) {
        return "<td>" + inlineFormat(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody>";
    return '<div class="desc-table-wrap"><table class="desc-table">' + head + body + "</table></div>";
  }

  var HYMN_LINE_RE = /^\s*(?:\*\*)?\s*찬송가\s*(\d+)\s*장(?:\s*[-–—:]\s*(.+?))?\s*(?:\*\*)?\s*$/;

  function parseHymnLine(line) {
    var m = String(line || "").match(HYMN_LINE_RE);
    if (!m) return null;
    return {
      num: parseInt(m[1], 10),
      title: (m[2] || "").replace(/\*+$/, "").trim()
    };
  }

  function renderHymnBlock(hymn, rawLine) {
    var num = hymn.num;
    var label = "찬송가 " + num + "장";
    if (hymn.title) label += " - " + hymn.title;
    else {
      var stripped = String(rawLine || "").replace(/^\s*\*\*?/, "").replace(/\*\*?\s*$/, "").trim();
      if (stripped) label = stripped;
    }
    return (
      '<div class="desc-hymn" data-hymn-num="' + num + '">' +
        '<div class="desc-hymn-title">' + esc(label) + "</div>" +
        '<div class="desc-hymn-player">' +
          '<button type="button" class="desc-hymn-play" data-hymn-num="' + num + '" aria-label="찬송가 ' + num + '장 재생">▶</button>' +
          '<input type="range" class="desc-hymn-seek" min="0" max="1000" value="0" step="1" data-hymn-num="' + num + '" aria-label="재생 위치">' +
          '<span class="desc-hymn-time"><span class="desc-hymn-cur">0:00</span><span class="desc-hymn-sep"> / </span><span class="desc-hymn-dur">0:00</span></span>' +
        "</div>" +
      "</div>"
    );
  }

  function parseImageLine(line) {
    var m = String(line || "").trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (!m) return null;
    return { alt: m[1] || "", src: m[2] };
  }

  function renderImage(img) {
    var src = String(img.src || "");
    if (!/^(https?:\/\/|data:|\/)/i.test(src) && typeof global.FaithMarkdownAssetUrl === "function") {
      src = global.FaithMarkdownAssetUrl(src);
    }
    return (
      '<figure class="desc-figure">' +
        '<img class="desc-img" src="' +
        esc(src) +
        '" alt="' +
        esc(img.alt || "") +
        '" loading="lazy">' +
      "</figure>"
    );
  }

  function isBlockStart(line) {
    if (!line || !line.trim()) return false;
    if (/^#{1,3}\s/.test(line)) return true;
    if (/^---+\s*$/.test(line)) return true;
    if (/^[-*•]\s+/.test(line)) return true;
    if (isTableRow(line)) return true;
    if (parseHymnLine(line)) return true;
    if (parseImageLine(line)) return true;
    return false;
  }

  function markdownToHtml(md) {
    if (!md) return "";
    var lines = normalizeInlineMarkers(md).replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = parseTableRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
          rows.push(parseTableRow(lines[i]));
          i += 1;
        }
        html.push(renderTable(header, rows));
        continue;
      }

      var heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        var level = heading[1].length;
        html.push(
          '<div class="desc-subhead desc-subhead-' + level + '">' +
          inlineFormat(heading[2]) + "</div>"
        );
        i += 1;
        continue;
      }

      if (/^---+\s*$/.test(line)) {
        html.push('<hr class="desc-hr">');
        i += 1;
        continue;
      }

      var hymn = parseHymnLine(line);
      if (hymn) {
        html.push(renderHymnBlock(hymn, line));
        i += 1;
        continue;
      }

      var image = parseImageLine(line);
      if (image) {
        html.push(renderImage(image));
        i += 1;
        continue;
      }

      if (/^[-*•]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
          items.push("<li>" + inlineFormat(lines[i].replace(/^[-*•]\s+/, "")) + "</li>");
          i += 1;
        }
        html.push('<ul class="desc-list">' + items.join("") + "</ul>");
        continue;
      }

      if (!line.trim()) {
        var blanks = 0;
        while (i < lines.length && !String(lines[i] || "").trim()) {
          blanks += 1;
          i += 1;
        }
        // Preserve intentional vertical space (Enter x N). Skip only leading blanks.
        if (blanks > 0 && html.length > 0) {
          html.push(
            '<div class="desc-blank" style="height:' + (blanks * 1.15).toFixed(2) + 'em" aria-hidden="true"></div>'
          );
        }
        continue;
      }

      var paras = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        paras.push(inlineFormat(lines[i]));
        i += 1;
      }
      html.push('<p class="desc-p">' + paras.join("<br>") + "</p>");
    }

    return html.join("");
  }

  function isRichMarkdown(text) {
    if (!text) return false;
    return (
      /^#{1,3}\s/m.test(text) ||
      /^\|.+\|/m.test(text) ||
      /^[-*•]\s/m.test(text) ||
      /^---+\s*$/m.test(text) ||
      /찬송가\s*\d+\s*장/.test(text) ||
      /\[\[aside:[a-zA-Z0-9_-]+\|/.test(text) ||
      /\[\[link:https?:\/\//i.test(text) ||
      /!\[[^\]]*\]\([^)\s]+\)/.test(text)
    );
  }

  global.FaithMarkdown = {
    toHtml: markdownToHtml,
    isRich: isRichMarkdown
  };
})(typeof window !== "undefined" ? window : this);
