(function () {
  "use strict";

  function isLocalDevHost() {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  }

  var SKIP_ADMIN_PIN = isLocalDevHost();

  var state = {
    data: null,
    centerId: null,
    explored: [],
    childrenOpen: false,
    admin: false,
    adminCatalog: false,
    adminPin: "",
    courseFormMode: "add",
    catalogFormMode: "add",
    adminEditId: null,
    user: null,
    authMode: "login",
    screen: "catalogs",
    activeCatalogSlug: null,
    catalogs: [],
    courseSlug: null,
    catalog: [],
    courseProgress: { nodes: {}, lastNodeId: null, percent: 0 }
  };

  var saveInFlight = false;

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    appMain: $("app-main"),
    focusCard: $("focus-card"),
    outlineTreePanel: $("outline-tree-panel"),
    outlineTreeHeading: $("outline-tree-heading"),
    outlineTree: $("outline-tree"),
    btnBack: $("btn-back"),
    focusTitle: $("focus-title"),
    focusDesc: $("focus-desc"),
    focusScripture: $("focus-scripture"),
    expandWrap: $("expand-wrap"),
    btnExpand: $("btn-expand"),
    childrenPanel: $("children-panel"),
    childrenHeading: $("children-heading"),
    childrenList: $("children-list"),
    focusTrail: $("focus-trail"),
    focusDepth: $("focus-depth"),
    btnReset: $("btn-reset"),
    btnRefresh: $("btn-refresh"),
    btnAccount: $("btn-account"),
    btnAdmin: $("btn-admin"),
    authOverlay: $("auth-overlay"),
    authModalTitle: $("auth-modal-title"),
    authEmail: $("auth-email"),
    authPassword: $("auth-password"),
    authName: $("auth-name"),
    authNameRow: $("auth-name-row"),
    authSubmit: $("auth-submit"),
    authCancel: $("auth-cancel"),
    authToggleMode: $("auth-toggle-mode"),
    adminOverlay: $("admin-overlay"),
    adminPin: $("admin-pin"),
    adminLogin: $("admin-login"),
    adminCancel: $("admin-cancel"),
    adminHint: $("admin-hint"),
    adminToolbar: $("admin-toolbar"),
    adminEditor: $("admin-editor"),
    adminEditorResizer: $("admin-editor-resizer"),
    editTitle: $("edit-title"),
    editDesc: $("edit-desc"),
    editScripture: $("edit-scripture"),
    aiQuestion: $("ai-question"),
    aiAskMode: $("ai-ask-mode"),
    aiModeHint: $("ai-mode-hint"),
    aiAnswer: $("ai-answer"),
    aiAnswerPreview: $("ai-answer-preview"),
    aiAnswerMeta: $("ai-answer-meta"),
    btnAiAsk: $("btn-ai-ask"),
    btnAiInsert: $("btn-ai-insert"),
    btnAiAppend: $("btn-ai-append"),
    moveParentRow: $("move-parent-row"),
    editLocation: $("edit-location"),
    editParent: $("edit-parent"),
    editMoveMode: $("edit-move-mode"),
    btnMoveParent: $("btn-move-parent"),
    reorderRow: $("reorder-row"),
    btnMoveUp: $("btn-move-up"),
    btnMoveDown: $("btn-move-down"),
    btnAddChild: $("btn-add-child"),
    btnDeleteNode: $("btn-delete-node"),
    btnSave: $("btn-save"),
    btnExport: $("btn-export"),
    btnImport: $("btn-import"),
    importFile: $("import-file"),
    btnExitAdmin: $("btn-exit-admin"),
    toast: $("toast"),
    catalogPanel: $("catalog-panel"),
    catalogTitle: $("catalog-title"),
    catalogLead: $("catalog-lead"),
    btnBackToCatalogs: $("btn-back-to-catalogs"),
    catalogList: $("catalog-list"),
    focusApp: $("focus-app"),
    courseProgressWrap: $("course-progress"),
    courseProgressLabel: $("course-progress-label"),
    courseProgressBar: $("course-progress-bar"),
    btnMarkComplete: $("btn-mark-complete"),
    catalogResume: $("catalog-resume"),
    btnCatalogResume: $("btn-catalog-resume"),
    catalogGoals: $("catalog-goals"),
    goalsInput: $("goals-input"),
    btnSaveGoals: $("btn-save-goals"),
    catalogAdminBar: $("catalog-admin-bar"),
    btnAddCatalog: $("btn-add-catalog"),
    btnAddCourse: $("btn-add-course"),
    btnAdminUsers: $("btn-admin-users"),
    btnExitCatalogAdmin: $("btn-exit-catalog-admin"),
    courseAddOverlay: $("course-add-overlay"),
    courseFormTitle: $("course-form-title"),
    courseFormHint: $("course-form-hint"),
    courseAddSlug: $("course-add-slug"),
    courseAddTitle: $("course-add-title"),
    courseAddSubtitle: $("course-add-subtitle"),
    courseAddDesc: $("course-add-desc"),
    courseAddCancel: $("course-add-cancel"),
    courseAddSubmit: $("course-add-submit"),
    adminUsersOverlay: $("admin-users-overlay"),
    adminUsersList: $("admin-users-list"),
    adminUsersClose: $("admin-users-close"),
    catalogFormOverlay: $("catalog-form-overlay"),
    catalogFormTitle: $("catalog-form-title"),
    catalogFormHint: $("catalog-form-hint"),
    catalogFormSlug: $("catalog-form-slug"),
    catalogFormTitleInput: $("catalog-form-title-input"),
    catalogFormDesc: $("catalog-form-desc"),
    catalogFormCancel: $("catalog-form-cancel"),
    catalogFormSubmit: $("catalog-form-submit")
  };

  var PROGRESS_KEY = "visionforlife-progress";

  function appBasePath() {
    var link = document.querySelector('link[rel="manifest"]');
    if (link && link.href) {
      try {
        return new URL("./", link.href).href;
      } catch (e) { /* fall through */ }
    }
    var path = location.pathname || "/";
    if (!path.endsWith("/")) {
      if (/\.[a-z0-9]+$/i.test(path.split("/").pop() || "")) {
        path = path.replace(/\/[^/]*$/, "/");
      } else {
        path += "/";
      }
    }
    return location.origin + path;
  }

  function assetUrl(rel) {
    return new URL(String(rel || "").replace(/^\//, ""), appBasePath()).href;
  }

  function courseMindmapPath(slug) {
    return assetUrl("data/courses/" + slug + "/mindmap.json");
  }

  function staticCatalogsIndexPath() {
    return assetUrl("data/catalogs.json");
  }

  function staticCatalogCoursesPath(catalogSlug) {
    return assetUrl("data/catalogs/" + encodeURIComponent(catalogSlug) + "/courses.json");
  }

  function enrichCatalogCourses(courses, catalogSlug) {
    var meta = (state.catalogs || []).find(function (c) { return c.slug === catalogSlug; });
    return (courses || []).map(function (course) {
      var item = Object.assign({}, course);
      item.catalogSlug = catalogSlug;
      item.catalogTitle = meta ? meta.title : catalogSlug;
      return item;
    });
  }

  function catalogBySlug(slug) {
    return (state.catalogs || []).find(function (c) { return c.slug === slug; });
  }

  function isCatalogPublished(catalog) {
    if (!catalog) return false;
    return catalog.published !== false;
  }

  function canAccessCatalog(slug) {
    if (!slug) return false;
    if (state.adminCatalog || state.admin) return true;
    return isCatalogPublished(catalogBySlug(slug));
  }

  function catalogsForDisplay() {
    var list = (state.catalogs || []).slice();
    if (state.adminCatalog) return list;
    return list.filter(isCatalogPublished);
  }

  function readLocalProgressStore() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeLocalProgressStore(store) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  }

  function localProgressForCourse(slug) {
    var store = readLocalProgressStore();
    return store[slug] || { nodes: {}, lastNodeId: null };
  }

  function saveLocalProgress(slug, nodes, lastNodeId) {
    var store = readLocalProgressStore();
    store[slug] = { nodes: nodes, lastNodeId: lastNodeId || null };
    writeLocalProgressStore(store);
  }

  function countLearnableNodes() {
    if (!state.data || !state.data.nodes) return 0;
    return state.data.nodes.filter(function (n) { return n.id !== state.data.rootId; }).length;
  }

  function computePercentFromNodes(nodes) {
    var total = countLearnableNodes();
    if (total <= 0) return 0;
    var visited = 0;
    Object.keys(nodes || {}).forEach(function (id) {
      if (id !== state.data.rootId && nodes[id]) visited += 1;
    });
    return Math.min(100, Math.round(visited * 100 / total));
  }

  function applyProgressData(progress) {
    state.courseProgress = {
      nodes: (progress && progress.nodes) || {},
      lastNodeId: (progress && progress.lastNodeId) || null,
      percent: (progress && progress.percent) != null ? progress.percent : computePercentFromNodes((progress && progress.nodes) || {})
    };
  }

  function syncProgressToServer(slug, nodeId, status) {
    if (!state.user) return Promise.resolve();
    return fetch("/api/progress", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: slug, nodeId: nodeId, status: status })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data && data.ok && data.progress) applyProgressData(data.progress);
      return data;
    }).catch(function () { return null; });
  }

  function fetchServerProgress(slug) {
    if (!state.user) return Promise.resolve(null);
    return fetch("/api/progress?course=" + encodeURIComponent(slug), { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.progress) return data.progress;
        return null;
      })
      .catch(function () { return null; });
  }

  function loadCourseProgress(slug) {
    var local = localProgressForCourse(slug);
    applyProgressData({
      nodes: local.nodes,
      lastNodeId: local.lastNodeId,
      percent: computePercentFromNodes(local.nodes)
    });
    return fetchServerProgress(slug).then(function (server) {
      if (server) {
        applyProgressData(server);
        saveLocalProgress(slug, state.courseProgress.nodes, state.courseProgress.lastNodeId);
      }
      return state.courseProgress;
    });
  }

  function recordProgress(nodeId, status, options) {
    if (!state.courseSlug || !nodeId || !state.data) return;
    options = options || {};
    var nodes = Object.assign({}, state.courseProgress.nodes);
    var prev = nodes[nodeId];
    if (status === "visited" && prev === "completed" && !options.allowDowngrade) {
      /* keep completed */
    } else {
      nodes[nodeId] = status;
    }
    var lastNodeId = nodeId;
    applyProgressData({
      nodes: nodes,
      lastNodeId: lastNodeId,
      percent: computePercentFromNodes(nodes)
    });
    saveLocalProgress(state.courseSlug, nodes, lastNodeId);
    syncProgressToServer(state.courseSlug, nodeId, nodes[nodeId]);
    updateProgressUI();
  }

  function updateProgressUI() {
    if (!els.courseProgressWrap || state.screen !== "course") return;
    var pct = state.courseProgress.percent || 0;
    els.courseProgressWrap.hidden = false;
    if (els.courseProgressLabel) els.courseProgressLabel.textContent = "진도 " + pct + "%";
    if (els.courseProgressBar) els.courseProgressBar.style.width = pct + "%";
    if (els.btnMarkComplete && state.centerId && state.data) {
      var isRoot = state.centerId === state.data.rootId;
      var done = state.courseProgress.nodes[state.centerId] === "completed";
      els.btnMarkComplete.hidden = isRoot || state.admin;
      els.btnMarkComplete.classList.toggle("is-done", done);
      els.btnMarkComplete.textContent = done ? "✓ 이해 완료" : "✓ 이해했습니다";
      els.btnMarkComplete.title = done ? "다시 눌러 이해 완료 취소" : "이 주제를 이해 완료로 표시";
    }
  }

  function setScreen(screen) {
    state.screen = screen;
    var inCourse = screen === "course";
    var inCatalog = screen === "catalog";
    var inCatalogs = screen === "catalogs";
    if (els.catalogPanel) els.catalogPanel.hidden = inCourse;
    if (els.focusApp) els.focusApp.hidden = !inCourse;
    if (els.btnRefresh) els.btnRefresh.hidden = !inCourse;
    if (els.btnBack) els.btnBack.hidden = !inCourse || !state.data || state.centerId === state.data.rootId;
    if (!inCourse && els.courseProgressWrap) els.courseProgressWrap.hidden = true;
    if (els.btnBackToCatalogs) els.btnBackToCatalogs.hidden = !inCatalog;
    if (els.btnAddCatalog) els.btnAddCatalog.hidden = !state.adminCatalog || !inCatalogs;
    if (els.btnAddCourse) els.btnAddCourse.hidden = !state.adminCatalog || !inCatalog;
    if (els.btnReset) {
      els.btnReset.title = inCourse ? "과정 목록" : (inCatalog ? "카탈로그 목록" : "목록");
      els.btnReset.textContent = inCourse ? "과정 목록" : (inCatalog ? "카탈로그 목록" : "목록");
    }
  }

  function catalogProgressFor(course) {
    if (course.progress && (course.progress.lastNodeId || course.progress.percent)) {
      return course.progress;
    }
    var local = localProgressForCourse(course.slug);
    if (!local.lastNodeId && !(local.nodes && Object.keys(local.nodes).length)) return null;
    return {
      percent: (course.progress && course.progress.percent) || 0,
      lastNodeId: local.lastNodeId,
      nodes: local.nodes || {}
    };
  }

  function sortCatalogCourses(courses) {
    return courses.slice().sort(function (a, b) {
      var pa = catalogProgressFor(a);
      var pb = catalogProgressFor(b);
      var aActive = pa && pa.lastNodeId && (pa.percent || 0) < 100;
      var bActive = pb && pb.lastNodeId && (pb.percent || 0) < 100;
      if (aActive !== bActive) return aActive ? -1 : 1;
      var ao = a.order != null ? a.order : 999;
      var bo = b.order != null ? b.order : 999;
      return ao - bo;
    });
  }

  function findResumeCourse() {
    var best = null;
    var bestPct = -1;
    var courses = state.allCourses || state.catalog || [];
    courses.forEach(function (course) {
      if (!canAccessCatalog(course.catalogSlug)) return;
      var prog = catalogProgressFor(course);
      if (!prog || !prog.lastNodeId) return;
      var pct = prog.percent || 0;
      if (pct >= 100) return;
      if (pct > bestPct) {
        bestPct = pct;
        best = { course: course, progress: prog };
      }
    });
    return best;
  }

  function renderResumeBanner() {
    if (!els.catalogResume || !els.btnCatalogResume) return;
    var resume = findResumeCourse();
    if (!resume) {
      els.catalogResume.hidden = true;
      return;
    }
    var title = resume.course.title || resume.course.slug;
    var pct = resume.progress.percent || 0;
    var catalogLabel = resume.course.catalogTitle ? resume.course.catalogTitle + " · " : "";
    els.btnCatalogResume.textContent = "▶ " + catalogLabel + title + " 이어하기 (" + pct + "%)";
    els.btnCatalogResume.dataset.slug = resume.course.slug;
    els.btnCatalogResume.dataset.catalogSlug = resume.course.catalogSlug || "";
    els.btnCatalogResume.dataset.nodeId = resume.progress.lastNodeId || "";
    els.catalogResume.hidden = false;
  }

  function updateGoalsUI() {
    if (!els.catalogGoals) return;
    if (!state.user) {
      els.catalogGoals.hidden = true;
      return;
    }
    els.catalogGoals.hidden = false;
    if (els.goalsInput) els.goalsInput.value = state.user.goals || "";
  }

  function saveGoals() {
    if (!state.user || !els.goalsInput) return;
    var goals = els.goalsInput.value.trim();
    fetch("/api/auth/goals", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: goals })
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || "저장 실패");
          return;
        }
        state.user = result.data.user;
        toast("학습 목표를 저장했습니다");
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다");
      });
  }

  function slugifyTitle(title) {
    return String(title || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
  }

  function enterCatalogAdmin(pin) {
    state.adminCatalog = true;
    state.adminPin = pin || "";
    if (els.catalogAdminBar) els.catalogAdminBar.hidden = false;
    if (els.adminOverlay) els.adminOverlay.hidden = true;
    if (els.btnAdmin) {
      els.btnAdmin.textContent = "운영중";
      els.btnAdmin.setAttribute("aria-pressed", "true");
    }
    setScreen(state.screen);
    toast("카탈로그 운영 모드");
    renderListPanel();
  }

  function exitCatalogAdmin() {
    state.adminCatalog = false;
    state.adminPin = "";
    if (els.catalogAdminBar) els.catalogAdminBar.hidden = true;
    if (els.btnAdmin) {
      els.btnAdmin.textContent = "운영";
      els.btnAdmin.setAttribute("aria-pressed", "false");
    }
    setScreen(state.screen);
    renderListPanel();
  }

  function openCatalogFormModal(mode, catalog) {
    if (!els.catalogFormOverlay) return;
    state.catalogFormMode = mode === "edit" ? "edit" : "add";
    var isEdit = state.catalogFormMode === "edit";
    if (els.catalogFormTitle) {
      els.catalogFormTitle.textContent = isEdit ? "카탈로그 편집" : "새 카탈로그";
    }
    if (els.catalogFormHint) {
      els.catalogFormHint.textContent = isEdit
        ? "카탈로그 정보를 수정합니다. slug는 변경할 수 없습니다."
        : "먼저 카탈로그를 만든 뒤, 그 안에 과정을 추가하세요.";
    }
    if (els.catalogFormSlug) {
      els.catalogFormSlug.value = (catalog && catalog.slug) || "";
      els.catalogFormSlug.readOnly = isEdit;
      els.catalogFormSlug.classList.toggle("is-readonly", isEdit);
    }
    if (els.catalogFormTitleInput) els.catalogFormTitleInput.value = (catalog && catalog.title) || "";
    if (els.catalogFormDesc) els.catalogFormDesc.value = (catalog && catalog.description) || "";
    if (els.catalogFormSubmit) els.catalogFormSubmit.textContent = isEdit ? "저장" : "만들기";
    els.catalogFormOverlay.hidden = false;
    if (els.catalogFormTitleInput) els.catalogFormTitleInput.focus();
  }

  function closeCatalogFormModal() {
    if (els.catalogFormOverlay) els.catalogFormOverlay.hidden = true;
    if (els.catalogFormSlug) {
      els.catalogFormSlug.readOnly = false;
      els.catalogFormSlug.classList.remove("is-readonly");
    }
    state.catalogFormMode = "add";
  }

  function submitCatalogForm() {
    var slug = els.catalogFormSlug && els.catalogFormSlug.value.trim();
    var title = els.catalogFormTitleInput && els.catalogFormTitleInput.value.trim();
    var description = els.catalogFormDesc && els.catalogFormDesc.value.trim();
    if (!slug && title) slug = slugifyTitle(title);
    if (!slug || !title) {
      toast("slug와 제목을 입력하세요");
      return;
    }
    var isEdit = state.catalogFormMode === "edit";
    fetch("/api/catalogs", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: state.adminPin,
        slug: slug,
        title: title,
        description: description
      })
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || (isEdit ? "카탈로그 수정 실패" : "카탈로그 생성 실패"));
          return;
        }
        closeCatalogFormModal();
        if (isEdit) {
          loadCatalogsHome();
          toast("카탈로그가 수정되었습니다: " + title);
        } else {
          showCatalogCourses(slug);
          toast("카탈로그가 만들어졌습니다 — 이제 과정을 추가하세요");
        }
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다");
      });
  }

  function openCatalogAddModal() {
    openCatalogFormModal("add", null);
  }

  function openCatalogEditModal(slug) {
    var catalog = (state.catalogs || []).find(function (c) { return c.slug === slug; });
    if (!catalog) {
      toast("카탈로그를 찾을 수 없습니다");
      return;
    }
    openCatalogFormModal("edit", catalog);
  }

  function openCourseFormModal(mode, course) {
    if (!els.courseAddOverlay) return;
    state.courseFormMode = mode === "edit" ? "edit" : "add";
    var isEdit = state.courseFormMode === "edit";
    if (els.courseFormTitle) {
      els.courseFormTitle.textContent = isEdit ? "과정 편집" : "새 과정 추가";
    }
    if (els.courseFormHint) {
      els.courseFormHint.textContent = isEdit
        ? "카탈로그 카드에 반영됩니다. 제목·부제는 과정 루트에도 동기화됩니다."
        : "slug는 영문·숫자·하이픈만 (예: who-is-jesus)";
    }
    if (els.courseAddSlug) {
      els.courseAddSlug.value = (course && course.slug) || "";
      els.courseAddSlug.readOnly = isEdit;
      els.courseAddSlug.classList.toggle("is-readonly", isEdit);
    }
    if (els.courseAddTitle) els.courseAddTitle.value = (course && course.title) || "";
    if (els.courseAddSubtitle) els.courseAddSubtitle.value = (course && course.subtitle) || "";
    if (els.courseAddDesc) els.courseAddDesc.value = (course && course.description) || "";
    if (els.courseAddSubmit) els.courseAddSubmit.textContent = isEdit ? "저장" : "만들기";
    els.courseAddOverlay.hidden = false;
    if (els.courseAddTitle) els.courseAddTitle.focus();
  }

  function openCourseAddModal() {
    if (!state.activeCatalogSlug) {
      toast("먼저 카탈로그를 선택하세요");
      return;
    }
    openCourseFormModal("add", null);
  }

  function openCourseEditModal(slug) {
    var course = (state.catalog || []).find(function (c) { return c.slug === slug; });
    if (!course) {
      toast("과정을 찾을 수 없습니다");
      return;
    }
    openCourseFormModal("edit", course);
  }

  function closeCourseAddModal() {
    if (els.courseAddOverlay) els.courseAddOverlay.hidden = true;
    if (els.courseAddSlug) {
      els.courseAddSlug.readOnly = false;
      els.courseAddSlug.classList.remove("is-readonly");
    }
    state.courseFormMode = "add";
  }

  function submitCourseForm() {
    var slug = els.courseAddSlug && els.courseAddSlug.value.trim();
    var title = els.courseAddTitle && els.courseAddTitle.value.trim();
    var subtitle = els.courseAddSubtitle && els.courseAddSubtitle.value.trim();
    var description = els.courseAddDesc && els.courseAddDesc.value.trim();
    if (!slug && title) slug = slugifyTitle(title);
    if (!slug || !title) {
      toast("slug와 제목을 입력하세요");
      return;
    }
    var isEdit = state.courseFormMode === "edit";
    fetch("/api/courses", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: state.adminPin,
        catalogSlug: state.activeCatalogSlug,
        slug: slug,
        title: title,
        subtitle: subtitle,
        description: description
      })
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || (isEdit ? "과정 수정 실패" : "과정 생성 실패"));
          return;
        }
        closeCourseAddModal();
        loadCatalogCourses(state.activeCatalogSlug);
        if (isEdit && state.screen === "course" && state.courseSlug === slug) {
          loadMindmap(true).then(function () {
            toast("과정이 수정되었습니다 — 화면을 갱신했습니다");
          });
        } else {
          toast(isEdit ? "과정이 수정되었습니다: " + title : "과정이 추가되었습니다: " + title);
        }
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다");
      });
  }

  function renderAdminUsersList(users) {
    if (!els.adminUsersList) return;
    if (!users || !users.length) {
      els.adminUsersList.innerHTML = '<p class="admin-hint">등록된 회원이 없습니다.</p>';
      return;
    }
    els.adminUsersList.innerHTML =
      '<table class="admin-users-table"><thead><tr>' +
      "<th>이름</th><th>이메일</th><th>목표</th><th>진도</th><th>가입</th>" +
      "</tr></thead><tbody>" +
      users.map(function (u) {
        var goals = (u.goals || "").trim();
        var goalsShort = goals.length > 40 ? goals.slice(0, 40) + "…" : (goals || "—");
        return (
          "<tr>" +
          "<td>" + esc(u.name || "—") + "</td>" +
          "<td>" + esc(u.email) + "</td>" +
          "<td>" + esc(goalsShort) + "</td>" +
          "<td>" + esc(String(u.courseCount || 0) + "과정 · " + String(u.nodeCount || 0) + "노드") + "</td>" +
          "<td>" + esc((u.createdAt || "").slice(0, 10)) + "</td>" +
          "</tr>"
        );
      }).join("") +
      "</tbody></table>";
  }

  function openAdminUsersModal() {
    if (!els.adminUsersOverlay) return;
    els.adminUsersList.innerHTML = '<p class="admin-hint">불러오는 중…</p>';
    els.adminUsersOverlay.hidden = false;
    fetch("/api/admin/users?pin=" + encodeURIComponent(state.adminPin))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) {
          els.adminUsersList.innerHTML = '<p class="admin-hint">회원 목록을 불러올 수 없습니다</p>';
          return;
        }
        renderAdminUsersList(data.users);
      })
      .catch(function () {
        els.adminUsersList.innerHTML = '<p class="admin-hint">서버 연결 실패</p>';
      });
  }

  function renderCatalogsList() {
    if (!els.catalogList) return;
    var catalogs = catalogsForDisplay().sort(function (a, b) {
      return (a.order || 999) - (b.order || 999);
    });
    if (!catalogs.length) {
      els.catalogList.innerHTML = '<p class="catalog-lead">등록된 카탈로그가 없습니다. 운영자 모드에서 「+ 카탈로그 추가」로 시작하세요.</p>';
      renderResumeBanner();
      return;
    }
    els.catalogList.innerHTML = catalogs.map(function (catalog) {
      var editBtn = state.adminCatalog
        ? '<button type="button" class="catalog-card-edit" data-catalog-slug="' + esc(catalog.slug) + '" title="카탈로그 편집">편집</button>'
        : "";
      var draftBadge = (state.adminCatalog && !isCatalogPublished(catalog))
        ? '<span class="catalog-card__draft">비공개</span>'
        : "";
      return (
        '<div class="catalog-card-wrap' + (state.adminCatalog ? " is-admin" : "") + '">' +
        '<button type="button" class="catalog-card" data-catalog-slug="' + esc(catalog.slug) + '">' +
        '<span class="catalog-card__title">' + esc(catalog.title || catalog.slug) + draftBadge + "</span>" +
        (catalog.description ? '<span class="catalog-card__desc">' + esc(catalog.description) + "</span>" : "") +
        '<span class="catalog-card__meta"><span>과정 열기 →</span></span>' +
        "</button>" + editBtn + "</div>"
      );
    }).join("");
    renderResumeBanner();
  }

  function renderCoursesList() {
    if (!els.catalogList) return;
    var courses = sortCatalogCourses(state.catalog || []);
    if (!courses.length) {
      els.catalogList.innerHTML = '<p class="catalog-lead">이 카탈로그에 과정이 없습니다. 운영자 모드에서 「+ 과정 추가」로 시작하세요.</p>';
      return;
    }
    els.catalogList.innerHTML = courses.map(function (course) {
      var prog = catalogProgressFor(course);
      var pct = (prog && prog.percent) || 0;
      var resume = prog && prog.lastNodeId;
      var editBtn = state.adminCatalog
        ? '<button type="button" class="catalog-card-edit" data-slug="' + esc(course.slug) + '" title="과정 편집">편집</button>'
        : "";
      return (
        '<div class="catalog-card-wrap' + (state.adminCatalog ? " is-admin" : "") + '">' +
        '<button type="button" class="catalog-card" data-slug="' + esc(course.slug) + '">' +
        '<span class="catalog-card__title">' + esc(course.title || course.slug) + "</span>" +
        (course.subtitle ? '<span class="catalog-card__subtitle">' + esc(course.subtitle) + "</span>" : "") +
        (course.description ? '<span class="catalog-card__desc">' + esc(course.description) + "</span>" : "") +
        '<span class="catalog-card__meta">' +
        '<span class="catalog-card__track"><span class="catalog-card__bar" style="width:' + pct + '%"></span></span>' +
        "<span>" + pct + "%" + (resume ? " · 이어하기" : "") + "</span>" +
        "</span></button>" + editBtn + "</div>"
      );
    }).join("");
  }

  function renderListPanel() {
    if (state.screen === "catalogs") renderCatalogsList();
    else if (state.screen === "catalog") renderCoursesList();
  }

  function loadAllCourses() {
    return fetch("/api/courses", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("api");
        return res.json();
      })
      .then(function (data) {
        state.allCourses = (data && data.ok && data.courses) ? data.courses : [];
        return state.allCourses;
      })
      .catch(function () {
        return loadCatalogsIndex().then(function (catalogs) {
          if (!catalogs.length) {
            state.allCourses = [];
            return [];
          }
          return Promise.all(catalogs.map(function (cat) {
            return fetch(staticCatalogCoursesPath(cat.slug))
              .then(function (res) { return res.ok ? res.json() : { courses: [] }; })
              .then(function (data) {
                return enrichCatalogCourses(data.courses || [], cat.slug);
              })
              .catch(function () { return []; });
          })).then(function (lists) {
            state.allCourses = [].concat.apply([], lists);
            return state.allCourses;
          });
        });
      });
  }

  function loadCatalogsIndex() {
    function loadStaticIndex() {
      var url = staticCatalogsIndexPath();
      return fetch(url, { cache: "no-cache" })
        .then(function (res) {
          if (!res.ok) throw new Error("static " + res.status);
          return res.json();
        })
        .then(function (data) {
          state.catalogs = data.catalogs || [];
          return state.catalogs;
        })
        .catch(function () {
          state.catalogs = [];
          return [];
        });
    }

    if (!isLocalDevHost()) return loadStaticIndex();

    return fetch("/api/catalogs", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("api");
        return res.json();
      })
      .then(function (data) {
        state.catalogs = (data && data.ok && data.catalogs) ? data.catalogs : [];
        return state.catalogs;
      })
      .catch(function () {
        return loadStaticIndex();
      });
  }

  function loadCatalogCourses(catalogSlug) {
    if (!catalogSlug) return Promise.resolve([]);
    return fetch("/api/courses?catalog=" + encodeURIComponent(catalogSlug), { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("api");
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.courses) {
          state.catalog = data.courses;
        } else {
          state.catalog = [];
        }
        return state.catalog;
      })
      .catch(function () {
        return fetch(staticCatalogCoursesPath(catalogSlug))
          .then(function (res) {
            if (!res.ok) throw new Error("static");
            return res.json();
          })
          .then(function (data) {
            state.catalog = enrichCatalogCourses(data.courses || [], catalogSlug);
            return state.catalog;
          })
          .catch(function () {
            state.catalog = [];
            return [];
          });
      });
  }

  function updateCatalogHeader() {
    if (state.screen === "catalogs") {
      if (els.catalogTitle) els.catalogTitle.textContent = "카탈로그";
      if (els.catalogLead) els.catalogLead.textContent = "학습 카탈로그를 선택하세요. 카탈로그 안에 과정이 있습니다.";
      if (els.catalogGoals) els.catalogGoals.hidden = !state.user;
      return;
    }
    if (state.screen === "catalog") {
      var meta = (state.catalogs || []).find(function (c) { return c.slug === state.activeCatalogSlug; });
      if (els.catalogTitle) els.catalogTitle.textContent = (meta && meta.title) || state.activeCatalogSlug || "과정";
      if (els.catalogLead) els.catalogLead.textContent = (meta && meta.description) || "이 카탈로그의 과정을 선택하세요.";
      if (els.catalogGoals) els.catalogGoals.hidden = true;
      if (els.catalogResume) els.catalogResume.hidden = true;
    }
  }

  function loadCatalogsHome() {
    return loadCatalogsIndex()
      .then(function () {
        updateCatalogHeader();
        renderListPanel();
        loadAllCourses().then(function () {
          if (state.screen === "catalogs") renderResumeBanner();
        });
        return state.catalogs;
      });
  }

  function showCatalogsHome() {
    if (state.admin) exitAdmin();
    state.activeCatalogSlug = null;
    state.courseSlug = null;
    state.data = null;
    state.centerId = null;
    state.explored = [];
    state.catalog = [];
    setScreen("catalogs");
    history.replaceState(null, "", location.pathname + location.search + "#catalogs");
    updateGoalsUI();
    if (els.catalogList && !els.catalogList.querySelector(".catalog-card")) {
      els.catalogList.innerHTML = '<p class="catalog-lead">불러오는 중…</p>';
    }
    return loadCatalogsHome();
  }

  function showCatalogCourses(catalogSlug) {
    if (!catalogSlug) return showCatalogsHome();
    if (state.admin) exitAdmin();
    return loadCatalogsIndex()
      .then(function () {
        if (!canAccessCatalog(catalogSlug)) {
          toast("아직 공개되지 않은 카탈로그입니다");
          return showCatalogsHome();
        }
        state.activeCatalogSlug = catalogSlug;
        state.courseSlug = null;
        state.data = null;
        state.centerId = null;
        state.explored = [];
        setScreen("catalog");
        history.replaceState(null, "", location.pathname + location.search + "#catalog/" + encodeURIComponent(catalogSlug));
        return loadCatalogCourses(catalogSlug);
      })
      .then(function (result) {
        if (!result || state.screen !== "catalog") return result;
        updateCatalogHeader();
        renderListPanel();
        setScreen("catalog");
        return state.catalog;
      });
  }

  function openCourse(slug, nodeId, catalogSlug) {
    if (!slug) return Promise.resolve(null);
    var restoreCatalogAdmin = state.adminCatalog;
    var savedAdminPin = state.adminPin;
    if (state.admin) exitAdmin();
    if (state.adminCatalog) exitCatalogAdmin();
    if (catalogSlug) state.activeCatalogSlug = catalogSlug;
    else if (!state.activeCatalogSlug) {
      var found = (state.allCourses || []).find(function (c) { return c.slug === slug; });
      if (found && found.catalogSlug) state.activeCatalogSlug = found.catalogSlug;
    }

    function proceed() {
      var allowed = !state.activeCatalogSlug
        || canAccessCatalog(state.activeCatalogSlug)
        || (restoreCatalogAdmin && !isCatalogPublished(catalogBySlug(state.activeCatalogSlug)));
      if (!allowed) {
        toast("아직 공개되지 않은 과정입니다");
        return showCatalogsHome();
      }
      if (restoreCatalogAdmin) {
        state.adminCatalog = true;
        state.adminPin = savedAdminPin;
        if (els.btnAdmin) {
          els.btnAdmin.textContent = "운영중";
          els.btnAdmin.setAttribute("aria-pressed", "true");
        }
      }
      state.courseSlug = slug;
      setScreen("course");
      return loadCourseProgress(slug).then(function () {
        return loadMindmap(false, nodeId || state.courseProgress.lastNodeId);
      });
    }

    if (state.activeCatalogSlug) return proceed();
    return loadCatalogsIndex()
      .then(function () { return loadAllCourses(); })
      .then(function () {
        var match = (state.allCourses || []).find(function (c) { return c.slug === slug; });
        if (match && match.catalogSlug) state.activeCatalogSlug = match.catalogSlug;
        return proceed();
      });
  }

  function updateAccountButton() {
    if (!els.btnAccount) return;
    els.btnAccount.hidden = false;
    if (state.user) {
      var label = state.user.name || state.user.email || "회원";
      els.btnAccount.textContent = label;
      els.btnAccount.title = "로그아웃";
    } else {
      els.btnAccount.textContent = "로그인";
      els.btnAccount.title = "로그인·가입";
    }
  }

  function fetchCurrentUser() {
    return fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.user = data && data.ok ? data.user : null;
        updateAccountButton();
        updateGoalsUI();
        return state.user;
      })
      .catch(function () {
        state.user = null;
        updateAccountButton();
        return null;
      });
  }

  function openAuthOverlay(mode) {
    if (!els.authOverlay) return;
    state.authMode = mode === "register" ? "register" : "login";
    if (els.authModalTitle) {
      els.authModalTitle.textContent = state.authMode === "register" ? "가입" : "로그인";
    }
    if (els.authSubmit) {
      els.authSubmit.textContent = state.authMode === "register" ? "가입" : "로그인";
    }
    if (els.authNameRow) els.authNameRow.hidden = state.authMode !== "register";
    if (els.authToggleMode) {
      els.authToggleMode.textContent = state.authMode === "register"
        ? "이미 계정이 있으신가요? 로그인"
        : "계정이 없으신가요? 가입";
    }
    els.authOverlay.hidden = false;
    if (els.authEmail) els.authEmail.focus();
  }

  function closeAuthOverlay() {
    if (els.authOverlay) els.authOverlay.hidden = true;
    if (els.authPassword) els.authPassword.value = "";
    if (els.authName) els.authName.value = "";
  }

  function submitAuth() {
    var email = els.authEmail && els.authEmail.value.trim();
    var password = els.authPassword && els.authPassword.value;
    var name = els.authName && els.authName.value.trim();
    if (!email || !password) {
      toast("이메일과 비밀번호를 입력하세요");
      return;
    }
    var path = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    var body = { email: email, password: password };
    if (state.authMode === "register") body.name = name;
    fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || "인증에 실패했습니다");
          return;
        }
        state.user = result.data.user;
        updateAccountButton();
        updateGoalsUI();
        closeAuthOverlay();
        if (state.screen === "course" && state.courseSlug) {
          loadCourseProgress(state.courseSlug).then(function () {
            renderFocus("static");
            updateProgressUI();
          });
        } else {
          loadCatalogsHome();
        }
        toast(state.authMode === "register" ? "가입되었습니다" : "로그인되었습니다");
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다 — serve.bat으로 실행하세요");
      });
  }

  function logoutUser() {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .then(function () {
        state.user = null;
        updateAccountButton();
        updateGoalsUI();
        loadCatalogsHome();
        toast("로그아웃되었습니다");
      })
      .catch(function () {
        state.user = null;
        updateAccountButton();
        updateGoalsUI();
      });
  }

  function initAuth() {
    if (!els.btnAccount) return;
    els.btnAccount.addEventListener("click", function () {
      if (state.user) logoutUser();
      else openAuthOverlay("login");
    });
    if (els.authCancel) els.authCancel.addEventListener("click", closeAuthOverlay);
    if (els.authSubmit) els.authSubmit.addEventListener("click", submitAuth);
    if (els.authToggleMode) {
      els.authToggleMode.addEventListener("click", function () {
        openAuthOverlay(state.authMode === "register" ? "login" : "register");
      });
    }
    if (els.authPassword) {
      els.authPassword.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") submitAuth();
      });
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.hidden = true; }, 2800);
  }

  function nodeById(id) {
    if (!state.data) return null;
    return state.data.nodes.find(function (n) { return n.id === id; });
  }

  function isAtRoot() {
    return state.data && state.centerId === state.data.rootId;
  }

  function getDepth() {
    if (!state.data || isAtRoot()) return 0;
    var idx = state.explored.indexOf(state.centerId);
    if (idx > 0) return idx;
    return Math.max(0, state.explored.length - 1);
  }

  function nextTier() {
    return getDepth() + 1;
  }

  function lessonNumFromTitle(title) {
    var m = (title || "").match(/^제\s*(\d+)\s*과/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function isLessonTitle(title) {
    return /^제\s*\d+\s*과/.test(title || "");
  }

  function flatLessonCatalogList() {
    if (!state.data) return null;
    var kids = childrenOf(state.data.rootId);
    if (kids.length < 3) return null;
    if (!kids.every(function (n) { return childrenOf(n.id).length === 0; })) return null;
    var lessonCount = kids.filter(function (n) { return isLessonTitle(n.title); }).length;
    if (lessonCount < Math.max(3, Math.ceil(kids.length * 0.75))) return null;
    return kids.slice().sort(function (a, b) {
      return lessonNumFromTitle(a.title) - lessonNumFromTitle(b.title);
    });
  }

  function isFlatLessonCatalogAtRoot() {
    return !!flatLessonCatalogList();
  }

  function isLinearChainAtRoot() {
    if (!state.data) return false;
    var first = childrenOf(state.data.rootId);
    if (first.length !== 1) return false;
    return linearChainFrom(first[0].id).length >= 5;
  }

  function isLinearCourse() {
    if (!state.data) return false;
    if (state.data.meta && state.data.meta.layout === "linear") return true;
    if (isFlatLessonCatalogAtRoot()) return true;
    if (isLinearChainAtRoot()) return true;
    return false;
  }

  function linearCourseDebugInfo() {
    if (!state.data) return { ok: false };
    var rootId = state.data.rootId;
    var rootKids = childrenOf(rootId);
    var flat = flatLessonCatalogList();
    var chainLen = rootKids.length === 1 ? linearChainFrom(rootKids[0].id).length : 0;
    return {
      courseSlug: state.courseSlug,
      metaLayout: state.data.meta && state.data.meta.layout,
      rootChildCount: rootKids.length,
      rootChildTitles: rootKids.slice(0, 3).map(function (n) { return n.title; }),
      flatCatalogCount: flat ? flat.length : 0,
      chainLen: chainLen,
      isLinear: isLinearCourse(),
      appJsHint: "v11-debug"
    };
  }

  function linearChainFrom(startId) {
    var chain = [];
    var cur = startId;
    var guard = 0;
    while (cur && guard < 256) {
      var n = nodeById(cur);
      if (!n) break;
      chain.push(n);
      var kids = childrenOf(cur);
      if (kids.length !== 1) break;
      cur = kids[0].id;
      guard += 1;
    }
    return chain;
  }

  function linearCourseLessons() {
    if (!state.data) return [];
    var first = childrenOf(state.data.rootId);
    if (!first.length) return [];
    return linearChainFrom(first[0].id);
  }

  function crossChildrenOf(parentId) {
    if (!state.data) return [];
    return state.data.edges
      .filter(function (e) { return e.from === parentId && e.type === "cross"; })
      .map(function (e) { return nodeById(e.to); })
      .filter(Boolean);
  }

  function visibleChildren(parentId) {
    if (!state.data) return [];
    if (parentId === state.data.rootId && isLinearCourse()) {
      var flat = flatLessonCatalogList();
      if (flat) return flat;
      return linearCourseLessons();
    }
    if (isLinearCourse() && parentId !== state.data.rootId) {
      var next = crossChildrenOf(parentId);
      if (next.length) return next;
    }
    return childrenOf(parentId);
  }

  function normalizeMindmap(data) {
    if (!data || !data.nodes || !data.rootId) return data;
    var root = nodeByIdIn(data, data.rootId);
    if (!root) return data;
    if (!data.edges) data.edges = [];

    var incoming = {};
    data.edges.forEach(function (e) {
      if (e.type !== "cross") incoming[e.to] = true;
    });
    data.nodes.forEach(function (n) {
      if (n.id === data.rootId || incoming[n.id]) return;
      data.edges.push({
        id: "eorphan-" + n.id,
        from: data.rootId,
        to: n.id,
        type: "hierarchy"
      });
      incoming[n.id] = true;
    });
    return data;
  }

  function nodeByIdIn(data, id) {
    return data.nodes.find(function (n) { return n.id === id; });
  }

  function updateAdminButtons() {
    if (!state.admin || !els.btnAddChild) return;
    els.btnAddChild.textContent = isAtRoot()
      ? "1단계 주제 추가"
      : nextTier() + "단계 주제 추가";
  }

  function getEditNodeId() {
    return state.adminEditId || state.centerId;
  }

  function getEditNode() {
    return nodeById(getEditNodeId());
  }

  function parentOf(id) {
    if (!state.data || id === state.data.rootId) return null;
    var edge = state.data.edges.find(function (e) {
      return e.to === id && e.type !== "cross";
    });
    return edge ? edge.from : null;
  }

  function buildExploredPath(id) {
    var chain = [];
    var cur = id;
    var guard = 0;
    while (cur && guard < 64) {
      chain.unshift(cur);
      if (cur === state.data.rootId) break;
      cur = parentOf(cur);
      guard += 1;
    }
    if (chain[0] !== state.data.rootId) chain.unshift(state.data.rootId);
    return chain;
  }

  function childrenOf(parentId) {
    if (!state.data) return [];
    return state.data.edges
      .filter(function (e) { return e.from === parentId && e.type !== "cross"; })
      .map(function (e) { return e.to; })
      .map(function (id) { return nodeById(id); })
      .filter(Boolean);
  }

  function subtreeMaxTierFrom(nodeId, tier) {
    var kids = childrenOf(nodeId);
    if (!kids.length) return tier;
    return Math.max.apply(null, kids.map(function (child) {
      return subtreeMaxTierFrom(child.id, tier + 1);
    }));
  }

  function subtreeDescendantCount(nodeId) {
    var kids = childrenOf(nodeId);
    if (!kids.length) return 0;
    return kids.reduce(function (sum, child) {
      return sum + 1 + subtreeDescendantCount(child.id);
    }, 0);
  }

  function l1AdminMeta(nodeId) {
    var maxTier = subtreeMaxTierFrom(nodeId, 1);
    var descendants = subtreeDescendantCount(nodeId);
    if (maxTier <= 1) return "하위 없음";
    if (descendants > 0) {
      return maxTier + "단계까지 · 하위 " + descendants + "개";
    }
    return maxTier + "단계까지";
  }

  function descendantIds(nodeId) {
    var out = [];
    function walk(id) {
      childrenOf(id).forEach(function (child) {
        out.push(child.id);
        walk(child.id);
      });
    }
    walk(nodeId);
    return out;
  }

  function nodePathLabel(id) {
    return buildExploredPath(id).map(function (pid) {
      if (pid === state.data.rootId) return "홈";
      var n = nodeById(pid);
      return (n && n.title) || pid;
    }).join(" › ");
  }

  function nodeTier(id) {
    if (!state.data || id === state.data.rootId) return 0;
    return buildExploredPath(id).length - 1;
  }

  function parentOptionLabel(targetId, movingId) {
    if (targetId === state.data.rootId) return "홈 (1단계로)";
    var n = nodeById(targetId);
    var title = (n && n.title) || targetId;
    if (nodeTier(movingId) === 1 && nodeTier(targetId) === 1) {
      return "1단계 「" + title + "」 아래로 (→ 2단계)";
    }
    return nodePathLabel(targetId) + " 아래로";
  }

  function validParentOptions(nodeId) {
    var blocked = {};
    blocked[nodeId] = true;
    descendantIds(nodeId).forEach(function (id) { blocked[id] = true; });
    var options = state.data.nodes
      .filter(function (n) { return n.id !== state.data.rootId && !blocked[n.id]; })
      .map(function (n) {
        return {
          id: n.id,
          label: parentOptionLabel(n.id, nodeId),
          tier: nodeTier(n.id)
        };
      });
    options.sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.label.localeCompare(b.label, "ko");
    });
    options.unshift({ id: state.data.rootId, label: "홈 (1단계로)" });
    return options;
  }

  function setNodeParent(nodeId, newParentId) {
    var edge = state.data.edges.find(function (e) {
      return e.to === nodeId && e.type !== "cross";
    });
    if (edge) {
      edge.from = newParentId;
      return;
    }
    state.data.edges.push({
      id: "e" + nodeId,
      from: newParentId,
      to: nodeId,
      type: "hierarchy"
    });
  }

  function moveNodeToParent(nodeId, newParentId, mode) {
    if (!nodeId || nodeId === state.data.rootId) return false;
    if (newParentId === nodeId) return false;
    if (descendantIds(nodeId).indexOf(newParentId) >= 0) return false;
    if (!nodeById(newParentId)) return false;

    mode = mode || "sibling";
    var currentParent = parentOf(nodeId);

    if (mode === "insert") {
      var adoptKids = childrenOf(newParentId).filter(function (c) {
        return c.id !== nodeId;
      });
      setNodeParent(nodeId, newParentId);
      adoptKids.forEach(function (kid) {
        var childEdge = state.data.edges.find(function (e) {
          return e.from === newParentId && e.to === kid.id && e.type !== "cross";
        });
        if (childEdge) childEdge.from = nodeId;
      });
      return true;
    }

    if (currentParent === newParentId) return false;
    setNodeParent(nodeId, newParentId);
    return true;
  }

  function siblingEdgeIndices(parentId) {
    var indices = [];
    state.data.edges.forEach(function (e, i) {
      if (e.from === parentId && e.type !== "cross") indices.push(i);
    });
    return indices;
  }

  function moveSiblingOrder(nodeId, direction) {
    if (!state.data || !nodeId || nodeId === state.data.rootId) return false;
    var parentId = parentOf(nodeId);
    if (!parentId) return false;
    var indices = siblingEdgeIndices(parentId);
    if (indices.length < 2) return false;
    var pos = -1;
    indices.forEach(function (edgeIndex, i) {
      if (state.data.edges[edgeIndex].to === nodeId) pos = i;
    });
    if (pos < 0) return false;
    var targetPos = pos + direction;
    if (targetPos < 0 || targetPos >= indices.length) return false;
    var a = indices[pos];
    var b = indices[targetPos];
    var tmp = state.data.edges[a];
    state.data.edges[a] = state.data.edges[b];
    state.data.edges[b] = tmp;
    return true;
  }

  function moveChildEdgeToIndex(parentId, childId, targetIndex) {
    var indices = siblingEdgeIndices(parentId);
    if (!indices.length || targetIndex < 0 || targetIndex >= indices.length) return;
    var fromPos = -1;
    indices.forEach(function (edgeIndex, i) {
      if (state.data.edges[edgeIndex].to === childId) fromPos = i;
    });
    if (fromPos < 0 || fromPos === targetIndex) return;
    var edgeRef = indices[fromPos];
    var edge = state.data.edges[edgeRef];
    state.data.edges.splice(edgeRef, 1);
    var indicesAfter = siblingEdgeIndices(parentId);
    var insertBefore = indicesAfter[targetIndex];
    if (insertBefore === undefined) {
      state.data.edges.push(edge);
    } else {
      state.data.edges.splice(insertBefore, 0, edge);
    }
  }

  function swapChainUp(nodeId) {
    var parentId = parentOf(nodeId);
    if (!parentId || parentId === state.data.rootId) return false;
    var grandparentId = parentOf(parentId);
    if (!grandparentId || grandparentId === state.data.rootId) return false;
    var gpChildIndices = siblingEdgeIndices(grandparentId);
    var parentPos = -1;
    gpChildIndices.forEach(function (edgeIndex, i) {
      if (state.data.edges[edgeIndex].to === parentId) parentPos = i;
    });
    if (parentPos < 0) return false;
    var nodeKidIds = childrenOf(nodeId).map(function (n) { return n.id; });
    setNodeParent(nodeId, grandparentId);
    setNodeParent(parentId, nodeId);
    nodeKidIds.forEach(function (kidId) {
      setNodeParent(kidId, parentId);
    });
    moveChildEdgeToIndex(grandparentId, nodeId, parentPos);
    return true;
  }

  function swapChainDown(nodeId) {
    var kids = childrenOf(nodeId);
    if (kids.length !== 1) return false;
    var childId = kids[0].id;
    var parentId = parentOf(nodeId);
    if (!parentId) return false;
    var siblingIndices = siblingEdgeIndices(parentId);
    var nodePos = -1;
    siblingIndices.forEach(function (edgeIndex, i) {
      if (state.data.edges[edgeIndex].to === nodeId) nodePos = i;
    });
    if (nodePos < 0) return false;
    var childKidIds = childrenOf(childId).map(function (n) { return n.id; });
    setNodeParent(childId, parentId);
    setNodeParent(nodeId, childId);
    childKidIds.forEach(function (kidId) {
      setNodeParent(kidId, nodeId);
    });
    moveChildEdgeToIndex(parentId, childId, nodePos);
    return true;
  }

  function reorderCanMoveUp(nodeId) {
    if (!nodeId || nodeId === state.data.rootId) return false;
    var parentId = parentOf(nodeId);
    if (!parentId) return false;
    var siblings = childrenOf(parentId);
    if (siblings.length >= 2) {
      return siblings.findIndex(function (n) { return n.id === nodeId; }) > 0;
    }
    var grandparentId = parentOf(parentId);
    return !!grandparentId && grandparentId !== state.data.rootId;
  }

  function reorderCanMoveDown(nodeId) {
    if (!nodeId || nodeId === state.data.rootId) return false;
    var parentId = parentOf(nodeId);
    if (!parentId) return false;
    var siblings = childrenOf(parentId);
    if (siblings.length >= 2) {
      var pos = siblings.findIndex(function (n) { return n.id === nodeId; });
      return pos >= 0 && pos < siblings.length - 1;
    }
    return childrenOf(nodeId).length === 1;
  }

  function applyNodeReorder(nodeId, direction) {
    if (direction < 0) {
      if (moveSiblingOrder(nodeId, -1)) return true;
      return swapChainUp(nodeId);
    }
    if (moveSiblingOrder(nodeId, 1)) return true;
    return swapChainDown(nodeId);
  }

  function fillReorderEditor(nodeId) {
    if (!els.reorderRow) return;
    if (!nodeId || nodeId === state.data.rootId) {
      els.reorderRow.hidden = true;
      return;
    }
    els.reorderRow.hidden = false;
    if (els.btnMoveUp) els.btnMoveUp.disabled = !reorderCanMoveUp(nodeId);
    if (els.btnMoveDown) els.btnMoveDown.disabled = !reorderCanMoveDown(nodeId);
  }

  function applyReorder(direction) {
    var nodeId = getEditNodeId();
    if (!nodeId || nodeId === state.data.rootId) {
      toast("홈 노드는 순서를 바꿀 수 없습니다");
      return;
    }
    applyEditor();
    if (!applyNodeReorder(nodeId, direction)) {
      toast(direction < 0 ? "더 위로 옮길 수 없습니다" : "더 아래로 옮길 수 없습니다");
      fillReorderEditor(nodeId);
      return;
    }
    if (state.centerId === nodeId) {
      state.explored = buildExploredPath(nodeId);
    }
    renderFocus("static");
    fillMoveEditor(nodeId);
    fillReorderEditor(nodeId);
    toast(direction < 0 ? "한 칸 위로 옮겼습니다 — 저장하세요" : "한 칸 아래로 옮겼습니다 — 저장하세요");
  }

  var MOVE_NONE = "__none__";

  function fillMoveEditor(nodeId) {
    if (!els.moveParentRow || !els.editParent) return;
    if (!nodeId || nodeId === state.data.rootId) {
      els.moveParentRow.hidden = true;
      return;
    }
    els.moveParentRow.hidden = false;
    if (els.editLocation) els.editLocation.textContent = nodePathLabel(nodeId);
    var currentParent = parentOf(nodeId) || state.data.rootId;
    var options = validParentOptions(nodeId).filter(function (opt) {
      return opt.id !== currentParent;
    });
    var html = '<option value="' + MOVE_NONE + '" selected>이동 없음 (현재 유지)</option>';
    html += options.map(function (opt) {
      return (
        '<option value="' + esc(opt.id) + '">' + esc(opt.label) + "</option>"
      );
    }).join("");
    els.editParent.innerHTML = html;
  }

  function applyMoveParent() {
    var nodeId = getEditNodeId();
    if (!nodeId || nodeId === state.data.rootId) {
      toast("홈 노드는 이동할 수 없습니다");
      return;
    }
    var newParentId = els.editParent.value;
    var moveMode = (els.editMoveMode && els.editMoveMode.value) || "insert";
    if (!newParentId || newParentId === MOVE_NONE) {
      applyEditor();
      toast("이동하지 않았습니다");
      fillMoveEditor(nodeId);
      return;
    }
    applyEditor();
    if (!moveNodeToParent(nodeId, newParentId, moveMode)) {
      toast("이동할 수 없는 위치입니다");
      fillMoveEditor(nodeId);
      return;
    }
    if (state.centerId === nodeId) {
      state.explored = buildExploredPath(nodeId);
    }
    if (state.adminEditId === nodeId || state.centerId === nodeId) {
      state.adminEditId = nodeId;
    }
    fillMoveEditor(nodeId);
    fillReorderEditor(nodeId);
    renderFocus("static");
    var parentLabel = newParentId === state.data.rootId
      ? "1단계"
      : (nodeById(newParentId).title || "상위 주제");
    var moved = nodeById(nodeId);
    var tierMsg = newParentId === state.data.rootId
      ? "1단계로 옮겼습니다"
      : moveMode === "insert"
        ? nodeTier(newParentId) + "단계 「" + parentLabel + "」와 그 아래 사이(한 단계 밀기)로 옮겼습니다"
        : nodeTier(newParentId) + "단계 「" + parentLabel + "」 아래 형제(→ " + (nodeTier(newParentId) + 1) + "단계)로 옮겼습니다";
    toast("「" + (moved.title || "주제") + "」을(를) " + tierMsg);
  }

  var REVEAL_CHAR_S = 0.038;
  var REVEAL_CHUNK_S = 0.16;

  function splitChunks(text) {
    if (!text) return [];
    var lines = text.split(/\n/);
    var out = [];
    lines.forEach(function (line, li) {
      if (!line.trim()) {
        if (li < lines.length - 1) out.push({ text: "\n", block: true });
        return;
      }
      var sents = line.match(/[^.!?。…]+[.!?。…]?/g);
      if (!sents) sents = [line];
      sents.forEach(function (s) {
        var t = s.trim();
        if (t) out.push({ text: t, block: false });
      });
      if (li < lines.length - 1) out.push({ text: "", block: true, br: true });
    });
    return out.length ? out : [{ text: text, block: false }];
  }

  function setPlainText(el, text, className) {
    el.className = className;
    el.textContent = text || "";
  }

  function revealTitle(el, text) {
    el.className = "focus-title";
    el.textContent = "";
    if (!text) return 0;
    Array.from(text).forEach(function (ch, i) {
      var s = document.createElement("span");
      s.className = "reveal-unit";
      s.style.animationDelay = (i * REVEAL_CHAR_S) + "s";
      s.textContent = ch === " " ? "\u00a0" : ch;
      el.appendChild(s);
    });
    return text.length * REVEAL_CHAR_S + 0.35;
  }

  function renderDescription(el, text, animated, startDelay) {
    var rich = window.FaithMarkdown && FaithMarkdown.isRich(text);
    if (!text) {
      el.className = "focus-desc is-empty-static";
      el.innerHTML = "";
      el.textContent = "";
      return startDelay;
    }
    if (!rich) {
      if (!animated) {
        setPlainText(el, text, "focus-desc");
        return startDelay;
      }
      return revealDescription(el, text, startDelay);
    }
    var html = FaithMarkdown.toHtml(text);
    el.className = "focus-desc is-rich";
    if (!animated) {
      el.innerHTML = html;
      return startDelay;
    }
    el.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "reveal-block desc-rich-reveal";
    wrap.style.animationDelay = startDelay + "s";
    wrap.innerHTML = html;
    el.appendChild(wrap);
    return startDelay + 0.22;
  }

  function revealDescription(el, text, startDelay) {
    el.className = "focus-desc";
    el.textContent = "";
    if (!text) {
      el.classList.add("is-empty-static");
      return startDelay;
    }
    var delay = startDelay;
    splitChunks(text).forEach(function (chunk) {
      if (chunk.br) {
        el.appendChild(document.createElement("br"));
        return;
      }
      var s = document.createElement("span");
      s.className = chunk.block ? "reveal-block" : "reveal-chunk";
      s.style.animationDelay = delay + "s";
      s.textContent = chunk.text;
      el.appendChild(s);
      if (!chunk.text) return;
      delay += REVEAL_CHUNK_S;
    });
    return delay + 0.06;
  }

  function revealScripture(el, text, startDelay) {
    el.className = "focus-scripture";
    el.textContent = "";
    if (!text) return;
    var s = document.createElement("span");
    s.className = "reveal-block";
    s.style.animationDelay = startDelay + "s";
    s.textContent = text;
    el.appendChild(s);
  }

  function revealTitleFade(el, text, startDelay) {
    el.className = "focus-title";
    el.textContent = "";
    if (!text) return startDelay;
    var s = document.createElement("span");
    s.className = "reveal-block";
    s.style.animationDelay = startDelay + "s";
    s.textContent = text;
    el.appendChild(s);
    return startDelay + 0.42;
  }

  function pulseReveal(el) {
    if (!el) return;
    el.classList.remove("is-revealing");
    void el.offsetWidth;
    el.classList.add("is-revealing");
  }

  function renderDepthBadge(atHome) {
    if (!els.focusDepth) return;
    if (atHome) {
      els.focusDepth.textContent = isLinearCourse() ? "시작 · 차례" : "시작 · 1단계 목록";
      els.focusDepth.className = "focus-depth is-home";
      els.focusDepth.hidden = false;
      return;
    }
    if (isLinearCourse()) {
      var node = nodeById(state.centerId);
      var m = node && (node.title || "").match(/^제\s*\d+\s*과/);
      els.focusDepth.textContent = m ? m[0] : getDepth() + "과";
    } else {
      els.focusDepth.textContent = getDepth() + "단계";
    }
    els.focusDepth.className = "focus-depth";
    els.focusDepth.hidden = false;
  }

  function getBranchL1Id() {
    if (!state.data || isAtRoot()) return null;
    var path = buildExploredPath(state.centerId);
    return path.length > 1 ? path[1] : null;
  }

  function outlinePathSet(currentId) {
    var set = {};
    buildExploredPath(currentId).forEach(function (id) {
      set[id] = true;
    });
    return set;
  }

  function outlineLinkClasses(nodeId, currentId, pathSet) {
    var classes = ["outline-tree-link"];
    if (nodeId === currentId) classes.push("is-current");
    else if (pathSet[nodeId]) classes.push("is-on-path");
    else classes.push("is-off-path");
    return classes.join(" ");
  }

  function renderOutlineTreeLink(node, currentId, pathSet) {
    if (!node) return "";
    var tierHtml = "";
    if (!isLinearCourse()) {
      tierHtml = '<span class="outline-tree-tier">' + nodeTier(node.id) + "단계</span>";
    }
    return (
      '<button type="button" class="' + outlineLinkClasses(node.id, currentId, pathSet) + '" data-id="' +
      esc(node.id) + '">' +
      tierHtml +
      '<span class="outline-tree-title">' + esc(node.title) + "</span>" +
      "</button>"
    );
  }

  function renderOutlineTreeHtml(parentId, currentId, pathSet) {
    var kids = childrenOf(parentId);
    if (!kids.length) return "";
    return (
      '<ul class="outline-tree">' +
      kids.map(function (child) {
        return (
          '<li class="outline-tree-node">' +
          renderOutlineTreeLink(child, currentId, pathSet) +
          renderOutlineTreeHtml(child.id, currentId, pathSet) +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  function scrollFocusToTop() {
    window.scrollTo(0, 0);
    requestAnimationFrame(function () {
      window.scrollTo(0, 0);
    });
  }

  function scrollOutlineToCurrent() {
    if (!els.outlineTree || !els.outlineTreePanel) return;
    var panel = els.outlineTreePanel;
    requestAnimationFrame(function () {
      var cur = els.outlineTree.querySelector(".outline-tree-link.is-current");
      if (!cur) return;
      var curTop = cur.offsetTop;
      var curBottom = curTop + cur.offsetHeight;
      var viewTop = panel.scrollTop;
      var viewBottom = viewTop + panel.clientHeight;
      if (curTop < viewTop + 32) {
        panel.scrollTop = Math.max(0, curTop - 32);
      } else if (curBottom > viewBottom - 16) {
        panel.scrollTop = curBottom - panel.clientHeight + 16;
      }
    });
  }

  function renderOutlineTreePanel() {
    if (!els.outlineTreePanel || !els.outlineTree) return;
    var l1Id = getBranchL1Id();
    var show = !!l1Id && state.admin;
    els.outlineTreePanel.hidden = !show;
    if (!show) {
      els.outlineTree.innerHTML = "";
      return;
    }
    var currentId = state.centerId;
    var pathSet = outlinePathSet(currentId);
    var l1Node = nodeById(l1Id);
    var branchCount = subtreeDescendantCount(l1Id);
    if (els.outlineTreeHeading) {
      els.outlineTreeHeading.textContent =
        "구조 한눈에 보기 · 현재 " + getDepth() + "단계 (" + branchCount + "개)";
    }
    els.outlineTree.innerHTML =
      '<div class="outline-tree-root-item">' +
      renderOutlineTreeLink(l1Node, currentId, pathSet) +
      "</div>" +
      renderOutlineTreeHtml(l1Id, currentId, pathSet);
    scrollOutlineToCurrent();
  }

  function renderBreadcrumb() {
    if (!state.data) return;
    if (isAtRoot()) {
      els.focusTrail.innerHTML = "";
      els.focusTrail.hidden = true;
      return;
    }
    var parts = ['<span data-id="' + esc(state.data.rootId) + '">홈</span>'];
    state.explored.slice(1).forEach(function (id) {
      var n = nodeById(id);
      var name = (n && n.title) || id;
      parts.push('<span data-id="' + esc(id) + '">' + esc(name) + "</span>");
    });
    els.focusTrail.innerHTML = parts.join(" › ");
    els.focusTrail.hidden = false;
  }

  function shouldSkipFocusDescRender() {
    return state.admin && getEditNodeId() === state.centerId;
  }

  function renderAdminEditingDescHint() {
    if (!els.focusDesc) return;
    els.focusDesc.className = "focus-desc is-admin-editing";
    els.focusDesc.textContent = "설명은 편집 패널에서 수정 중입니다.";
  }

  function renderFocus(viewMode) {
    if (!state.data || !state.centerId) return;
    var node = nodeById(state.centerId);
    if (!node) return;

    var atHome = isAtRoot();
    var title = node.title || "";
    var desc = node.description || "";
    var scripture = atHome ? "" : (node.scripture || "");
    var staticView = viewMode === "static";
    var navigate = viewMode === "navigate";
    var intro = viewMode === "intro";

    var kids = visibleChildren(state.centerId);
    var hasKids = kids.length > 0;
    var revealEnd = 0;

    if (staticView) {
      setPlainText(els.focusTitle, title, "focus-title");
      if (shouldSkipFocusDescRender()) {
        renderAdminEditingDescHint();
      } else {
        renderDescription(els.focusDesc, desc, false, 0);
      }
      setPlainText(els.focusScripture, scripture, "focus-scripture");
      els.focusCard.classList.remove("is-revealing");
      els.expandWrap.classList.remove("is-revealing");
    } else if (navigate) {
      pulseReveal(els.focusCard);
      var navTitleEnd = revealTitleFade(els.focusTitle, title, 0);
      var navDescEnd = renderDescription(els.focusDesc, desc, true, navTitleEnd + 0.04);
      revealScripture(els.focusScripture, scripture, navDescEnd);
      revealEnd = navDescEnd + (scripture ? 0.4 : 0);
    } else {
      pulseReveal(els.focusCard);
      var afterTitle = revealTitle(els.focusTitle, title);
      var afterDesc = renderDescription(els.focusDesc, desc, true, afterTitle + 0.06);
      revealScripture(els.focusScripture, scripture, afterDesc);
      revealEnd = afterDesc + (scripture ? 0.45 : 0);
    }

    var showChildren = hasKids && (atHome || state.childrenOpen || (state.admin && !atHome));

    els.focusCard.hidden = false;
    els.expandWrap.hidden = !hasKids || atHome;
    els.btnExpand.classList.toggle("is-open", state.childrenOpen && hasKids && !atHome);
    els.childrenPanel.hidden = !showChildren;
    els.childrenPanel.classList.toggle("is-home", atHome && hasKids);
    els.childrenPanel.classList.toggle("is-admin-home", atHome && hasKids && state.admin);
    if (els.childrenHeading) {
      if (atHome) {
        if (isLinearCourse() && hasKids) {
          els.childrenHeading.textContent = "과 목록 · " + kids.length + "과";
        } else {
          els.childrenHeading.textContent = hasKids
            ? (state.admin ? "1단계 주제 · 하위 단계 요약" : "1단계 주제를 선택하세요")
            : "1단계 주제가 없습니다";
        }
      } else if (isLinearCourse()) {
        els.childrenHeading.textContent = "다음 과 · 이어서";
      } else {
        els.childrenHeading.textContent = nextTier() + "단계 · 이어서 살펴보기";
      }
    }

    renderDepthBadge(atHome);

    if (intro && !staticView && hasKids && !atHome) {
      els.expandWrap.style.animationDelay = (revealEnd + 0.15) + "s";
      pulseReveal(els.expandWrap);
    } else {
      els.expandWrap.style.animationDelay = "";
      els.expandWrap.classList.remove("is-revealing");
    }

    if (showChildren) {
      var chipBase = staticView ? 0 : (navigate ? 0.05 : revealEnd + 0.2);
      var chipTier = atHome ? 1 : nextTier();
      var hideChipTier = isLinearCourse();
      var showL1AdminMeta = atHome && state.admin && !isLinearCourse();
      els.childrenList.innerHTML = kids.map(function (child, i) {
        var adminMeta = showL1AdminMeta
          ? '<span class="chip-admin-meta">' + esc(l1AdminMeta(child.id)) + "</span>"
          : "";
        var chipBody = showL1AdminMeta
          ? '<span class="chip-body"><span class="chip-title">' + esc(child.title) + "</span>" + adminMeta + "</span>"
          : '<span class="chip-title">' + esc(child.title) + "</span>";
        var tierLabel = hideChipTier
          ? (atHome ? "" : "다음")
          : (chipTier + "단계");
        var tierHtml = tierLabel
          ? '<span class="chip-tier">' + tierLabel + "</span>"
          : "";
        return (
          '<button type="button" class="child-chip' + (atHome ? " is-l1" : "") +
          (hideChipTier && atHome ? " is-linear-lesson" : "") +
          (showL1AdminMeta ? " has-admin-meta" : "") + '" data-id="' + esc(child.id) + '" ' +
          'style="animation-delay:' + (chipBase + i * 0.09) + 's">' +
          tierHtml +
          chipBody + "</button>"
        );
      }).join("");
    } else {
      els.childrenList.innerHTML = "";
    }

    els.btnBack.hidden = atHome;
    if (!atHome) {
      if (isLinearCourse() && isAtRoot() === false) {
        els.btnBack.textContent = getDepth() <= 1 ? "← 차례" : "← 이전";
      } else {
        els.btnBack.textContent = getDepth() === 1 ? "← 1단계 목록" : "← 이전";
      }
    }
    renderBreadcrumb();
    renderOutlineTreePanel();

    if (state.admin) fillEditor(getEditNode());
    updateAdminButtons();
    updateProgressUI();
    updateHash();
  }

  function lessonAccessBlocked(id) {
    if (state.user || state.admin) return false;
    if (!state.data) return false;
    return id && id !== state.data.rootId;
  }

  function promptLessonLogin() {
    toast("제1과부터는 로그인이 필요합니다");
    openAuthOverlay("login");
  }

  function openNode(id, pushTrail, viewMode) {
    if (!nodeById(id)) return;
    if (lessonAccessBlocked(id)) {
      promptLessonLogin();
      return;
    }
    if (state.admin) syncEditorToState();
    if (id === state.data.rootId) {
      state.explored = [state.data.rootId];
    } else if (pushTrail !== false) {
      if (isAtRoot() && isLinearCourse()) {
        state.explored = buildExploredPath(id);
      } else if (isAtRoot()) {
        state.explored = [state.data.rootId, id];
      } else {
        var idx = state.explored.indexOf(id);
        if (idx >= 0) state.explored = state.explored.slice(0, idx + 1);
        else state.explored.push(id);
      }
    }
    state.centerId = id;
    state.adminEditId = null;
    if (id !== state.data.rootId) state.childrenOpen = false;
    recordProgress(id, "visited");
    renderFocus(viewMode || "navigate");
    scrollFocusToTop();
  }

  function goBack() {
    if (state.explored.length <= 1) return;
    if (state.admin) syncEditorToState();
    state.explored.pop();
    state.centerId = state.explored[state.explored.length - 1];
    state.adminEditId = null;
    if (!isAtRoot()) state.childrenOpen = false;
    renderFocus("navigate");
    scrollFocusToTop();
  }

  function courseRootView() {
    if (!state.data) return;
    if (state.admin) syncEditorToState();
    state.explored = [state.data.rootId];
    state.centerId = state.data.rootId;
    state.adminEditId = null;
    state.childrenOpen = false;
    renderFocus("navigate");
    scrollFocusToTop();
  }

  function resetView() {
    if (state.screen === "course") {
      if (state.activeCatalogSlug) showCatalogCourses(state.activeCatalogSlug);
      else showCatalogsHome();
      return;
    }
    if (state.screen === "catalog") {
      showCatalogsHome();
      return;
    }
    showCatalogsHome();
  }

  function toggleChildren() {
    if (isAtRoot() || !childrenOf(state.centerId).length) return;
    state.childrenOpen = !state.childrenOpen;
    renderFocus("static");
  }

  function setPanelVisible(el, visible) {
    if (!el) return;
    if (visible) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }
  }

  function fillEditor(node) {
    if (!node) return;
    els.editTitle.value = node.title || "";
    els.editDesc.value = node.description || "";
    els.editScripture.value = node.scripture || "";
    fillMoveEditor(node.id);
    fillReorderEditor(node.id);
    fillAiDraft(node);
  }

  function fillAiDraft(node) {
    if (!els.aiQuestion) return;
    if (els.aiQuestion.dataset.nodeId !== node.id) {
      els.aiQuestion.value = node.title
        ? "「" + node.title + "」에 대해 성경적 관점에서 쉽고 따뜻하게 설명해 주세요."
        : "";
      els.aiQuestion.dataset.nodeId = node.id;
      if (els.aiAnswer) els.aiAnswer.value = "";
      setAiAnswerActions(false);
      renderAiPreview();
    }
  }

  function renderAiPreview() {
    if (!els.aiAnswerPreview) return;
    var text = (els.aiAnswer && els.aiAnswer.value.trim()) || "";
    if (!text) {
      els.aiAnswerPreview.hidden = true;
      els.aiAnswerPreview.innerHTML = "";
      return;
    }
    els.aiAnswerPreview.hidden = false;
    if (window.FaithMarkdown && FaithMarkdown.isRich(text)) {
      els.aiAnswerPreview.className = "admin-ai-preview is-rich";
      els.aiAnswerPreview.innerHTML = FaithMarkdown.toHtml(text);
    } else {
      els.aiAnswerPreview.className = "admin-ai-preview";
      els.aiAnswerPreview.textContent = text;
    }
  }

  function setAiAnswerActions(enabled) {
    if (els.btnAiInsert) els.btnAiInsert.disabled = !enabled;
    if (els.btnAiAppend) els.btnAiAppend.disabled = !enabled;
  }

  var ADMIN_PANEL_KEY = "visionforlife-admin-width";
  var ADMIN_PANEL_DEFAULT = 520;
  var ADMIN_PANEL_MIN = 280;
  var ADMIN_PANEL_GUTTER = 144;

  function clampAdminPanelWidth(width) {
    var max = Math.max(ADMIN_PANEL_MIN, window.innerWidth - ADMIN_PANEL_GUTTER);
    return Math.min(Math.max(width, ADMIN_PANEL_MIN), max);
  }

  function applyAdminPanelWidth(width) {
    var w = clampAdminPanelWidth(width);
    document.documentElement.style.setProperty("--admin-editor-width", w + "px");
    return w;
  }

  function readAdminPanelWidth() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--admin-editor-width");
    var w = parseInt(raw, 10);
    return isNaN(w) ? ADMIN_PANEL_DEFAULT : w;
  }

  function initAdminPanelResize() {
    var resizer = document.getElementById("admin-editor-resizer");
    if (!resizer) return;

    var stored = parseInt(localStorage.getItem(ADMIN_PANEL_KEY) || "", 10);
    if (!isNaN(stored)) applyAdminPanelWidth(stored);

    window.addEventListener("resize", function () {
      applyAdminPanelWidth(readAdminPanelWidth());
    });

    var startX = 0;
    var startW = ADMIN_PANEL_DEFAULT;
    var dragging = false;

    function stopDrag(e) {
      if (!dragging || (e && e.pointerId !== resizer._pointerId)) return;
      dragging = false;
      resizer._pointerId = null;
      resizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-admin");
      try { resizer.releasePointerCapture(e.pointerId); } catch (err) {}
      localStorage.setItem(ADMIN_PANEL_KEY, String(readAdminPanelWidth()));
    }

    resizer.addEventListener("pointerdown", function (e) {
      if (window.innerWidth <= 600) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = readAdminPanelWidth();
      resizer._pointerId = e.pointerId;
      resizer.classList.add("is-dragging");
      document.body.classList.add("is-resizing-admin");
      resizer.setPointerCapture(e.pointerId);
    });

    resizer.addEventListener("pointermove", function (e) {
      if (!dragging || e.pointerId !== resizer._pointerId) return;
      e.preventDefault();
      applyAdminPanelWidth(startW + (e.clientX - startX));
    });

    resizer.addEventListener("pointerup", stopDrag);
    resizer.addEventListener("pointercancel", stopDrag);

    resizer.addEventListener("dblclick", function () {
      applyAdminPanelWidth(ADMIN_PANEL_DEFAULT);
      localStorage.setItem(ADMIN_PANEL_KEY, String(ADMIN_PANEL_DEFAULT));
      toast("편집 패널 폭을 기본값으로 복원했습니다");
    });
  }

  function initFontSize() {
    var KEY = "visionforlife-fs";
    var fs = 1;
    try {
      var sv = localStorage.getItem(KEY);
      if (sv) fs = parseFloat(sv);
    } catch (e) {}
    if (isNaN(fs)) fs = 1;

    function applyFs() {
      fs = Math.min(1.4, Math.max(0.85, fs));
      document.documentElement.style.setProperty("--fs", fs.toFixed(2));
      try { localStorage.setItem(KEY, String(fs)); } catch (e) {}
    }

    applyFs();
    var up = document.getElementById("fs-up");
    var down = document.getElementById("fs-down");
    if (up) up.addEventListener("click", function () { fs += 0.1; applyFs(); });
    if (down) down.addEventListener("click", function () { fs -= 0.1; applyFs(); });
  }

  var AI_MODE_KEY = "visionforlife-ai-mode";

  function getAiAskMode() {
    if (!els.aiAskMode) return "rag";
    var picked = els.aiAskMode.querySelector('input[name="ai-ask-mode"]:checked');
    return picked && picked.value === "model" ? "model" : "rag";
  }

  function setAiAskMode(mode) {
    if (!els.aiAskMode) return;
    var val = mode === "model" ? "model" : "rag";
    var input = els.aiAskMode.querySelector('input[name="ai-ask-mode"][value="' + val + '"]');
    if (input) input.checked = true;
    updateAiModeHint();
  }

  function updateAiModeHint() {
    if (!els.aiModeHint) return;
    if (getAiAskMode() === "model") {
      els.aiModeHint.textContent = "search.db 없이 Ollama 모델 지식만으로 답합니다. 실패하면 RAG로 넘기지 않고 오류만 표시합니다.";
    } else {
      els.aiModeHint.textContent = "search.db에서 자료를 찾아 Ollama가 답합니다. 자료가 없거나 실패하면 로컬 AI로 넘기지 않고 오류만 표시합니다.";
    }
  }

  function initAiAskMode() {
    try {
      var saved = localStorage.getItem(AI_MODE_KEY);
      if (saved === "model" || saved === "rag") setAiAskMode(saved);
    } catch (e) { /* ignore */ }
    if (!els.aiAskMode) return;
    els.aiAskMode.addEventListener("change", function () {
      try { localStorage.setItem(AI_MODE_KEY, getAiAskMode()); } catch (e) { /* ignore */ }
      updateAiModeHint();
    });
    updateAiModeHint();
  }

  function setAiAnswerError(message, askMode) {
    if (!els.aiAnswerMeta) return;
    els.aiAnswerMeta.classList.remove("is-model", "is-rag");
    els.aiAnswerMeta.classList.add("is-error");
    els.aiAnswerMeta.textContent = message || "질문 실패";
    els.aiAnswerMeta.hidden = false;
  }

  function setAiAnswerMeta(data, askMode) {
    if (!els.aiAnswerMeta) return;
    var rag = (data && data.rag) || {};
    var resolved = (data && data.askMode) || askMode || "rag";
    var text = "";
    els.aiAnswerMeta.classList.remove("is-model", "is-rag", "is-error");
    if (resolved === "model") {
      els.aiAnswerMeta.classList.add("is-model");
      text = "응답 방식: 로컬 AI만 (search.db 미사용)";
    } else if (rag.sourceCount > 0) {
      els.aiAnswerMeta.classList.add("is-rag");
      text = "응답 방식: RAG — search.db 자료 " + rag.sourceCount + "건 반영";
    } else {
      els.aiAnswerMeta.classList.add("is-rag");
      text = "응답 방식: RAG — search.db 자료 " + rag.sourceCount + "건 반영";
    }
    els.aiAnswerMeta.textContent = text;
    els.aiAnswerMeta.hidden = false;
  }

  function clearAiAnswerMeta() {
    if (!els.aiAnswerMeta) return;
    els.aiAnswerMeta.hidden = true;
    els.aiAnswerMeta.textContent = "";
    els.aiAnswerMeta.classList.remove("is-model", "is-rag", "is-error");
  }

  function askLocalAi() {
    if (!els.aiQuestion || !els.btnAiAsk) return;
    var question = els.aiQuestion.value.trim();
    if (!question) {
      toast("질문을 입력하세요");
      return;
    }
    var node = getEditNode();
    var context = node ? nodePathLabel(node.id) : "";
    var askMode = getAiAskMode();
    els.btnAiAsk.disabled = true;
    els.btnAiAsk.textContent = "생성 중…";
    clearAiAnswerMeta();
    fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, context: context, mode: askMode })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.data || !result.data.ok) {
          var failMsg = (result.data && result.data.error) || "AI 응답 실패";
          setAiAnswerError(failMsg, askMode);
          throw new Error(failMsg);
        }
        if (els.aiAnswer) els.aiAnswer.value = result.data.answer || "";
        setAiAnswerActions(!!(result.data.answer || "").trim());
        renderAiPreview();
        setAiAnswerMeta(result.data, askMode);
        var rag = result.data.rag || {};
        var resolved = result.data.askMode || askMode;
        var ragMsg = "답변을 받았습니다";
        if (resolved === "model") {
          ragMsg += " (로컬 AI만)";
        } else if (rag.sourceCount > 0) {
          ragMsg += " (search.db " + rag.sourceCount + "건)";
        } else {
          ragMsg += " (RAG 검색 없음)";
        }
        ragMsg += " — 설명에 넣기를 누르세요";
        toast(ragMsg);
      })
      .catch(function (err) {
        if (els.aiAnswer) els.aiAnswer.value = "";
        setAiAnswerActions(false);
        if (!els.aiAnswerMeta || els.aiAnswerMeta.hidden) {
          setAiAnswerError(err.message || "AI 질문 실패", askMode);
        }
        renderAiPreview();
        toast(err.message || "AI 질문 실패");
      })
      .finally(function () {
        els.btnAiAsk.disabled = false;
        els.btnAiAsk.textContent = "질문하기";
      });
  }

  function insertAiAnswer(mode) {
    if (!els.aiAnswer) return;
    var answer = els.aiAnswer.value.trim();
    if (!answer) {
      toast("넣을 답변이 없습니다");
      return;
    }
    if (mode === "append" && els.editDesc.value.trim()) {
      els.editDesc.value = els.editDesc.value.trim() + "\n\n" + answer;
    } else {
      els.editDesc.value = answer;
    }
    syncEditorToState();
    if (els.aiAnswer) els.aiAnswer.value = "";
    setAiAnswerActions(false);
    clearAiAnswerMeta();
    renderAiPreview();
    toast(mode === "append" ? "설명에 추가했습니다 — 저장을 눌러 반영하세요" : "설명에 넣었습니다 — 저장을 눌러 반영하세요");
  }

  function ensureCenterNode() {
    if (!state.data) return null;
    if (!state.centerId || !nodeById(state.centerId)) {
      state.centerId = state.data.rootId;
    }
    if (!state.explored.length) state.explored = [state.centerId];
    return nodeById(state.centerId);
  }

  function enterAdmin() {
    if (!state.data) {
      toast("데이터가 없습니다 — 새로고침 후 다시 시도하세요");
      return false;
    }
    var node = ensureCenterNode();
    if (!node) {
      toast("노드 데이터 오류 — mindmap.json을 확인하세요");
      return false;
    }
    try {
      state.admin = true;
      setPanelVisible(els.adminOverlay, false);
      setPanelVisible(els.adminToolbar, true);
      setPanelVisible(els.adminEditor, true);
      setPanelVisible(els.adminEditorResizer, true);
      applyAdminPanelWidth(readAdminPanelWidth());
      els.appMain.classList.add("is-admin");
      document.body.classList.add("has-admin-toolbar");
      els.btnAdmin.textContent = "운영중";
      els.btnAdmin.setAttribute("aria-pressed", "true");
      fillEditor(node);
      state.adminEditId = null;
      renderFocus("static");
      toast("운영자 모드 — 편집 후 저장하세요");
      return true;
    } catch (err) {
      state.admin = false;
      console.error(err);
      toast("운영자 모드 진입 실패");
      return false;
    }
  }

  function exitAdmin() {
    state.admin = false;
    if (!isAtRoot()) state.childrenOpen = false;
    setPanelVisible(els.adminToolbar, false);
    setPanelVisible(els.adminEditor, false);
    setPanelVisible(els.adminEditorResizer, false);
    els.appMain.classList.remove("is-admin");
    document.body.classList.remove("has-admin-toolbar");
    els.btnAdmin.textContent = "운영";
    els.btnAdmin.setAttribute("aria-pressed", "false");
    applyEditor();
    renderFocus("static");
  }

  function syncEditorToState() {
    if (!state.admin || !state.data) return;
    var id = getEditNodeId();
    if (!id) return;
    var node = nodeById(id);
    if (!node) return;
    node.title = els.editTitle.value.trim() || "제목 없음";
    node.description = els.editDesc.value.trim();
    node.scripture = els.editScripture.value.trim();
  }

  function applyEditor() {
    syncEditorToState();
    renderFocus("static");
  }

  function onEditorInput() {
    syncEditorToState();
  }

  function newId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addChild() {
    if (!state.centerId && !isAtRoot()) {
      toast("현재 노드가 없습니다");
      return;
    }
    var parentId = isAtRoot() ? state.data.rootId : state.centerId;
    var id = newId();
    state.data.nodes.push({
      id: id,
      title: "새 질문",
      description: "",
      scripture: "",
      x: 0,
      y: 0
    });
    state.data.edges.push({
      id: "e" + id,
      from: parentId,
      to: id,
      type: "hierarchy"
    });
    if (parentId === state.data.rootId) {
      state.centerId = state.data.rootId;
      state.adminEditId = id;
      fillEditor(nodeById(id));
      renderFocus("static");
      toast("1단계 주제가 추가되었습니다");
      return;
    }
    state.childrenOpen = true;
    var addedTier = getDepth() + 1;
    openNode(id, true, "navigate");
    toast(addedTier + "단계 주제가 추가되었습니다");
  }

  function deleteNode() {
    if (!state.centerId || state.centerId === state.data.rootId) {
      toast("루트 노드는 삭제할 수 없습니다");
      return;
    }
    var id = state.centerId;
    state.data.nodes = state.data.nodes.filter(function (n) { return n.id !== id; });
    state.data.edges = state.data.edges.filter(function (e) {
      return e.from !== id && e.to !== id;
    });
    state.explored = state.explored.filter(function (eid) { return eid !== id; });
    if (!state.explored.length) state.explored = [state.data.rootId];
    openNode(state.explored[state.explored.length - 1], false, "navigate");
    toast("노드가 삭제되었습니다");
  }

  function saveMindmap() {
    if (saveInFlight) return Promise.resolve();
    saveInFlight = true;
    if (els.btnSave) {
      els.btnSave.disabled = true;
      els.btnSave.textContent = "저장 중…";
    }
    syncEditorToState();
    if (!state.data.meta) state.data.meta = {};
    state.data.meta.updatedAt = new Date().toISOString();
    return fetch("/api/mindmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ courseSlug: state.courseSlug }, state.data))
    }).then(function (res) {
      if (!res.ok) throw new Error("save failed");
      return res.json();
    }).then(function (data) {
      renderFocus("static");
      var dep = data && data.deploy;
      if (dep && dep.ok && dep.async) {
        toast("저장 완료 — thegospel.kr 배포 진행 중");
      } else if (dep && dep.ok) {
        toast("저장 및 thegospel.kr 배포 완료");
      } else if (dep && dep.skipped) {
        toast("저장되었습니다 (자동 배포 꺼짐)");
      } else if (dep && !dep.ok) {
        toast("저장됨 — 배포 실패: " + (dep.error || "알 수 없음"));
      } else {
        toast("저장되었습니다");
      }
    }).catch(function () {
      toast("저장 실패 — serve.bat(api.py) 실행이 필요합니다");
    }).finally(function () {
      saveInFlight = false;
      if (els.btnSave) {
        els.btnSave.disabled = false;
        els.btnSave.textContent = "저장";
      }
    });
  }

  function exportJson() {
    syncEditorToState();
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mindmap.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.nodes || !data.rootId) throw new Error("invalid");
        state.data = normalizeMindmap(data);
        resetView();
        toast("가져오기 완료 — 저장을 눌러 반영하세요");
      } catch (e) {
        toast("잘못된 JSON 파일입니다");
      }
    };
    reader.readAsText(file);
  }

  function updateHash() {
    if (!state.courseSlug || !state.centerId) return;
    var hash = "#course/" + encodeURIComponent(state.courseSlug) + "/n/" + encodeURIComponent(state.centerId);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  function parseHash() {
    var h = location.hash || "";
    if (h === "#catalogs" || h === "#catalog" || h === "#/" || h === "") return { screen: "catalogs" };
    var catalogMatch = h.match(/^#catalog\/([^/]+)$/);
    if (catalogMatch) {
      return { screen: "catalog", catalogSlug: decodeURIComponent(catalogMatch[1]) };
    }
    var courseMatch = h.match(/^#course\/([^/]+)(?:\/n\/(.+))?$/);
    if (courseMatch) {
      return {
        screen: "course",
        slug: decodeURIComponent(courseMatch[1]),
        nodeId: courseMatch[2] ? decodeURIComponent(courseMatch[2]) : null
      };
    }
    if (h.indexOf("#n/") === 0) {
      return {
        screen: "course",
        slug: state.courseSlug || "",
        nodeId: decodeURIComponent(h.slice(3))
      };
    }
    return { screen: "catalogs" };
  }

  function routeFromHash() {
    var route = parseHash();
    if (route.screen === "catalogs") {
      return showCatalogsHome();
    }
    if (route.screen === "catalog" && route.catalogSlug) {
      return showCatalogCourses(route.catalogSlug);
    }
    if (route.screen === "course" && route.slug) {
      if (route.slug !== state.courseSlug || !state.data) {
        return openCourse(route.slug, route.nodeId);
      }
      if (route.nodeId && nodeById(route.nodeId) && route.nodeId !== state.centerId) {
        state.explored = buildExploredPath(route.nodeId);
        openNode(route.nodeId, false, "navigate");
      }
      return Promise.resolve(state.data);
    }
    return showCatalogsHome();
  }

  function verifyPin(pin) {
    pin = String(pin || "").trim();
    return fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin })
    }).then(function (res) {
      if (!res.ok) throw new Error("bad_status");
      return res.json();
    }).then(function (data) {
      if (data.ok) return { ok: true };
      return { ok: false, reason: "pin" };
    }).catch(function () {
      return { ok: false, reason: "server" };
    });
  }

  function formatUpdatedAt(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function loadMindmap(forceReload, preferNodeId) {
    if (!state.courseSlug) return Promise.resolve(null);
    if (state.data && !forceReload) {
      ensureCenterNode();
      return Promise.resolve(state.data);
    }
    if (forceReload) state.data = null;
    return fetch(courseMindmapPath(state.courseSlug) + "?_=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then(function (data) {
        state.data = normalizeMindmap(data);
        var allowDeep = state.user || state.admin;
        var targetId = allowDeep ? (preferNodeId || state.courseProgress.lastNodeId) : null;
        if (targetId && nodeById(targetId)) {
          state.explored = buildExploredPath(targetId);
          state.centerId = targetId;
        } else {
          state.explored = [data.rootId];
          state.centerId = data.rootId;
        }
        state.childrenOpen = false;
        applyProgressData({
          nodes: state.courseProgress.nodes,
          lastNodeId: state.centerId,
          percent: computePercentFromNodes(state.courseProgress.nodes)
        });
        renderFocus("intro");
        updateProgressUI();
        return data;
      })
      .catch(function () {
        toast("데이터 로드 실패 — serve.bat으로 http://localhost:8780/ 에 접속하세요");
        return null;
      });
  }

  function reloadMindmap() {
    var keepId = state.centerId;
    if (state.admin) exitAdmin();
    if (els.btnRefresh) els.btnRefresh.disabled = true;
    return loadMindmap(true)
      .then(function (data) {
        if (!data) return null;
        if (keepId && nodeById(keepId)) {
          state.explored = buildExploredPath(keepId);
          state.centerId = keepId;
        }
        renderFocus("static");
        updateHash();
        var label = formatUpdatedAt(data.meta && data.meta.updatedAt);
        toast(label ? "최신 데이터 반영 (" + label + ")" : "최신 데이터를 불러왔습니다");
        return data;
      })
      .finally(function () {
        if (els.btnRefresh) els.btnRefresh.disabled = false;
      });
  }

  function ensureCourseLoaded() {
    if (state.data && state.courseSlug) return Promise.resolve(state.data);
    if (state.courseSlug) return loadMindmap(true);
    return Promise.resolve(null);
  }

  function bindEvents() {
    if (els.catalogList) {
      els.catalogList.addEventListener("click", function (e) {
        var editBtn = e.target.closest(".catalog-card-edit");
        if (editBtn) {
          e.preventDefault();
          e.stopPropagation();
          if (editBtn.dataset.catalogSlug) {
            openCatalogEditModal(editBtn.dataset.catalogSlug);
            return;
          }
          if (editBtn.dataset.slug) {
            openCourseEditModal(editBtn.dataset.slug);
            return;
          }
        }
        var card = e.target.closest(".catalog-card");
        if (!card) return;
        if (card.dataset.catalogSlug) {
          showCatalogCourses(card.dataset.catalogSlug);
          return;
        }
        if (card.dataset.slug) {
          openCourse(card.dataset.slug);
        }
      });
    }
    if (els.btnBackToCatalogs) {
      els.btnBackToCatalogs.addEventListener("click", function () {
        showCatalogsHome();
      });
    }
    if (els.btnCatalogResume) {
      els.btnCatalogResume.addEventListener("click", function () {
        var slug = els.btnCatalogResume.dataset.slug;
        var nodeId = els.btnCatalogResume.dataset.nodeId || null;
        var catalogSlug = els.btnCatalogResume.dataset.catalogSlug || null;
        if (catalogSlug) state.activeCatalogSlug = catalogSlug;
        if (slug) openCourse(slug, nodeId, catalogSlug);
      });
    }
    if (els.btnSaveGoals) els.btnSaveGoals.addEventListener("click", saveGoals);
    if (els.btnAddCatalog) els.btnAddCatalog.addEventListener("click", openCatalogAddModal);
    if (els.btnAddCourse) els.btnAddCourse.addEventListener("click", openCourseAddModal);
    if (els.catalogFormCancel) els.catalogFormCancel.addEventListener("click", closeCatalogFormModal);
    if (els.catalogFormSubmit) els.catalogFormSubmit.addEventListener("click", submitCatalogForm);
    if (els.catalogFormTitleInput) {
      els.catalogFormTitleInput.addEventListener("input", function () {
        if (els.catalogFormSlug && !els.catalogFormSlug.value.trim()) {
          els.catalogFormSlug.value = slugifyTitle(els.catalogFormTitleInput.value);
        }
      });
    }
    if (els.btnAdminUsers) els.btnAdminUsers.addEventListener("click", openAdminUsersModal);
    if (els.btnExitCatalogAdmin) els.btnExitCatalogAdmin.addEventListener("click", exitCatalogAdmin);
    if (els.courseAddCancel) els.courseAddCancel.addEventListener("click", closeCourseAddModal);
    if (els.courseAddSubmit) els.courseAddSubmit.addEventListener("click", submitCourseForm);
    if (els.courseAddTitle) {
      els.courseAddTitle.addEventListener("input", function () {
        if (els.courseAddSlug && !els.courseAddSlug.value.trim()) {
          els.courseAddSlug.value = slugifyTitle(els.courseAddTitle.value);
        }
      });
    }
    if (els.adminUsersClose) {
      els.adminUsersClose.addEventListener("click", function () {
        if (els.adminUsersOverlay) els.adminUsersOverlay.hidden = true;
      });
    }
    if (els.btnMarkComplete) {
      els.btnMarkComplete.addEventListener("click", function () {
        if (!state.centerId) return;
        var done = state.courseProgress.nodes[state.centerId] === "completed";
        if (done) {
          if (!window.confirm("이해 완료 표시를 취소할까요?")) return;
          recordProgress(state.centerId, "visited", { allowDowngrade: true });
          toast("이해 완료 표시를 취소했습니다");
          return;
        }
        if (!window.confirm("이 주제를 이해 완료로 표시할까요?")) return;
        recordProgress(state.centerId, "completed");
        toast("이해 완료로 표시했습니다");
      });
    }
    els.btnReset.addEventListener("click", resetView);
    if (els.btnRefresh) els.btnRefresh.addEventListener("click", reloadMindmap);
    els.btnBack.addEventListener("click", goBack);
    els.btnExpand.addEventListener("click", toggleChildren);
    if (els.outlineTreePanel) {
      els.outlineTreePanel.addEventListener("click", function (e) {
        var btn = e.target.closest(".outline-tree-link");
        if (!btn) return;
        e.preventDefault();
        openNode(btn.dataset.id, true, "navigate");
      });
    }
    els.childrenList.addEventListener("click", function (e) {
      var btn = e.target.closest(".child-chip");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      openNode(btn.dataset.id, true, "navigate");
    });
    els.focusTrail.addEventListener("click", function (e) {
      var sp = e.target.closest("span[data-id]");
      if (!sp) return;
      var id = sp.dataset.id;
      if (id === state.data.rootId) {
        courseRootView();
        return;
      }
      var idx = state.explored.indexOf(id);
      if (idx < 0) return;
      state.explored = state.explored.slice(0, idx + 1);
      openNode(id, false, "navigate");
    });
    els.btnAdmin.addEventListener("click", function () {
      if (state.admin) {
        exitAdmin();
        return;
      }
      if (state.adminCatalog && (state.screen === "catalogs" || state.screen === "catalog")) {
        exitCatalogAdmin();
        return;
      }
      if (state.screen === "catalogs" || state.screen === "catalog") {
        if (SKIP_ADMIN_PIN) {
          enterCatalogAdmin("");
          return;
        }
        els.adminPin.value = "";
        els.adminOverlay.hidden = false;
        els.adminPin.focus();
        els.adminOverlay.dataset.mode = "catalog";
        return;
      }
      ensureCourseLoaded()
        .then(function (data) {
          if (!data) {
            toast("데이터 로드 후 다시 시도하세요");
            return null;
          }
          return data;
        })
        .then(function (data) {
          if (!data) return;
          if (SKIP_ADMIN_PIN) {
            enterAdmin();
            return;
          }
          els.adminPin.value = "";
          els.adminOverlay.hidden = false;
          els.adminPin.focus();
          els.adminOverlay.dataset.mode = "course";
        })
        .catch(function () {
          toast("운영자 모드 진입 오류 — 새로고침 후 다시 시도하세요");
        });
    });
    els.adminCancel.addEventListener("click", function () {
      els.adminOverlay.hidden = true;
    });
    els.adminLogin.addEventListener("click", function () {
      var btn = els.adminLogin;
      var pin = els.adminPin.value;
      var catalogMode = els.adminOverlay && els.adminOverlay.dataset.mode === "catalog";
      btn.disabled = true;
      var chain = catalogMode
        ? verifyPin(pin).then(function (result) {
            if (!result) return null;
            if (result.ok) {
              enterCatalogAdmin(pin);
              return true;
            }
            if (result.reason === "server") {
              toast("서버에 연결할 수 없습니다 — serve.bat으로 실행하세요");
              return null;
            }
            toast("PIN이 올바르지 않습니다");
            return null;
          })
        : ensureCourseLoaded()
          .then(function (data) {
            if (!data) return null;
            return verifyPin(pin);
          })
          .then(function (result) {
            if (!result) return;
            if (result.ok) {
              enterAdmin();
              return;
            }
            if (result.reason === "server") {
              toast("서버에 연결할 수 없습니다 — serve.bat으로 실행하세요");
              return;
            }
            toast("PIN이 올바르지 않습니다");
          });
      chain.catch(function () {
        toast("로그인 오류 — 새로고침 후 다시 시도하세요");
      }).finally(function () {
        btn.disabled = false;
      });
    });
    els.adminPin.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") els.adminLogin.click();
    });
    els.btnExitAdmin.addEventListener("click", exitAdmin);
    els.btnAddChild.addEventListener("click", addChild);
    els.btnDeleteNode.addEventListener("click", deleteNode);
    if (els.btnMoveParent) els.btnMoveParent.addEventListener("click", applyMoveParent);
    if (els.btnMoveUp) els.btnMoveUp.addEventListener("click", function () { applyReorder(-1); });
    if (els.btnMoveDown) els.btnMoveDown.addEventListener("click", function () { applyReorder(1); });
    if (els.btnAiAsk) els.btnAiAsk.addEventListener("click", askLocalAi);
    if (els.btnAiInsert) els.btnAiInsert.addEventListener("click", function () { insertAiAnswer("replace"); });
    if (els.btnAiAppend) els.btnAiAppend.addEventListener("click", function () { insertAiAnswer("append"); });
    els.btnSave.addEventListener("click", saveMindmap);
    els.btnExport.addEventListener("click", exportJson);
    els.btnImport.addEventListener("click", function () { els.importFile.click(); });
    els.importFile.addEventListener("change", function () {
      if (els.importFile.files[0]) importJson(els.importFile.files[0]);
      els.importFile.value = "";
    });
    ["editTitle", "editDesc", "editScripture"].forEach(function (id) {
      $(id).addEventListener("input", onEditorInput);
    });
  }

  function initPwaInstallBar() {
    var ua = navigator.userAgent || "";
    var deferredPrompt = null;
    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    var isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isStandalone) return;

    if (/KAKAOTALK/i.test(ua)) {
      location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
      return;
    }

    var bar = document.createElement("div");
    bar.id = "pwa-install-bar";
    bar.className = "pwa-install-bar";
    bar.setAttribute("role", "note");
    bar.innerHTML =
      '<button type="button" class="pwa-install-bar__close" aria-label="닫기" id="pwa-install-close">×</button>' +
      '<div class="pwa-install-bar__title">VisionforLife 앱 설치</div>' +
      '<div id="pwa-install-btn-wrap" class="pwa-install-bar__btn-wrap">' +
      '<button type="button" id="pwa-install-btn" class="pwa-install-bar__install">앱 설치하기</button>' +
      "</div>" +
      '<div id="pwa-install-msg" class="pwa-install-bar__msg"></div>';
    document.body.appendChild(bar);

    var msg = document.getElementById("pwa-install-msg");
    var btnWrap = document.getElementById("pwa-install-btn-wrap");
    var btn = document.getElementById("pwa-install-btn");
    var waitGuide = "설치가 완료될 때까지 잠시 기다려 주세요.";
    var menuFallback =
      "설치하기 버튼이 보이지 않거나<br>브라우저 오른쪽 위 <b>⋮</b> 메뉴에서<br><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해 주세요.";
    var menuGuide = isIOS
      ? "Safari 하단 <b>공유(⬆︎)</b> → <b>홈 화면에 추가</b>를 누르신 뒤,<br>" + waitGuide
      : menuFallback + "<br><br>" + waitGuide;
    var btnGuide = "<b>앱 설치하기</b> 버튼을 누르신 뒤,<br>" + waitGuide + "<br><br>" + menuFallback;

    function renderPwaBar() {
      if (msg) msg.innerHTML = menuGuide;
    }
    function showInstallBtn() {
      if (isIOS || !deferredPrompt || !btnWrap || !msg) return;
      btnWrap.classList.add("is-visible");
      msg.innerHTML = btnGuide;
    }

    renderPwaBar();
    var closeBtn = document.getElementById("pwa-install-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { bar.remove(); });
    if (btn) {
      btn.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          if (btnWrap) btnWrap.classList.remove("is-visible");
        });
      });
    }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBtn();
    });
  }

  function ensureCatalogsVisible() {
    if (state.screen !== "catalogs" || !els.catalogList) return;
    if (els.catalogList.querySelector(".catalog-card")) return;
    showCatalogsHome();
  }

  function bootApp() {
    initFontSize();
    initAiAskMode();
    initAdminPanelResize();
    initAuth();
    initPwaInstallBar();
    bindEvents();
    window.addEventListener("hashchange", function () { routeFromHash(); });
    window.addEventListener("pageshow", function () {
      ensureCatalogsVisible();
    });
    routeFromHash();
    fetchCurrentUser().then(function () {
      updateGoalsUI();
      if (state.screen === "catalogs") {
        loadAllCourses().then(function () {
          if (state.screen === "catalogs") renderResumeBanner();
        });
      }
    });
  }

  bootApp();
  if ("serviceWorker" in navigator) {
    var swVerMatch = (document.querySelector('script[src*="app.js"]') || {}).src || "";
    var swVer = (swVerMatch.match(/[?&]v=(\d+)/) || [])[1] || "1";
    navigator.serviceWorker.register(assetUrl("sw.js") + "?v=" + swVer, { updateViaCache: "none" })
      .catch(function () {});
  }
})();
