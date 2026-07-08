(function (global) {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function inlineFormat(raw) {
    var out = "";
    var re = /\*\*([^*]+)\*\*/g;
    var last = 0;
    var m;
    while ((m = re.exec(raw)) !== null) {
      out += esc(raw.slice(last, m.index)) + "<strong>" + esc(m[1]) + "</strong>";
      last = m.index + m[0].length;
    }
    out += esc(raw.slice(last));
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

  function isBlockStart(line) {
    if (!line || !line.trim()) return false;
    if (/^#{1,3}\s/.test(line)) return true;
    if (/^---+\s*$/.test(line)) return true;
    if (/^[-*•]\s+/.test(line)) return true;
    if (isTableRow(line)) return true;
    return false;
  }

  function markdownToHtml(md) {
    if (!md) return "";
    var lines = String(md).replace(/\r\n/g, "\n").split("\n");
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
        i += 1;
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
      /^---+\s*$/m.test(text)
    );
  }

  global.FaithMarkdown = {
    toHtml: markdownToHtml,
    isRich: isRichMarkdown
  };
})(typeof window !== "undefined" ? window : this);
