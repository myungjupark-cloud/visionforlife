(function () {
  "use strict";

  var VISIONFORLIFE_UPDATES = [
    {
      ver: "0.2",
      date: "2026-07-08",
      notes: [
        "다과정 카탈로그 홈",
        "학습 진도 저장 (로그인·localStorage)",
        "이해했습니다 완료 표시"
      ]
    },
    {
      ver: "0.1",
      date: "2026-07-08",
      notes: [
        "브랜드명 VisionforLife로 확정",
        "VisionforLife 프로젝트 시작",
        "첫 샘플 과정: 하나님은 누구신가?",
        "faith-mindmap 여정 UI 기반"
      ]
    }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function initVersionFoot() {
    var btn = document.getElementById("app-ver-btn");
    var modal = document.getElementById("app-update-modal");
    var list = document.getElementById("app-changelog");
    if (!btn || !modal || !list || !VISIONFORLIFE_UPDATES.length) return;

    btn.textContent = "Ver. " + VISIONFORLIFE_UPDATES[0].ver + " · 업데이트 내역";

    list.innerHTML = VISIONFORLIFE_UPDATES.map(function (u) {
      var notes = (u.notes || []).map(function (n) {
        return "<li>" + esc(n) + "</li>";
      }).join("");
      return (
        '<li class="app-changelog__item">' +
          '<div class="app-changelog__head">' +
            '<span class="app-changelog__ver">Ver. ' + esc(u.ver) + "</span>" +
            '<span class="app-changelog__date">' + esc(u.date) + "</span>" +
          "</div>" +
          '<ul class="app-changelog__notes">' + notes + "</ul>" +
        "</li>"
      );
    }).join("");

    function openModal() {
      modal.hidden = false;
    }

    function closeModal() {
      modal.hidden = true;
    }

    btn.addEventListener("click", openModal);
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVersionFoot);
  } else {
    initVersionFoot();
  }
})();
