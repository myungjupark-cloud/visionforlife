(function () {
  "use strict";

  function isLocalDevHost() {
    var host = String(location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    // Private LAN
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    // Tailscale CGNAT
    if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  }

  var SKIP_ADMIN_PIN = isLocalDevHost();
  var LOCAL_ADMIN_PIN = "";

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
    memberAdminIsMain: false,
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
    btnMemberAdmin: $("btn-member-admin"),
    btnAdmin: $("btn-admin"),
    authOverlay: $("auth-overlay"),
    authModalTitle: $("auth-modal-title"),
    authModalHint: $("auth-modal-hint"),
    authPhone: $("auth-phone"),
    authPassword: $("auth-password"),
    authName: $("auth-name"),
    authNameRow: $("auth-name-row"),
    authSubmit: $("auth-submit"),
    authCancel: $("auth-cancel"),
    authToggleMode: $("auth-toggle-mode"),
    operatorNoticeOverlay: $("operator-notice-overlay"),
    operatorNoticeBody: $("operator-notice-body"),
    operatorNoticeOk: $("operator-notice-ok"),
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
    btnInsertHymn: $("btn-insert-hymn"),
    btnInsertAside: $("btn-insert-aside"),
    btnInsertLink: $("btn-insert-link"),
    btnInsertImage: $("btn-insert-image"),
    linkFormOverlay: $("link-form-overlay"),
    linkFormUrl: $("link-form-url"),
    linkFormLabel: $("link-form-label"),
    linkFormCancel: $("link-form-cancel"),
    linkFormSubmit: $("link-form-submit"),
    imageFormOverlay: $("image-form-overlay"),
    imageFormFile: $("image-form-file"),
    imageFormAlt: $("image-form-alt"),
    imageFormCancel: $("image-form-cancel"),
    imageFormSubmit: $("image-form-submit"),
    linkOpenOverlay: $("link-open-overlay"),
    linkOpenUrl: $("link-open-url"),
    linkOpenCancel: $("link-open-cancel"),
    linkOpenCopy: $("link-open-copy"),
    linkOpenShare: $("link-open-share"),
    asideList: $("aside-list"),
    asideFormOverlay: $("aside-form-overlay"),
    asideFormModal: $("aside-form-modal"),
    asideFormTitle: $("aside-form-title"),
    asideFormLabel: $("aside-form-label"),
    asideFormBody: $("aside-form-body"),
    asideFormCancel: $("aside-form-cancel"),
    asideFormSubmit: $("aside-form-submit"),
    asideOverlay: $("aside-overlay"),
    asideOverlayTitle: $("aside-overlay-title"),
    asideOverlayBody: $("aside-overlay-body"),
    asideOverlayBack: $("aside-overlay-back"),
    scrScrim: $("scr-scrim"),
    scrPopup: $("scr-popup"),
    scrTitle: $("scr-title"),
    scrBody: $("scr-body"),
    scrClose: $("scr-close"),
    hymnAudio: $("hymn-audio"),
    editScripture: $("edit-scripture"),
    aiQuestion: $("ai-question"),
    aiAskMode: $("ai-ask-mode"),
    aiModeHint: $("ai-mode-hint"),
    aiAnswer: $("ai-answer"),
    aiAnswerPreview: $("ai-answer-preview"),
    aiAnswerMeta: $("ai-answer-meta"),
    btnAiAsk: $("btn-ai-ask"),
    btnAiCopy: $("btn-ai-copy"),
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
    btnDeploy: $("btn-deploy"),
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
    catalogAuthCta: $("catalog-auth-cta"),
    btnCatalogLogin: $("btn-catalog-login"),
    btnCatalogRegister: $("btn-catalog-register"),
    catalogGoals: $("catalog-goals"),
    goalsInput: $("goals-input"),
    btnSaveGoals: $("btn-save-goals"),
    catalogAdminBar: $("catalog-admin-bar"),
    btnAddCatalog: $("btn-add-catalog"),
    btnAddCourse: $("btn-add-course"),
    btnAdminUsers: $("btn-admin-users"),
    btnCatalogDeploy: $("btn-catalog-deploy"),
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
  var SESSION_KEY = "visionforlife-session";
  var USER_CACHE_KEY = "visionforlife-user";
  var IDLE_LOGOUT_MS = 30 * 60 * 1000;
  var idleTimer = null;
  var idleEventsBound = false;
  var idlePaused = false;
  var lastActivityAt = Date.now();
  var sessionRestoreTimer = null;
  var sessionFetchInFlight = null;

  function readSessionToken() {
    try { return localStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; }
  }

  function writeSessionToken(token) {
    try {
      if (token) localStorage.setItem(SESSION_KEY, token);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function readCachedUser() {
    try {
      var raw = localStorage.getItem(USER_CACHE_KEY);
      if (!raw) return null;
      var user = JSON.parse(raw);
      return user && typeof user === "object" ? user : null;
    } catch (e) {
      return null;
    }
  }

  function writeCachedUser(user) {
    try {
      if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_CACHE_KEY);
    } catch (e) { /* ignore */ }
  }

  function clearSessionToken() {
    writeSessionToken("");
    writeCachedUser(null);
  }

  function rememberSession(token, user) {
    if (token) writeSessionToken(token);
    if (user) {
      state.user = user;
      writeCachedUser(user);
    }
  }

  function hasLocalSession() {
    return !!(readSessionToken() || readCachedUser());
  }

  function hydrateSessionFromCache() {
    if (state.user) return true;
    var token = readSessionToken();
    var cached = readCachedUser();
    if (cached) {
      state.user = cached;
      return true;
    }
    // Token without user cache (older login): keep lesson access until /me returns.
    if (token) {
      state.user = { name: "회원", status: "active", role: "learner", _pendingHydrate: true };
      return true;
    }
    return false;
  }

  function authHeaders(extra) {
    var headers = Object.assign({}, extra || {});
    var token = readSessionToken();
    if (token) headers["X-VFL-Session"] = token;
    return headers;
  }

  function withSessionQuery(url) {
    var token = readSessionToken();
    if (!token) return url;
    try {
      var u = new URL(url, location.href);
      if (!u.searchParams.get("vfl_token")) u.searchParams.set("vfl_token", token);
      return u.toString();
    } catch (e) {
      return url + (url.indexOf("?") >= 0 ? "&" : "?") + "vfl_token=" + encodeURIComponent(token);
    }
  }

  function authFetch(url, options) {
    var opts = Object.assign({ credentials: "include" }, options || {});
    opts.headers = authHeaders(opts.headers || {});
    return fetch(withSessionQuery(url), opts);
  }

  function delayMs(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }

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

  window.FaithMarkdownAssetUrl = assetUrl;

  /** App-base-relative API so thegospel.kr/visionforlife/api/... works. */
  function apiUrl(path) {
    var raw = String(path || "");
    var q = "";
    var qi = raw.indexOf("?");
    if (qi >= 0) {
      q = raw.slice(qi);
      raw = raw.slice(0, qi);
    }
    return assetUrl(raw.replace(/^\//, "")) + q;
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

  function catalogVisibility(catalog) {
    if (!catalog) return "private";
    var v = String(catalog.visibility || "").toLowerCase();
    if (v === "public" || v === "members" || v === "private") return v;
    return catalog.published === false ? "private" : "public";
  }

  function isCatalogPublished(catalog) {
    return catalogVisibility(catalog) !== "private";
  }

  function canAccessCatalog(slug) {
    if (!slug) return false;
    if (state.adminCatalog || state.admin) return true;
    // public·members: 목록·소개 열람 가능. private만 차단.
    // 회원용 본과(제1과~) 제한은 lessonAccessBlocked에서 처리.
    return catalogVisibility(catalogBySlug(slug)) !== "private";
  }

  function catalogsForDisplay() {
    var list = (state.catalogs || []).slice();
    if (state.adminCatalog) return list;
    return list.filter(function (catalog) {
      return catalogVisibility(catalog) !== "private";
    });
  }

  function readCatalogFormVisibility() {
    var checked = document.querySelector('input[name="catalog-visibility"]:checked');
    var v = checked && checked.value;
    if (v === "public" || v === "members" || v === "private") return v;
    return "members";
  }

  function setCatalogFormVisibility(visibility) {
    var vis = visibility === "public" || visibility === "members" || visibility === "private"
      ? visibility
      : "members";
    var radios = document.querySelectorAll('input[name="catalog-visibility"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === vis;
    }
  }

  function visibilityBadgeHtml(catalog) {
    if (!state.adminCatalog) return "";
    var vis = catalogVisibility(catalog);
    if (vis === "public") {
      return '<span class="catalog-card__draft is-public">공개</span>';
    }
    if (vis === "members") {
      return '<span class="catalog-card__draft is-members">회원</span>';
    }
    return '<span class="catalog-card__draft">비공개</span>';
  }

  function denyCatalogAccess(slug) {
    toast("아직 공개되지 않은 학습 주제입니다");
  }

  function catalogRequiresMemberLessons(slug) {
    return catalogVisibility(catalogBySlug(slug || state.activeCatalogSlug)) === "members";
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
    return authFetch(apiUrl("/api/progress"), {
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
    return authFetch(apiUrl("/api/progress?course=") + encodeURIComponent(slug), { credentials: "same-origin" })
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
    updateResetButtonLabel();
    updateCatalogAuthCta();
  }

  /** Header list button: in-lesson → 처음으로; at course root → 홈/과정 목록. */
  function updateResetButtonLabel() {
    if (!els.btnReset) return;
    var screen = state.screen;
    if (screen === "course" && state.data && !isAtRoot()) {
      els.btnReset.title = "처음으로";
      els.btnReset.textContent = "처음으로";
      return;
    }
    if (screen === "course") {
      var cat = state.activeCatalogSlug;
      var multi = cat && (state.adminCatalog || coursesInActiveCatalogCount(cat) > 1);
      els.btnReset.title = multi ? "과정 목록" : "홈";
      els.btnReset.textContent = multi ? "과정 목록" : "홈";
      return;
    }
    if (screen === "catalog") {
      els.btnReset.title = "주제 목록";
      els.btnReset.textContent = "주제 목록";
      return;
    }
    els.btnReset.title = "목록";
    els.btnReset.textContent = "목록";
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

  function updateCatalogAuthCta() {
    if (!els.catalogAuthCta) return;
    var onHome = state.screen === "catalogs" || state.screen === "catalog";
    els.catalogAuthCta.hidden = !onHome || !!state.user;
  }

  function updateGoalsUI() {
    if (els.catalogGoals) {
      if (!state.user) {
        els.catalogGoals.hidden = true;
      } else {
        els.catalogGoals.hidden = false;
        if (els.goalsInput) els.goalsInput.value = state.user.goals || "";
      }
    }
    updateCatalogAuthCta();
  }

  function saveGoals() {
    if (!state.user || !els.goalsInput) return;
    var goals = els.goalsInput.value.trim();
    authFetch(apiUrl("/api/auth/goals"), {
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
        toast("추구 목표를 저장했습니다");
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다");
      });
  }

  function slugifyTitle(title) {
    return String(title || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
  }

  function enterCatalogAdmin(pin) {
    state.adminCatalog = true;
    state.adminPin = pin || LOCAL_ADMIN_PIN || "";
    if (els.catalogAdminBar) els.catalogAdminBar.hidden = false;
    if (els.adminOverlay) els.adminOverlay.hidden = true;
    if (els.btnAdmin) {
      els.btnAdmin.textContent = "운영중";
      els.btnAdmin.setAttribute("aria-pressed", "true");
    }
    setScreen(state.screen);
    toast(SKIP_ADMIN_PIN ? "카탈로그 운영 모드 (로컬 · PIN 생략)" : "카탈로그 운영 모드");
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
    setCatalogFormVisibility(
      isEdit
        ? catalogVisibility(catalog)
        : "private"
    );
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
      toast(!title ? "제목을 입력하세요" : "slug는 영문·숫자·하이픈만 가능합니다 (예: faith-basics)");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast("slug는 영문·숫자·하이픈만 가능합니다 (예: faith-basics)");
      return;
    }
    var isEdit = state.catalogFormMode === "edit";
    var visibility = readCatalogFormVisibility();
    authFetch(apiUrl("/api/catalogs"), {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: state.adminPin,
        slug: slug,
        title: title,
        description: description,
        visibility: visibility,
        published: visibility !== "private"
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
      toast(!title ? "제목을 입력하세요" : "slug는 영문·숫자·하이픈만 가능합니다 (예: mystery)");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      toast("slug는 영문·숫자·하이픈만 가능합니다 (예: mystery)");
      return;
    }
    var isEdit = state.courseFormMode === "edit";
    authFetch(apiUrl("/api/courses"), {
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

  function statusLabel(status) {
    if (status === "pending") return "대기";
    if (status === "disabled") return "강퇴";
    return "활성";
  }

  function roleLabel(role) {
    return role === "operator" ? "운영자" : "회원";
  }

  function isOperatorLoggedIn() {
    return !!(state.user && state.user.role === "operator" && state.user.status === "active");
  }

  function updateMemberAdminButton() {
    if (!els.btnMemberAdmin) return;
    // Show for appointed operators; main admin uses catalog-admin-bar 「회원 관리」.
    els.btnMemberAdmin.hidden = !isOperatorLoggedIn();
    if (els.btnAdmin && isOperatorLoggedIn() && !state.admin && !state.adminCatalog) {
      els.btnAdmin.title = "회원 관리";
    } else if (els.btnAdmin && !state.admin && !state.adminCatalog) {
      els.btnAdmin.title = "메인 운영자 모드";
    }
  }

  function memberApiUrl(path) {
    // Phone registrations live on thegospel.kr. Local admin must use that member DB.
    var raw = String(path || "");
    var q = "";
    var qi = raw.indexOf("?");
    if (qi >= 0) {
      q = raw.slice(qi);
      raw = raw.slice(0, qi);
    }
    raw = raw.replace(/^\//, "");
    if (/thegospel\.kr$/i.test(location.hostname)) {
      return apiUrl("/" + raw) + q;
    }
    return "https://thegospel.kr/visionforlife/" + raw + q;
  }

  function memberAdminPin() {
    return state.adminPin || LOCAL_ADMIN_PIN || "";
  }

  function adminUsersFetchUrl() {
    var url = memberApiUrl("/api/admin/users");
    var pin = memberAdminPin();
    // Main admin (PIN / local bypass) must send pin to thegospel.kr member API.
    if ((state.adminCatalog || state.admin || SKIP_ADMIN_PIN) && pin) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "pin=" + encodeURIComponent(pin);
    }
    return url;
  }

  function adminMemberBody(extra) {
    var body = Object.assign({}, extra || {});
    var pin = memberAdminPin();
    if ((state.adminCatalog || state.admin || SKIP_ADMIN_PIN) && pin) {
      body.pin = pin;
    }
    return body;
  }

  function memberAdminFetch(url, options) {
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    var sameOrigin = /thegospel\.kr$/i.test(location.hostname);
    if (sameOrigin) {
      // Operator session cookie + localStorage token
      var token = readSessionToken();
      if (token) headers["X-VFL-Session"] = token;
      opts.credentials = "same-origin";
    } else {
      // Local main-admin → remote member DB (PIN in query/body)
      opts.credentials = "omit";
    }
    opts.headers = headers;
    return fetch(url, opts);
  }

  function postAdminMember(path, extra) {
    return memberAdminFetch(memberApiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminMemberBody(extra))
    }).then(function (res) {
      return res.json().then(function (d) { return { ok: res.ok, data: d }; });
    });
  }

  function renderAdminUsersList(users) {
    if (!els.adminUsersList) return;
    if (!users || !users.length) {
      els.adminUsersList.innerHTML = '<p class="admin-hint">등록된 회원이 없습니다.</p>';
      return;
    }
    var showRole = !!state.memberAdminIsMain;
    els.adminUsersList.innerHTML =
      '<table class="admin-users-table"><thead><tr>' +
      "<th>이름</th><th>휴대폰</th><th>상태</th><th>역할</th><th>진도</th><th>등록</th><th>관리</th>" +
      "</tr></thead><tbody>" +
      users.map(function (u) {
        var goals = (u.goals || "").trim();
        var goalsShort = goals.length > 28 ? goals.slice(0, 28) + "…" : (goals || "");
        var actions = [];
        if (u.status === "pending") {
          actions.push('<button type="button" class="btn btn-sm btn-primary admin-user-action" data-action="approve" data-user-id="' + u.id + '">승인</button>');
        }
        if (u.status !== "disabled") {
          actions.push('<button type="button" class="btn btn-sm btn-danger admin-user-action" data-action="disable" data-user-id="' + u.id + '">강퇴</button>');
        }
        if (u.status === "disabled") {
          actions.push('<button type="button" class="btn btn-sm btn-primary admin-user-action" data-action="approve" data-user-id="' + u.id + '">복구</button>');
        }
        actions.push('<button type="button" class="btn btn-sm admin-user-action" data-action="rename" data-user-id="' + u.id + '" data-user-name="' + esc(u.name || "") + '">이름</button>');
        actions.push('<button type="button" class="btn btn-sm admin-user-action" data-action="message" data-user-id="' + u.id + '">안내</button>');
        if (showRole && u.status === "active") {
          if (u.role === "operator") {
            actions.push('<button type="button" class="btn btn-sm admin-user-action" data-action="demote" data-user-id="' + u.id + '">운영자 해제</button>');
          } else {
            actions.push('<button type="button" class="btn btn-sm admin-user-action" data-action="promote" data-user-id="' + u.id + '">운영자 임명</button>');
          }
        }
        return (
          "<tr>" +
          "<td>" + esc(u.name || "—") +
          (goalsShort ? '<div class="admin-user-goals">' + esc(goalsShort) + "</div>" : "") +
          "</td>" +
          "<td>" + esc(u.phone || u.email) + "</td>" +
          "<td>" + esc(statusLabel(u.status)) + "</td>" +
          "<td>" + esc(roleLabel(u.role)) + "</td>" +
          "<td>" + esc(String(u.courseCount || 0) + "과정 · " + String(u.nodeCount || 0) + "노드") + "</td>" +
          "<td>" + esc((u.createdAt || "").slice(0, 10)) + "</td>" +
          '<td class="admin-user-actions">' + actions.join(" ") + "</td>" +
          "</tr>"
        );
      }).join("") +
      "</tbody></table>";
  }

  function refreshAdminUsersList() {
    if (!els.adminUsersList) return;
    function doFetch() {
      return memberAdminFetch(adminUsersFetchUrl())
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) {
            els.adminUsersList.innerHTML = '<p class="admin-hint">' +
              esc((data && data.error) || "회원 목록을 불러올 수 없습니다") + "</p>";
            return;
          }
          state.memberAdminIsMain = !!data.isMainAdmin || !!(state.adminCatalog || state.admin) || SKIP_ADMIN_PIN;
          renderAdminUsersList(data.users);
        })
        .catch(function () {
          els.adminUsersList.innerHTML = '<p class="admin-hint">서버 연결 실패</p>';
        });
    }
    if ((state.adminCatalog || state.admin || SKIP_ADMIN_PIN) && !memberAdminPin()) {
      return loadLocalAdminPin().then(doFetch);
    }
    return doFetch();
  }

  function openAdminUsersModal() {
    if (!els.adminUsersOverlay) return;
    els.adminUsersList.innerHTML = '<p class="admin-hint">불러오는 중…</p>';
    els.adminUsersOverlay.hidden = false;
    refreshAdminUsersList();
  }

  function handleAdminUserAction(action, userId, currentName) {
    if (!action || !userId) return;
    if (action === "approve") {
      postAdminMember("/api/admin/users/approve", { userId: userId })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            toast((result.data && result.data.error) || "승인 실패");
            return;
          }
          toast("회원을 승인했습니다");
          refreshAdminUsersList();
        })
        .catch(function () { toast("서버 연결 실패"); });
      return;
    }
    if (action === "disable") {
      if (!window.confirm("이 회원을 강퇴할까요? 로그인할 수 없게 됩니다.")) return;
      postAdminMember("/api/admin/users/disable", { userId: userId })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            toast((result.data && result.data.error) || "강퇴 실패");
            return;
          }
          toast("회원을 강퇴했습니다");
          refreshAdminUsersList();
        })
        .catch(function () { toast("서버 연결 실패"); });
      return;
    }
    if (action === "promote" || action === "demote") {
      var role = action === "promote" ? "operator" : "learner";
      var label = action === "promote" ? "운영자로 임명" : "운영자 해제";
      if (!window.confirm(label + "할까요?")) return;
      postAdminMember("/api/admin/users/set-role", { userId: userId, role: role })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            toast((result.data && result.data.error) || "역할 변경 실패");
            return;
          }
          toast(label + "했습니다");
          refreshAdminUsersList();
        })
        .catch(function () { toast("서버 연결 실패"); });
      return;
    }
    if (action === "rename") {
      var nextName = window.prompt("회원 이름 수정:", currentName || "");
      if (nextName == null) return;
      nextName = String(nextName).trim();
      if (!nextName) {
        toast("이름을 입력하세요");
        return;
      }
      postAdminMember("/api/admin/users/update-name", { userId: userId, name: nextName })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            toast((result.data && result.data.error) || "이름 수정 실패");
            return;
          }
          toast("이름을 수정했습니다");
          refreshAdminUsersList();
        })
        .catch(function () { toast("서버 연결 실패"); });
      return;
    }
    if (action === "message") {
      var body = window.prompt("이 회원에게 보낼 운영자 안내 멘트:");
      if (body == null) return;
      body = String(body).trim();
      if (!body) {
        toast("안내 내용을 입력하세요");
        return;
      }
      postAdminMember("/api/admin/users/message", { userId: userId, body: body })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            toast((result.data && result.data.error) || "안내 전송 실패");
            return;
          }
          toast("안내 멘트를 저장했습니다. 다음 로그인 시 표시됩니다.");
        })
        .catch(function () { toast("서버 연결 실패"); });
    }
  }

  function renderCatalogsList() {
    var listEl = els.catalogList || document.getElementById("catalog-list");
    if (!listEl) return;
    els.catalogList = listEl;
    var catalogs = catalogsForDisplay().sort(function (a, b) {
      return (a.order || 999) - (b.order || 999);
    });
    if (!catalogs.length) {
      listEl.innerHTML = '<p class="catalog-lead">등록된 카탈로그가 없습니다. 운영자 모드에서 「+ 카탈로그 추가」로 시작하세요.</p>';
      renderResumeBanner();
      return;
    }
    listEl.innerHTML = catalogs.map(function (catalog, index) {
      var adminBtns = "";
      if (state.adminCatalog) {
        adminBtns =
          '<div class="catalog-card-admin">' +
          '<button type="button" class="catalog-card-order" data-catalog-slug="' + esc(catalog.slug) + '" data-dir="up" title="위로" ' +
          (index === 0 ? "disabled" : "") + ">▲</button>" +
          '<button type="button" class="catalog-card-order" data-catalog-slug="' + esc(catalog.slug) + '" data-dir="down" title="아래로" ' +
          (index === catalogs.length - 1 ? "disabled" : "") + ">▼</button>" +
          '<button type="button" class="catalog-card-edit" data-catalog-slug="' + esc(catalog.slug) + '" title="카탈로그 편집">편집</button>' +
          "</div>";
      }
      var draftBadge = visibilityBadgeHtml(catalog);
      return (
        '<div class="catalog-card-wrap' + (state.adminCatalog ? " is-admin" : "") + '">' +
        '<button type="button" class="catalog-card" data-catalog-slug="' + esc(catalog.slug) + '">' +
        '<span class="catalog-card__title">' + esc(catalog.title || catalog.slug) + draftBadge + "</span>" +
        (catalog.description ? '<span class="catalog-card__desc">' + esc(catalog.description) + "</span>" : "") +
        '<span class="catalog-card__meta"><span>과정 열기 →</span></span>' +
        "</button>" + adminBtns + "</div>"
      );
    }).join("");
    renderResumeBanner();
  }

  function moveCatalogOrder(slug, direction) {
    if (!state.adminCatalog || !slug) return;
    if (direction !== "up" && direction !== "down") return;
    authFetch(apiUrl("/api/catalogs"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: state.adminPin,
        action: "reorder",
        slug: slug,
        direction: direction
      })
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || "순서 변경 실패");
          return;
        }
        if (Array.isArray(result.data.catalogs)) {
          state.catalogs = result.data.catalogs;
        }
        renderCatalogsList();
        toast(direction === "up" ? "한 칸 위로 옮겼습니다" : "한 칸 아래로 옮겼습니다");
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다 — 로컬(serve.bat)에서 변경하세요");
      });
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
    return authFetch(apiUrl("/api/courses"), { credentials: "same-origin" })
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
      var bust = (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
      return fetch(url + bust, { cache: "no-store" })
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

    return authFetch(apiUrl("/api/catalogs"), { credentials: "same-origin" })
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
    return authFetch(apiUrl("/api/courses?catalog=") + encodeURIComponent(catalogSlug), { credentials: "same-origin" })
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
      if (els.catalogTitle) els.catalogTitle.textContent = "학습 주제";
      if (els.catalogLead) els.catalogLead.textContent = "배우고 싶은 주제를 골라 주세요. 주제마다 수업이 준비되어 있습니다.";
      if (els.catalogGoals) els.catalogGoals.hidden = !state.user;
      return;
    }
    if (state.screen === "catalog") {
      var meta = (state.catalogs || []).find(function (c) { return c.slug === state.activeCatalogSlug; });
      if (els.catalogTitle) els.catalogTitle.textContent = (meta && meta.title) || state.activeCatalogSlug || "주제";
      if (els.catalogLead) els.catalogLead.textContent = (meta && meta.description) || "이 주제의 수업을 선택하세요.";
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
    updateGoalsUI();
    if (els.catalogList && !els.catalogList.querySelector(".catalog-card")) {
      els.catalogList.innerHTML = '<p class="catalog-lead">불러오는 중…</p>';
    }
    if (!backCtl.quiet) {
      syncUrl();
      resetHistoryAtHome();
    }
    return loadCatalogsHome();
  }

  function showCatalogCourses(catalogSlug, options) {
    if (!catalogSlug) return showCatalogsHome();
    options = options || {};
    var allowAutoOpen = options.autoOpen !== false;
    if (state.admin) exitAdmin();
    return loadCatalogsIndex()
      .then(function () {
        if (!canAccessCatalog(catalogSlug)) {
          denyCatalogAccess(catalogSlug);
          return showCatalogsHome();
        }
        state.activeCatalogSlug = catalogSlug;
        state.courseSlug = null;
        state.data = null;
        state.centerId = null;
        state.explored = [];
        setScreen("catalog");
        return loadCatalogCourses(catalogSlug);
      })
      .then(function (result) {
        if (!result || state.screen !== "catalog") return result;
        var courses = state.catalog || [];
        // 과정이 하나뿐이면 중간 목록 없이 바로 과정으로 (운영 모드 제외)
        if (
          allowAutoOpen &&
          !state.adminCatalog &&
          courses.length === 1 &&
          courses[0] &&
          courses[0].slug
        ) {
          return openCourse(courses[0].slug, null, catalogSlug);
        }
        updateCatalogHeader();
        renderListPanel();
        setScreen("catalog");
        if (!backCtl.quiet) {
          syncUrl();
          armForwardTrap();
        }
        return state.catalog;
      });
  }

  function coursesInActiveCatalogCount(catalogSlug) {
    if (!catalogSlug) return 0;
    if (state.activeCatalogSlug === catalogSlug && Array.isArray(state.catalog) && state.catalog.length) {
      return state.catalog.length;
    }
    var all = state.allCourses || [];
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].catalogSlug === catalogSlug) n += 1;
    }
    return n;
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
        || restoreCatalogAdmin;
      if (!allowed) {
        denyCatalogAccess(state.activeCatalogSlug);
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
      }).then(function (data) {
        if (data && !backCtl.quiet) {
          syncUrl();
          armForwardTrap();
        }
        return data;
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
      var label = state.user.name || state.user.phone || state.user.email || "회원";
      els.btnAccount.textContent = label;
      els.btnAccount.title = "로그아웃";
    } else {
      els.btnAccount.textContent = "로그인";
      els.btnAccount.title = "로그인·등록";
    }
    updateMemberAdminButton();
  }

  function resetIdleTimer() {
    if (!state.user) return;
    lastActivityAt = Date.now();
    if (idlePaused || document.hidden) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!state.user || idlePaused || document.hidden) return;
      if (Date.now() - lastActivityAt < IDLE_LOGOUT_MS - 1000) {
        resetIdleTimer();
        return;
      }
      logoutUser("오래 사용하지 않아 자동 로그아웃되었습니다");
    }, IDLE_LOGOUT_MS);
  }

  function stopIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function pauseIdleLogout() {
    idlePaused = true;
    stopIdleTimer();
  }

  function resumeIdleLogout() {
    idlePaused = false;
    if (state.user) resetIdleTimer();
  }

  function scheduleSessionRecheck() {
    if (sessionRestoreTimer) clearTimeout(sessionRestoreTimer);
    sessionRestoreTimer = setTimeout(function () {
      sessionRestoreTimer = null;
      if (readSessionToken()) fetchCurrentUser({ soft: true, maxAttempts: 2 });
    }, 5000);
  }

  function restoreSessionOnResume() {
    pauseIdleLogout();
    hydrateSessionFromCache();
    if (state.user) onUserSessionReady();
    resumeIdleLogout();
    // Soft refresh only — never log out just because Kakao/other app stole focus.
    if (state.user || readSessionToken()) {
      fetchCurrentUser({ soft: true, maxAttempts: 3 });
    }
  }

  function bindIdleLogout() {
    if (idleEventsBound) return;
    idleEventsBound = true;
    ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"].forEach(function (evt) {
      document.addEventListener(evt, function () {
        if (state.user) resetIdleTimer();
      }, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        pauseIdleLogout();
      } else {
        restoreSessionOnResume();
      }
    });
    window.addEventListener("pagehide", function () {
      pauseIdleLogout();
    });
    window.addEventListener("pageshow", function () {
      restoreSessionOnResume();
    });
    window.addEventListener("focus", function () {
      if (!document.hidden) restoreSessionOnResume();
    });
    document.addEventListener("freeze", function () {
      pauseIdleLogout();
    }, { capture: true });
    document.addEventListener("resume", function () {
      restoreSessionOnResume();
    }, { capture: true });
  }

  function showOperatorNotice(notice) {
    if (!els.operatorNoticeOverlay || !notice || !notice.body) return;
    if (els.operatorNoticeBody) els.operatorNoticeBody.textContent = notice.body;
    els.operatorNoticeOverlay.hidden = false;
  }

  function closeOperatorNotice() {
    if (els.operatorNoticeOverlay) els.operatorNoticeOverlay.hidden = true;
    authFetch(apiUrl("/api/auth/notice/read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).catch(function () {});
  }

  function checkOperatorNotice() {
    if (!state.user) return Promise.resolve(null);
    return authFetch(apiUrl("/api/auth/notice"))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.notice) showOperatorNotice(data.notice);
        return data && data.notice;
      })
      .catch(function () { return null; });
  }

  function onUserSessionReady() {
    updateAccountButton();
    updateGoalsUI();
    if (state.user) {
      writeCachedUser(state.user);
      resetIdleTimer();
      checkOperatorNotice();
    } else {
      stopIdleTimer();
    }
  }

  function fetchCurrentUser(opts) {
    opts = opts || {};
    var soft = !!opts.soft;
    var attempt = opts.attempt || 0;
    var maxAttempts = opts.maxAttempts != null ? opts.maxAttempts : (soft ? 3 : 4);
    var token = readSessionToken();

    function keepLocalSession() {
      hydrateSessionFromCache();
      onUserSessionReady();
      if (token) scheduleSessionRecheck();
      return state.user;
    }

    function run() {
      return authFetch(apiUrl("/api/auth/me"))
        .then(function (res) {
          return res.json().then(function (data) {
            return { httpOk: res.ok, data: data };
          });
        })
        .then(function (result) {
          var data = result.data;
          if (data && data.ok && data.user) {
            rememberSession(token || readSessionToken(), data.user);
            closeAuthOverlay();
            onUserSessionReady();
            return state.user;
          }
          if (token && attempt + 1 < maxAttempts) {
            return delayMs(500 * Math.pow(2, attempt)).then(function () {
              return fetchCurrentUser({
                soft: soft,
                attempt: attempt + 1,
                maxAttempts: maxAttempts
              });
            });
          }
          // Soft (app resume): never wipe a still-cached login.
          if (soft || state.user || readCachedUser()) {
            return keepLocalSession();
          }
          // Cold start with token but server rejects it → real logout.
          clearSessionToken();
          state.user = null;
          onUserSessionReady();
          return null;
        })
        .catch(function () {
          if (token && attempt + 1 < maxAttempts) {
            return delayMs(500 * Math.pow(2, attempt)).then(function () {
              return fetchCurrentUser({
                soft: soft,
                attempt: attempt + 1,
                maxAttempts: maxAttempts
              });
            });
          }
          return keepLocalSession();
        });
    }

    if (sessionFetchInFlight && attempt === 0) {
      return sessionFetchInFlight;
    }
    var pending = run();
    if (attempt === 0) {
      sessionFetchInFlight = pending.finally(function () {
        if (sessionFetchInFlight === pending) sessionFetchInFlight = null;
      });
      return sessionFetchInFlight;
    }
    return pending;
  }

  function formatPhoneInput(raw) {
    var digits = String(raw || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
    return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
  }

  function openAuthOverlay(mode) {
    if (!els.authOverlay) return;
    state.authMode = mode === "register" ? "register" : "login";
    if (els.authModalTitle) {
      els.authModalTitle.textContent = state.authMode === "register" ? "회원 등록" : "로그인";
    }
    if (els.authSubmit) {
      els.authSubmit.textContent = state.authMode === "register" ? "등록" : "로그인";
    }
    if (els.authModalHint) {
      els.authModalHint.textContent = state.authMode === "register"
        ? "회원 등록 후 운영자 승인이 있어야 로그인할 수 있습니다."
        : "VisionforLife 학습 진도를 저장하려면 로그인하세요.";
    }
    if (els.authNameRow) els.authNameRow.hidden = state.authMode !== "register";
    if (els.authToggleMode) {
      els.authToggleMode.textContent = state.authMode === "register"
        ? "이미 계정이 있으신가요? 로그인"
        : "계정이 없으신가요? 등록";
    }
    els.authOverlay.hidden = false;
    if (els.authPhone) els.authPhone.focus();
  }

  function closeAuthOverlay() {
    if (els.authOverlay) els.authOverlay.hidden = true;
    if (els.authPassword) els.authPassword.value = "";
    if (els.authName) els.authName.value = "";
  }

  function submitAuth() {
    var phone = els.authPhone && els.authPhone.value.trim();
    var password = els.authPassword && els.authPassword.value;
    var name = els.authName && els.authName.value.trim();
    if (!phone || !password) {
      toast("휴대폰 번호와 비밀번호를 입력하세요");
      return;
    }
    var path = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    var body = { phone: phone, password: password };
    if (state.authMode === "register") body.name = name;
    authFetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || "인증에 실패했습니다");
          return;
        }
        if (state.authMode === "register" || result.data.pending) {
          toast((result.data && result.data.message) || "등록되었습니다. 운영자 승인 후 로그인하세요.");
          if (els.authPassword) els.authPassword.value = "";
          openAuthOverlay("login");
          return;
        }
        rememberSession(result.data.token, result.data.user);
        onUserSessionReady();
        closeAuthOverlay();
        if (state.screen === "course" && state.courseSlug) {
          loadCourseProgress(state.courseSlug).then(function () {
            renderFocus("static");
            updateProgressUI();
          });
        } else {
          loadCatalogsHome();
        }
        toast("로그인되었습니다");
      })
      .catch(function () {
        toast("서버에 연결할 수 없습니다 — serve.bat으로 실행하세요");
      });
  }

  function logoutUser(message) {
    stopIdleTimer();
    if (sessionRestoreTimer) {
      clearTimeout(sessionRestoreTimer);
      sessionRestoreTimer = null;
    }
    authFetch(apiUrl("/api/auth/logout"), { method: "POST" })
      .catch(function () { return null; })
      .then(function () {
        clearSessionToken();
        state.user = null;
        onUserSessionReady();
        loadCatalogsHome();
        toast(message || "로그아웃되었습니다");
      });
  }

  function initAuth() {
    if (!els.btnAccount) return;
    els.btnAccount.addEventListener("click", function () {
      if (state.user) logoutUser();
      else openAuthOverlay("login");
    });
    if (els.btnMemberAdmin) {
      els.btnMemberAdmin.addEventListener("click", openAdminUsersModal);
    }
    if (els.btnCatalogLogin) {
      els.btnCatalogLogin.addEventListener("click", function () {
        openAuthOverlay("login");
      });
    }
    if (els.btnCatalogRegister) {
      els.btnCatalogRegister.addEventListener("click", function () {
        openAuthOverlay("register");
      });
    }
    if (els.authCancel) els.authCancel.addEventListener("click", closeAuthOverlay);
    if (els.authSubmit) els.authSubmit.addEventListener("click", submitAuth);
    if (els.authToggleMode) {
      els.authToggleMode.addEventListener("click", function () {
        openAuthOverlay(state.authMode === "register" ? "login" : "register");
      });
    }
    if (els.authPhone) {
      els.authPhone.addEventListener("input", function () {
        var formatted = formatPhoneInput(els.authPhone.value);
        if (els.authPhone.value !== formatted) {
          els.authPhone.value = formatted;
        }
      });
      els.authPhone.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          if (els.authPassword) els.authPassword.focus();
          else submitAuth();
        }
      });
    }
    if (els.authPassword) {
      els.authPassword.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") submitAuth();
      });
    }
    if (els.operatorNoticeOk) {
      els.operatorNoticeOk.addEventListener("click", closeOperatorNotice);
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
    if (isLinearCourse()) {
      els.btnAddChild.textContent = "과 추가";
      return;
    }
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

  function linkifyScriptureInElement(root) {
    if (!root || !window.ScrLink || typeof ScrLink.splitToParts !== "function") return;
    var skip = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, BUTTON: 1, A: 1 };
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentElement;
      if (!p) continue;
      if (skip[p.tagName]) continue;
      if (p.closest && (p.closest(".scr-ref") || p.closest(".desc-aside-link") || p.closest(".desc-ext-link"))) continue;
      if (!node.textContent || !/\d/.test(node.textContent)) continue;
      nodes.push(node);
    }
    nodes.forEach(function (textNode) {
      var parts = ScrLink.splitToParts(textNode.textContent);
      if (!parts.length || (parts.length === 1 && !parts[0].ref)) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (part.ref) {
          var span = document.createElement("span");
          span.className = "scr-ref";
          span.setAttribute("role", "button");
          span.tabIndex = 0;
          span.setAttribute("data-ref", part.ref);
          span.textContent = part.label || part.ref;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part.text || ""));
        }
      });
      if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function linkifyScriptureHtml(html) {
    if (!html) return html;
    var temp = document.createElement("div");
    temp.innerHTML = html;
    linkifyScriptureInElement(temp);
    return temp.innerHTML;
  }

  /** Rich markdown, or plain text that contains scripture refs → HTML. Else null (plain path). */
  function descriptionToHtml(text) {
    if (!text) return "";
    if (window.FaithMarkdown && FaithMarkdown.isRich(text)) {
      return linkifyScriptureHtml(FaithMarkdown.toHtml(text));
    }
    if (window.ScrLink && typeof ScrLink.findRefs === "function" && ScrLink.findRefs(text).length) {
      return linkifyScriptureHtml('<p class="desc-p">' + esc(text).replace(/\n/g, "<br>") + "</p>");
    }
    return null;
  }

  var BIBLE = null;
  var BIBLE_PROMISE = null;

  function loadBible(cb) {
    if (BIBLE) {
      cb(BIBLE);
      return;
    }
    if (!BIBLE_PROMISE) {
      BIBLE_PROMISE = fetch(assetUrl("bible/verses.json"), { credentials: "same-origin" })
        .then(function (res) {
          if (!res.ok) throw new Error("bible");
          return res.json();
        })
        .then(function (data) {
          BIBLE = data;
          return data;
        });
    }
    BIBLE_PROMISE.then(cb).catch(function () {
      toast("성경 본문을 불러오지 못했습니다");
    });
  }

  function parseScrRef(ref) {
    var chapter = String(ref || "").match(/^(\S+)\s+(\d+)장$/);
    if (chapter) {
      return { book: chapter[1], kind: "chapter", ranges: [{ ch: parseInt(chapter[2], 10), v1: 1, v2: 999 }] };
    }
    var cross = String(ref || "").match(/^(\S+)\s+(\d+):(\d+)-(\d+):(\d+)$/);
    if (cross) {
      return {
        book: cross[1],
        kind: "verse",
        ranges: [{
          ch: parseInt(cross[2], 10),
          v1: parseInt(cross[3], 10),
          v2: parseInt(cross[5], 10),
          ch2: parseInt(cross[4], 10)
        }]
      };
    }
    var simple = String(ref || "").match(/^(\S+)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (simple) {
      var ch = parseInt(simple[2], 10);
      var v1 = parseInt(simple[3], 10);
      var v2 = simple[4] ? parseInt(simple[4], 10) : v1;
      return { book: simple[1], kind: "verse", ranges: [{ ch: ch, v1: v1, v2: v2 }] };
    }
    return null;
  }

  function expandScrRef(ref, bible) {
    var parsed = parseScrRef(ref);
    if (!parsed || !bible || !bible.books || !bible.books[parsed.book]) return [];
    var book = bible.books[parsed.book];
    var out = [];
    parsed.ranges.forEach(function (r) {
      if (parsed.kind === "chapter") {
        var chMap = book.c[String(r.ch)];
        if (!chMap) return;
        Object.keys(chMap).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) {
          out.push({ ch: r.ch, v: v, text: chMap[String(v)] });
        });
        return;
      }
      if (r.ch2 != null && r.ch2 !== r.ch) {
        var ch1 = book.c[String(r.ch)] || {};
        Object.keys(ch1).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) {
          if (v >= r.v1) out.push({ ch: r.ch, v: v, text: ch1[String(v)] });
        });
        for (var c = r.ch + 1; c < r.ch2; c++) {
          var mid = book.c[String(c)];
          if (!mid) continue;
          Object.keys(mid).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) {
            out.push({ ch: c, v: v, text: mid[String(v)] });
          });
        }
        var chLast = book.c[String(r.ch2)] || {};
        Object.keys(chLast).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) {
          if (v <= r.v2) out.push({ ch: r.ch2, v: v, text: chLast[String(v)] });
        });
        return;
      }
      for (var v = r.v1; v <= r.v2; v++) {
        var t = book.c[String(r.ch)] && book.c[String(r.ch)][String(v)];
        if (t) out.push({ ch: r.ch, v: v, text: t });
      }
    });
    return out;
  }

  function closeScrPopup() {
    if (els.scrScrim) {
      els.scrScrim.hidden = true;
      els.scrScrim.setAttribute("aria-hidden", "true");
    }
    if (els.scrPopup) els.scrPopup.hidden = true;
  }

  function openScrPopup(ref) {
    if (!ref || !els.scrPopup || !els.scrBody) return;
    loadBible(function (bible) {
      var verses = expandScrRef(ref, bible);
      if (!verses.length) {
        toast("성경 본문을 찾지 못했습니다");
        return;
      }
      var parsed = parseScrRef(ref);
      var bookMeta = parsed && bible.books[parsed.book];
      if (els.scrTitle) {
        els.scrTitle.textContent =
          (bookMeta ? bookMeta.name : (parsed && parsed.book) || "") +
          " · " +
          String(ref).replace(/^\S+\s*/, "");
      }
      els.scrBody.innerHTML = verses.map(function (v) {
        return '<p class="scr-verse"><b>' + v.ch + ":" + v.v + "</b>" + esc(v.text) + "</p>";
      }).join("");
      els.scrPopup.hidden = false;
      if (els.scrScrim) {
        els.scrScrim.hidden = false;
        els.scrScrim.setAttribute("aria-hidden", "false");
      }
      els.scrBody.scrollTop = 0;
    });
  }

  function bindScriptureUi() {
    if (bindScriptureUi._bound) return;
    bindScriptureUi._bound = true;
    if (els.scrClose) els.scrClose.addEventListener("click", closeScrPopup);
    if (els.scrScrim) els.scrScrim.addEventListener("click", closeScrPopup);
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest && ev.target.closest(".scr-ref");
      if (!el) return;
      if (!el.closest(".focus-desc, .aside-overlay__body")) return;
      ev.preventDefault();
      openScrPopup(el.getAttribute("data-ref"));
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var el = ev.target.closest && ev.target.closest(".scr-ref");
      if (!el) return;
      if (!el.closest(".focus-desc, .aside-overlay__body")) return;
      ev.preventDefault();
      openScrPopup(el.getAttribute("data-ref"));
    });
  }

  function renderDescription(el, text, animated, startDelay) {
    if (!text) {
      el.className = "focus-desc is-empty-static";
      el.innerHTML = "";
      el.textContent = "";
      return startDelay;
    }
    var html = descriptionToHtml(text);
    if (html != null) {
      if (!animated) {
        el.className = "focus-desc is-rich";
        el.innerHTML = html;
        return startDelay;
      }
      return revealRichDescription(el, html, startDelay);
    }
    if (!animated) {
      setPlainText(el, text, "focus-desc");
      return startDelay;
    }
    return revealDescription(el, text, startDelay);
  }

  function revealRichDescription(el, html, startDelay) {
    el.className = "focus-desc is-rich";
    el.innerHTML = "";
    var temp = document.createElement("div");
    temp.innerHTML = html || "";
    var delay = startDelay || 0;
    while (temp.firstChild) {
      var node = temp.firstChild;
      temp.removeChild(node);
      if (node.nodeType === 3) {
        if (!String(node.textContent || "").trim()) continue;
        var span = document.createElement("span");
        span.className = "reveal-chunk";
        span.style.animationDelay = delay + "s";
        span.textContent = node.textContent;
        el.appendChild(span);
        delay += REVEAL_CHUNK_S;
        continue;
      }
      if (node.nodeType !== 1) continue;
      // filter:blur 조상은 표 레이아웃을 깨뜨리므로 표는 감싸지 않음
      var isTable = node.classList && node.classList.contains("desc-table-wrap");
      if (isTable) {
        node.classList.add("desc-rich-reveal");
        node.style.animationDelay = delay + "s";
        el.appendChild(node);
        delay += REVEAL_CHUNK_S;
        continue;
      }
      var wrap = document.createElement("div");
      wrap.className = "reveal-block desc-rich-reveal";
      wrap.style.animationDelay = delay + "s";
      wrap.appendChild(node);
      el.appendChild(wrap);
      if (node.classList && node.classList.contains("desc-blank")) {
        delay += REVEAL_CHUNK_S * 0.35;
      } else {
        delay += REVEAL_CHUNK_S;
      }
    }
    return delay + 0.06;
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

    var showChildren = hasKids && (
      atHome ||
      state.childrenOpen ||
      (state.admin && !atHome) ||
      (isLinearCourse() && !atHome)
    );

    els.focusCard.hidden = false;
    els.expandWrap.hidden = !hasKids || atHome || (isLinearCourse() && !atHome);
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
    updateResetButtonLabel();
    renderBreadcrumb();
    renderOutlineTreePanel();

    if (state.admin) fillEditor(getEditNode());
    updateAdminButtons();
    updateProgressUI();
    updateHash();
  }

  function lessonAccessBlocked(id) {
    if (state.user || state.admin || hasLocalSession()) return false;
    if (!state.data) return false;
    // 공개용: 비회원도 전체 열람. 회원용: 소개(root)만, 제1과부터 로그인.
    if (!catalogRequiresMemberLessons(state.activeCatalogSlug)) return false;
    return id && id !== state.data.rootId;
  }

  function promptLessonLogin() {
    if (hasLocalSession()) {
      hydrateSessionFromCache();
      if (state.user) onUserSessionReady();
      fetchCurrentUser({ soft: true, maxAttempts: 4 });
      return;
    }
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
    var navForward = pushTrail !== false && id !== state.centerId;
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
    if (navForward) syncUrl();
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
      // 단계 중: 과정 소개(처음으로). 루트에서만 상위(과정 목록/홈).
      if (state.data && !isAtRoot()) {
        courseRootView();
        return;
      }
      var cat = state.activeCatalogSlug;
      var courseCount = coursesInActiveCatalogCount(cat);
      if (cat && (state.adminCatalog || courseCount > 1)) {
        showCatalogCourses(cat, { autoOpen: false });
      } else {
        showCatalogsHome();
      }
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
    renderAsideList(node);
    fillMoveEditor(node.id);
    fillReorderEditor(node.id);
    fillAiDraft(node);
  }

  function asideMarkerIds(desc) {
    var ids = {};
    var re = /\[\[aside:([a-zA-Z0-9_-]+)\|/g;
    var m;
    while ((m = re.exec(String(desc || ""))) !== null) ids[m[1]] = true;
    return ids;
  }

  function renderAsideList(node) {
    if (!els.asideList) return;
    var list = (node && Array.isArray(node.asides)) ? node.asides : [];
    if (!list.length) {
      els.asideList.hidden = true;
      els.asideList.innerHTML = "";
      return;
    }
    var linked = asideMarkerIds(node && node.description);
    els.asideList.hidden = false;
    els.asideList.innerHTML =
      '<p class="admin-section-title">부가설명</p>' +
      list.map(function (a) {
        var missing = !(a && a.id && linked[a.id]);
        return (
          '<div class="admin-aside-item' + (missing ? " is-unlinked" : "") + '" data-aside-id="' + esc(a.id) + '">' +
            '<span class="admin-aside-item-label">' + esc(a.label || a.id) +
            (missing ? ' <span class="admin-aside-unlinked">(설명에 링크 없음 — 붙여넣기 또는 삭제)</span>' : "") +
            "</span>" +
            '<div class="admin-aside-item-actions">' +
              '<button type="button" class="btn btn-sm admin-aside-edit" data-aside-id="' + esc(a.id) + '">수정</button>' +
              '<button type="button" class="btn btn-sm btn-danger admin-aside-delete" data-aside-id="' + esc(a.id) + '">삭제</button>' +
            "</div>" +
          "</div>"
        );
      }).join("");
  }

  function deleteAsideFromEditor(asideId) {
    var node = nodeById(getEditNodeId());
    if (!node || !asideId) return;
    node.asides = (node.asides || []).filter(function (a) { return a.id !== asideId; });
    if (els.editDesc) {
      var re = new RegExp("\\[\\[aside:" + asideId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\|[^\\]]*\\]\\]", "g");
      els.editDesc.value = els.editDesc.value.replace(re, "");
    }
    syncEditorToState();
    renderAsideList(node);
    toast("부가설명을 삭제했습니다 — 저장을 눌러 반영하세요");
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
    if (els.btnAiCopy) els.btnAiCopy.disabled = !enabled;
    if (els.btnAiInsert) els.btnAiInsert.disabled = !enabled;
    if (els.btnAiAppend) els.btnAiAppend.disabled = !enabled;
  }

  function copyAiAnswer() {
    if (!els.aiAnswer) return;
    var text = els.aiAnswer.value;
    if (!String(text || "").trim()) {
      toast("복사할 답변이 없습니다");
      return;
    }
    function done() {
      toast("마크다운 원문을 복사했습니다");
    }
    function fail() {
      toast("복사에 실패했습니다 — 원문 칸에서 직접 선택해 주세요");
    }
    function fallbackCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) done();
        else fail();
      } catch (e2) {
        fail();
      }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
        return;
      }
    } catch (e1) { /* fall through */ }
    fallbackCopy();
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
    fetch(apiUrl("/api/ai/ask"), {
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

  var HYMN_MEDIA_PROXY = "https://thegospel.kr/hymnapp/share_media.php?path=";
  var HYMN_MEDIA_BASE = "https://pub-fd0b5ed8579a4d5ebefa16ccafcda750.r2.dev";
  var hymnTitlesCache = null;
  var hymnTitlesPromise = null;
  var activeHymnNum = null;
  var hymnSeekDragging = false;

  function hymnMp3Url(num, useProxy) {
    var n = parseInt(num, 10);
    if (!n || n < 1) return "";
    var entry = "hymnapp/Audio/" + String(n).padStart(4, "0") + ".mp3";
    if (useProxy) return HYMN_MEDIA_PROXY + encodeURIComponent(entry);
    return HYMN_MEDIA_BASE + "/" + entry;
  }

  function loadHymnTitles() {
    if (hymnTitlesCache) return Promise.resolve(hymnTitlesCache);
    if (hymnTitlesPromise) return hymnTitlesPromise;
    // Same-origin API proxy — direct hymnapp/titles.json is blocked by CORS on localhost.
    hymnTitlesPromise = fetch(apiUrl("/api/hymn/titles"), { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("titles load failed");
        return res.json();
      })
      .then(function (data) {
        var list = (data && data.titles) || (Array.isArray(data) ? data : []);
        var map = {};
        (list || []).forEach(function (item) {
          if (item && item.num != null) map[String(item.num)] = item.title || "";
        });
        hymnTitlesCache = map;
        return map;
      })
      .catch(function () {
        hymnTitlesPromise = null;
        return {};
      });
    return hymnTitlesPromise;
  }

  function hymnTitle(num) {
    if (!hymnTitlesCache) return "";
    return hymnTitlesCache[String(num)] || "";
  }

  function insertAtDescCursor(text) {
    if (!els.editDesc) return;
    var ta = els.editDesc;
    var start = typeof ta.selectionStart === "number" ? ta.selectionStart : ta.value.length;
    var end = typeof ta.selectionEnd === "number" ? ta.selectionEnd : start;
    var before = ta.value.slice(0, start);
    var after = ta.value.slice(end);
    var needsLead = before.length && !/\n$/.test(before);
    var needsTrail = after.length && !/^\n/.test(after);
    var chunk = (needsLead ? "\n" : "") + text + (needsTrail ? "\n" : "");
    ta.value = before + chunk + after;
    var caret = before.length + chunk.length;
    ta.focus();
    try { ta.setSelectionRange(caret, caret); } catch (e) { /* ignore */ }
    syncEditorToState();
  }

  function insertHymnAtCursor() {
    var raw = window.prompt("추가할 찬송가 장 번호 (예: 265)", "");
    if (raw == null) return;
    var num = parseInt(String(raw).replace(/\D/g, ""), 10);
    if (!num || num < 1) {
      toast("올바른 장 번호를 입력하세요");
      return;
    }
    loadHymnTitles().then(function () {
      var title = hymnTitle(num);
      var line = title
        ? "**찬송가 " + num + "장 - " + title + "**"
        : "**찬송가 " + num + "장**";
      // Leading --- becomes a visible divider above the hymn player.
      insertAtDescCursor("---\n" + line);
      toast(title
        ? "찬송가 " + num + "장을 넣었습니다 — 저장을 눌러 반영하세요"
        : "제목을 못 찾아 번호만 넣었습니다 — 저장을 눌러 반영하세요");
    });
  }

  function openLinkForm() {
    if (!els.linkFormOverlay) return;
    if (!state.admin || !getEditNodeId()) {
      toast("편집 중인 노드가 없습니다");
      return;
    }
    if (els.linkFormUrl) els.linkFormUrl.value = "https://";
    if (els.linkFormLabel) els.linkFormLabel.value = "홈페이지 열기";
    els.linkFormOverlay.hidden = false;
    try {
      if (els.linkFormUrl) {
        els.linkFormUrl.focus();
        els.linkFormUrl.select();
      }
    } catch (eFocus) { /* ignore */ }
  }

  function closeLinkForm() {
    if (els.linkFormOverlay) els.linkFormOverlay.hidden = true;
  }

  function submitLinkForm() {
    var url = els.linkFormUrl ? String(els.linkFormUrl.value || "").trim() : "";
    if (!/^https?:\/\//i.test(url)) {
      toast("http:// 또는 https:// 로 시작하는 주소를 입력하세요");
      if (els.linkFormUrl) els.linkFormUrl.focus();
      return;
    }
    if (/[|\]]/.test(url)) {
      toast("주소에 | 또는 ] 문자는 사용할 수 없습니다");
      if (els.linkFormUrl) els.linkFormUrl.focus();
      return;
    }
    var label = els.linkFormLabel
      ? String(els.linkFormLabel.value || "").trim().replace(/[\r\n]+/g, " ").replace(/\]/g, "")
      : "";
    if (!label) label = "홈페이지 열기";
    insertAtDescCursor("[[link:" + url + "|" + label + "]]");
    closeLinkForm();
    toast("링크를 넣었습니다 — 저장을 눌러 반영하세요");
  }

  function insertLinkAtCursor() {
    openLinkForm();
  }

  var IMAGE_MAX_BYTES = 4 * 1024 * 1024;
  var IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

  function openImageForm() {
    if (!els.imageFormOverlay) return;
    if (!state.admin || !getEditNodeId()) {
      toast("편집 중인 노드가 없습니다");
      return;
    }
    if (!state.courseSlug) {
      toast("과정이 선택되지 않았습니다");
      return;
    }
    if (els.imageFormFile) els.imageFormFile.value = "";
    if (els.imageFormAlt) els.imageFormAlt.value = "";
    els.imageFormOverlay.hidden = false;
    try {
      if (els.imageFormFile) els.imageFormFile.focus();
    } catch (eFocus) { /* ignore */ }
  }

  function closeImageForm() {
    if (els.imageFormOverlay) els.imageFormOverlay.hidden = true;
  }

  function submitImageForm() {
    if (!els.imageFormFile || !els.imageFormFile.files || !els.imageFormFile.files[0]) {
      toast("그림 파일을 선택하세요");
      return;
    }
    var file = els.imageFormFile.files[0];
    if (!IMAGE_EXT_RE.test(file.name || "")) {
      toast("png · jpg · gif · webp · svg 파일만 가능합니다");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast("파일이 너무 큽니다 (최대 4MB)");
      return;
    }
    var alt = els.imageFormAlt
      ? String(els.imageFormAlt.value || "").trim().replace(/[\r\n]+/g, " ").replace(/[\[\]]/g, "")
      : "";
    if (!alt) {
      alt = String(file.name || "그림").replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "") || "그림";
    }
    var btn = els.imageFormSubmit;
    if (btn) btn.disabled = true;
    var reader = new FileReader();
    reader.onerror = function () {
      if (btn) btn.disabled = false;
      toast("파일을 읽지 못했습니다");
    };
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var comma = dataUrl.indexOf(",");
      var b64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      if (!b64) {
        if (btn) btn.disabled = false;
        toast("파일을 읽지 못했습니다");
        return;
      }
      fetch(apiUrl("/api/course-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          courseSlug: state.courseSlug,
          filename: file.name,
          contentBase64: b64,
          pin: state.adminPin || LOCAL_ADMIN_PIN || ""
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, status: res.status, data: data || {} };
          }).catch(function () {
            return { ok: false, status: res.status, data: {} };
          });
        })
        .then(function (result) {
          if (btn) btn.disabled = false;
          if (!result.ok) {
            var err = (result.data && (result.data.error || result.data.message)) || "";
            if (result.status === 501) {
              toast("그림 업로드는 집 PC 서버(serve.bat)에서만 가능합니다");
            } else {
              toast(err || "그림 업로드에 실패했습니다");
            }
            return;
          }
          var rel = result.data.path || ("data/courses/" + state.courseSlug + "/images/" + (result.data.filename || file.name));
          insertAtDescCursor("![" + alt + "](" + rel + ")");
          closeImageForm();
          toast("그림을 넣었습니다 — 저장을 눌러 반영하세요");
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          toast("그림 업로드에 실패했습니다 — serve.bat를 확인하세요");
        });
    };
    reader.readAsDataURL(file);
  }

  function insertImageAtCursor() {
    openImageForm();
  }

  var pendingExternalLink = "";

  function isPhoneAppShell() {
    var ua = navigator.userAgent || "";
    var standalone = false;
    try {
      standalone = !!(
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.navigator.standalone
      );
    } catch (e) { /* ignore */ }
    if (/Android/i.test(ua) && standalone) return true;
    if (/iPhone|iPad|iPod/i.test(ua) && standalone) return true;
    return false;
  }

  function closeLinkOpenSheet() {
    pendingExternalLink = "";
    if (els.linkOpenOverlay) els.linkOpenOverlay.hidden = true;
  }

  function openLinkOpenSheet(url, label) {
    pendingExternalLink = url;
    if (els.linkOpenUrl) els.linkOpenUrl.textContent = url;
    if (els.linkOpenShare) {
      els.linkOpenShare.hidden = !(navigator.share);
    }
    if (els.linkOpenOverlay) els.linkOpenOverlay.hidden = false;
    try {
      if (els.linkOpenShare && !els.linkOpenShare.hidden) els.linkOpenShare.focus();
      else if (els.linkOpenCopy) els.linkOpenCopy.focus();
    } catch (eF) { /* ignore */ }
  }

  function copyExternalLink() {
    var url = pendingExternalLink;
    if (!url) return;
    function done() {
      toast("주소를 복사했습니다. 브라우저에 붙여넣어 여세요");
      closeLinkOpenSheet();
    }
    function fail() {
      toast("복사에 실패했습니다. 주소를 길게 눌러 복사하세요");
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {
          try {
            var ta = document.createElement("textarea");
            ta.value = url;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand("copy");
            document.body.removeChild(ta);
            if (ok) done();
            else fail();
          } catch (e2) {
            fail();
          }
        });
        return;
      }
    } catch (e1) { /* fall through */ }
    try {
      var ta2 = document.createElement("textarea");
      ta2.value = url;
      ta2.setAttribute("readonly", "");
      ta2.style.position = "fixed";
      ta2.style.left = "-9999px";
      document.body.appendChild(ta2);
      ta2.select();
      var ok2 = document.execCommand("copy");
      document.body.removeChild(ta2);
      if (ok2) done();
      else fail();
    } catch (e3) {
      fail();
    }
  }

  function shareExternalLink() {
    var url = pendingExternalLink;
    if (!url) return;
    if (!navigator.share) {
      copyExternalLink();
      return;
    }
    navigator.share({ title: document.title || "VisionforLife", url: url, text: url })
      .then(function () {
        closeLinkOpenSheet();
      })
      .catch(function (err) {
        // User canceled share sheet — keep the panel open.
        if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) return;
        copyExternalLink();
      });
  }

  function openExternalDescLink(href, label) {
    var raw = String(href || "").trim();
    if (!raw) return;
    var absolute;
    try {
      absolute = new URL(raw, location.href).href;
    } catch (eUrl) {
      return;
    }
    if (!/^https?:\/\//i.test(absolute)) return;

    // Phone PWA/WebAPK cannot leave to a real browser tab reliably — share/copy instead.
    if (isPhoneAppShell()) {
      openLinkOpenSheet(absolute, label || "");
      return;
    }

    try {
      var opened = window.open(absolute, "_blank", "noopener,noreferrer");
      if (opened) {
        try { opened.opener = null; } catch (e0) { /* ignore */ }
        return;
      }
    } catch (e1) { /* fall through */ }
    openLinkOpenSheet(absolute, label || "");
  }

  function bindExternalLinkClicks(root) {
    if (!root || root._extLinkBound) return;
    root._extLinkBound = true;
    root.addEventListener("click", function (ev) {
      var link = ev.target.closest && ev.target.closest("a.desc-ext-link");
      if (!link) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      openExternalDescLink(link.getAttribute("href") || link.href, (link.textContent || "").trim());
    }, true);
  }

  var asideScrollY = 0;
  var editingAsideId = null;
  var asideFormDrag = null;

  function centerAsideFormModal() {
    var modal = els.asideFormModal;
    if (!modal) return;
    modal.style.position = "fixed";
    modal.style.margin = "0";
    modal.style.transform = "none";
    // Measure after visible; fall back to viewport center.
    var w = modal.offsetWidth || Math.min(480, window.innerWidth * 0.92);
    var h = modal.offsetHeight || 360;
    var left = Math.max(12, Math.round((window.innerWidth - w) / 2));
    var top = Math.max(12, Math.round((window.innerHeight - h) / 2));
    modal.style.left = left + "px";
    modal.style.top = top + "px";
  }

  function openAsideForm(asideId) {
    if (!els.asideFormOverlay) return;
    if (!state.admin || !getEditNodeId()) {
      toast("편집 중인 노드가 없습니다");
      return;
    }
    editingAsideId = asideId || null;
    var existing = editingAsideId ? findAside(editingAsideId) : null;
    if (els.asideFormTitle) {
      els.asideFormTitle.textContent = existing ? "부가설명 수정" : "부가설명 추가";
    }
    if (els.asideFormSubmit) {
      els.asideFormSubmit.textContent = existing ? "수정 반영" : "넣기";
    }
    if (els.asideFormLabel) {
      els.asideFormLabel.value = existing ? (existing.label || "자세히 알기") : "자세히 알기";
    }
    if (els.asideFormBody) {
      els.asideFormBody.value = existing ? (existing.body || "") : "";
    }
    els.asideFormOverlay.hidden = false;
    centerAsideFormModal();
    if (els.asideFormLabel) els.asideFormLabel.focus();
  }

  function closeAsideForm() {
    editingAsideId = null;
    asideFormDrag = null;
    if (els.asideFormOverlay) els.asideFormOverlay.hidden = true;
  }

  function submitAsideForm() {
    var label = (els.asideFormLabel && els.asideFormLabel.value.trim()) || "자세히 알기";
    var body = (els.asideFormBody && els.asideFormBody.value.trim()) || "";
    if (!body) {
      toast("부가설명 본문을 입력하세요");
      return;
    }
    var node = nodeById(getEditNodeId());
    if (!node) {
      toast("편집 중인 노드가 없습니다");
      return;
    }
    if (!Array.isArray(node.asides)) node.asides = [];

    if (editingAsideId) {
      var found = null;
      for (var i = 0; i < node.asides.length; i++) {
        if (node.asides[i] && node.asides[i].id === editingAsideId) {
          found = node.asides[i];
          break;
        }
      }
      if (!found) {
        toast("수정할 부가설명을 찾을 수 없습니다");
        return;
      }
      found.label = label;
      found.body = body;
      if (els.editDesc) {
        var re = new RegExp(
          "\\[\\[aside:" + editingAsideId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\|[^\\]]*\\]\\]",
          "g"
        );
        els.editDesc.value = els.editDesc.value.replace(
          re,
          "[[" + "aside:" + editingAsideId + "|" + label + "]]"
        );
      }
      syncEditorToState();
      renderAsideList(node);
      closeAsideForm();
      toast("부가설명을 수정했습니다 — 저장을 눌러 반영하세요");
      return;
    }

    var id = "aside-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    node.asides.push({ id: id, label: label, body: body });
    insertAtDescCursor("[[" + "aside:" + id + "|" + label + "]]");
    renderAsideList(node);
    closeAsideForm();
    toast("부가설명을 넣었습니다 — 저장을 눌러 반영하세요");
  }

  function findAside(asideId) {
    var node = nodeById(state.centerId) || (state.admin ? nodeById(getEditNodeId()) : null);
    if (!node || !Array.isArray(node.asides)) return null;
    for (var i = 0; i < node.asides.length; i++) {
      if (node.asides[i] && node.asides[i].id === asideId) return node.asides[i];
    }
    return null;
  }

  function openAside(asideId) {
    var aside = findAside(asideId);
    if (!aside) {
      toast("부가설명을 찾을 수 없습니다");
      return;
    }
    if (!els.asideOverlay) return;
    asideScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var title = aside.label || "부가설명";
    var body = aside.body || "";
    if (els.asideOverlayTitle) {
      revealTitle(els.asideOverlayTitle, title);
      els.asideOverlayTitle.className = "aside-overlay__title";
    }
    if (els.asideOverlayBody) {
      var titleEnd = title ? title.length * REVEAL_CHAR_S + 0.12 : 0;
      // 설명과 동일한 마크다운 경로 (표·제목·목록·찬송 등)
      renderDescription(els.asideOverlayBody, body, true, titleEnd);
      els.asideOverlayBody.className = "aside-overlay__body focus-desc is-rich";
    }
    els.asideOverlay.hidden = false;
    document.body.classList.add("aside-open");
    document.body.style.top = "-" + asideScrollY + "px";
  }

  function closeAside() {
    if (!els.asideOverlay || els.asideOverlay.hidden) return;
    els.asideOverlay.hidden = true;
    document.body.classList.remove("aside-open");
    document.body.style.top = "";
    window.scrollTo(0, asideScrollY || 0);
  }

  function bindAsideFormDrag() {
    var handle = els.asideFormTitle;
    var modal = els.asideFormModal;
    if (!handle || !modal || handle._asideDragBound) return;
    handle._asideDragBound = true;

    function onMove(ev) {
      if (!asideFormDrag) return;
      var left = asideFormDrag.startLeft + (ev.clientX - asideFormDrag.startX);
      var top = asideFormDrag.startTop + (ev.clientY - asideFormDrag.startY);
      var maxL = Math.max(12, window.innerWidth - modal.offsetWidth - 12);
      var maxT = Math.max(12, window.innerHeight - Math.min(modal.offsetHeight, window.innerHeight - 24) - 12);
      left = Math.min(Math.max(12, left), maxL);
      top = Math.min(Math.max(12, top), maxT);
      modal.style.left = left + "px";
      modal.style.top = top + "px";
    }

    function onUp() {
      if (!asideFormDrag) return;
      asideFormDrag = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    }

    handle.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      // Only drag from the title handle — never from inputs.
      if (ev.target !== handle && !handle.contains(ev.target)) return;
      if (ev.target.closest && ev.target.closest("input, textarea, button, label")) return;
      var rect = modal.getBoundingClientRect();
      asideFormDrag = {
        startX: ev.clientX,
        startY: ev.clientY,
        startLeft: rect.left,
        startTop: rect.top
      };
      modal.style.position = "fixed";
      modal.style.left = rect.left + "px";
      modal.style.top = rect.top + "px";
      modal.style.margin = "0";
      modal.style.transform = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
      ev.preventDefault();
    });
  }

  function bindAsideUi() {
    if (els.btnInsertAside) {
      els.btnInsertAside.addEventListener("click", function () { openAsideForm(null); });
    }
    if (els.asideFormCancel) els.asideFormCancel.addEventListener("click", closeAsideForm);
    if (els.asideFormSubmit) els.asideFormSubmit.addEventListener("click", submitAsideForm);
    if (els.linkFormCancel) els.linkFormCancel.addEventListener("click", closeLinkForm);
    if (els.linkFormSubmit) els.linkFormSubmit.addEventListener("click", submitLinkForm);
    if (els.imageFormCancel) els.imageFormCancel.addEventListener("click", closeImageForm);
    if (els.imageFormSubmit) els.imageFormSubmit.addEventListener("click", submitImageForm);
    if (els.linkOpenCancel) els.linkOpenCancel.addEventListener("click", closeLinkOpenSheet);
    if (els.linkOpenCopy) els.linkOpenCopy.addEventListener("click", copyExternalLink);
    if (els.linkOpenShare) els.linkOpenShare.addEventListener("click", shareExternalLink);
    if (els.linkFormUrl) {
      els.linkFormUrl.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          if (els.linkFormLabel) els.linkFormLabel.focus();
        }
      });
    }
    if (els.linkFormLabel) {
      els.linkFormLabel.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          submitLinkForm();
        }
      });
    }
    // Do NOT close on backdrop click — selecting text in the textarea often
    // ends with mouseup on the dimmed overlay and would dismiss the editor.
    bindAsideFormDrag();
    if (els.asideList) {
      els.asideList.addEventListener("click", function (ev) {
        var editBtn = ev.target.closest && ev.target.closest(".admin-aside-edit");
        if (editBtn) {
          openAsideForm(editBtn.getAttribute("data-aside-id"));
          return;
        }
        var delBtn = ev.target.closest && ev.target.closest(".admin-aside-delete");
        if (delBtn) deleteAsideFromEditor(delBtn.getAttribute("data-aside-id"));
      });
    }
    if (els.asideOverlayBack) els.asideOverlayBack.addEventListener("click", closeAside);
    if (els.asideOverlay) {
      els.asideOverlay.addEventListener("click", function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-aside-close") != null) {
          closeAside();
        }
      });
    }
    if (els.focusDesc && !els.focusDesc._asideBound) {
      els.focusDesc._asideBound = true;
      els.focusDesc.addEventListener("click", function (ev) {
        var link = ev.target.closest && ev.target.closest(".desc-aside-link");
        if (!link) return;
        ev.preventDefault();
        openAside(link.getAttribute("data-aside-id"));
      });
    }
    bindExternalLinkClicks(els.focusDesc);
    bindExternalLinkClicks(els.asideOverlayBody);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (els.scrPopup && !els.scrPopup.hidden) closeScrPopup();
        else if (els.asideOverlay && !els.asideOverlay.hidden) closeAside();
        else if (els.linkOpenOverlay && !els.linkOpenOverlay.hidden) closeLinkOpenSheet();
        else if (els.imageFormOverlay && !els.imageFormOverlay.hidden) closeImageForm();
        else if (els.linkFormOverlay && !els.linkFormOverlay.hidden) closeLinkForm();
        else if (els.asideFormOverlay && !els.asideFormOverlay.hidden) closeAsideForm();
      }
    });
  }

  function formatHymnTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function hymnPlayerEls(num) {
    var root = document.querySelector('.desc-hymn[data-hymn-num="' + num + '"]');
    if (!root) return null;
    return {
      root: root,
      play: root.querySelector(".desc-hymn-play"),
      seek: root.querySelector(".desc-hymn-seek"),
      cur: root.querySelector(".desc-hymn-cur"),
      dur: root.querySelector(".desc-hymn-dur")
    };
  }

  function setHymnPlayLabel(num, playing) {
    var ui = hymnPlayerEls(num);
    if (!ui || !ui.play) return;
    ui.play.textContent = playing ? "❚❚" : "▶";
    ui.play.setAttribute("aria-label", playing ? "일시정지" : ("찬송가 " + num + "장 재생"));
    ui.root.classList.toggle("is-playing", !!playing);
  }

  function resetHymnPlayersExcept(keepNum) {
    document.querySelectorAll(".desc-hymn").forEach(function (el) {
      var n = el.getAttribute("data-hymn-num");
      if (keepNum != null && String(n) === String(keepNum)) return;
      setHymnPlayLabel(n, false);
      var seek = el.querySelector(".desc-hymn-seek");
      var cur = el.querySelector(".desc-hymn-cur");
      if (seek && !hymnSeekDragging) seek.value = "0";
      if (cur) cur.textContent = "0:00";
    });
  }

  function syncHymnProgress() {
    if (!els.hymnAudio || activeHymnNum == null || hymnSeekDragging) return;
    var ui = hymnPlayerEls(activeHymnNum);
    if (!ui) return;
    var dur = els.hymnAudio.duration;
    var cur = els.hymnAudio.currentTime || 0;
    if (ui.dur && isFinite(dur)) ui.dur.textContent = formatHymnTime(dur);
    if (ui.cur) ui.cur.textContent = formatHymnTime(cur);
    if (ui.seek && isFinite(dur) && dur > 0) {
      ui.seek.value = String(Math.round((cur / dur) * 1000));
    }
  }

  function playHymn(num) {
    if (!els.hymnAudio) return;
    var url = hymnMp3Url(num);
    if (!url) return;
    var same = activeHymnNum != null && String(activeHymnNum) === String(num);
    if (same && !els.hymnAudio.paused) {
      els.hymnAudio.pause();
      setHymnPlayLabel(num, false);
      return;
    }
    if (!same) {
      activeHymnNum = num;
      resetHymnPlayersExcept(num);
      els.hymnAudio.src = url;
      els.hymnAudio.load();
    }
    var playPromise = els.hymnAudio.play();
    setHymnPlayLabel(num, true);
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        // R2 blocked → same-origin proxy fallback
        var proxy = hymnMp3Url(num, true);
        if (els.hymnAudio.src.indexOf("share_media.php") < 0 && proxy) {
          els.hymnAudio.src = proxy;
          els.hymnAudio.load();
          return els.hymnAudio.play().then(function () {
            setHymnPlayLabel(num, true);
          }).catch(function () {
            setHymnPlayLabel(num, false);
            toast("찬송가 재생에 실패했습니다");
          });
        }
        setHymnPlayLabel(num, false);
        toast("찬송가 재생에 실패했습니다");
      });
    }
  }

  function seekHymn(num, ratio) {
    if (!els.hymnAudio) return;
    if (activeHymnNum == null || String(activeHymnNum) !== String(num)) {
      activeHymnNum = num;
      resetHymnPlayersExcept(num);
      els.hymnAudio.src = hymnMp3Url(num);
      els.hymnAudio.load();
    }
    function apply() {
      var dur = els.hymnAudio.duration;
      if (!isFinite(dur) || dur <= 0) return;
      els.hymnAudio.currentTime = Math.max(0, Math.min(dur, ratio * dur));
      syncHymnProgress();
    }
    if (isFinite(els.hymnAudio.duration) && els.hymnAudio.duration > 0) apply();
    else {
      els.hymnAudio.addEventListener("loadedmetadata", function onMeta() {
        els.hymnAudio.removeEventListener("loadedmetadata", onMeta);
        apply();
      });
    }
  }

  function bindHymnPlayer() {
    if (!els.focusDesc || els.focusDesc._hymnBound) return;
    els.focusDesc._hymnBound = true;
    els.focusDesc.addEventListener("click", function (ev) {
      var btn = ev.target.closest && ev.target.closest(".desc-hymn-play");
      if (!btn) return;
      ev.preventDefault();
      var num = parseInt(btn.getAttribute("data-hymn-num"), 10);
      if (num) playHymn(num);
    });
    els.focusDesc.addEventListener("input", function (ev) {
      var seek = ev.target.closest && ev.target.closest(".desc-hymn-seek");
      if (!seek) return;
      var num = parseInt(seek.getAttribute("data-hymn-num"), 10);
      if (!num) return;
      seekHymn(num, (parseInt(seek.value, 10) || 0) / 1000);
    });
    els.focusDesc.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest && ev.target.closest(".desc-hymn-seek")) hymnSeekDragging = true;
    });
    document.addEventListener("pointerup", function () {
      hymnSeekDragging = false;
      syncHymnProgress();
    });
    if (els.hymnAudio) {
      els.hymnAudio.addEventListener("timeupdate", syncHymnProgress);
      els.hymnAudio.addEventListener("loadedmetadata", syncHymnProgress);
      els.hymnAudio.addEventListener("ended", function () {
        if (activeHymnNum != null) setHymnPlayLabel(activeHymnNum, false);
        syncHymnProgress();
      });
      els.hymnAudio.addEventListener("pause", function () {
        if (activeHymnNum != null && els.hymnAudio.paused) setHymnPlayLabel(activeHymnNum, false);
      });
      els.hymnAudio.addEventListener("play", function () {
        if (activeHymnNum != null) {
          resetHymnPlayersExcept(activeHymnNum);
          setHymnPlayLabel(activeHymnNum, true);
        }
      });
    }
  }

  function ensureCenterNode() {
    if (!state.data) return null;
    if (!state.centerId || !nodeById(state.centerId)) {
      state.centerId = state.data.rootId;
    }
    if (!state.explored.length) state.explored = buildExploredPath(state.centerId);
    return nodeById(state.centerId);
  }

  function enterAdmin(pin) {
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
      if (pin) state.adminPin = pin;
      else if (SKIP_ADMIN_PIN && !state.adminPin) state.adminPin = LOCAL_ADMIN_PIN || "";
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
      toast(SKIP_ADMIN_PIN ? "운영자 모드 (로컬 · PIN 생략)" : "운영자 모드 — 편집 후 저장하세요");
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
    // 부가설명은 마커 잘라내기·붙이기 중에도 유지한다.
    // (마커가 잠깐 없다고 prune 하면 본문이 사라짐 — 삭제는 삭제 버튼만)
  }

  function applyEditor() {
    syncEditorToState();
    renderFocus("static");
  }

  function onEditorInput() {
    syncEditorToState();
    var node = nodeById(getEditNodeId());
    if (node) renderAsideList(node);
  }

  function newId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addChild() {
    if (!state.centerId && !isAtRoot()) {
      toast("현재 노드가 없습니다");
      return;
    }
    var parentId;
    if (isLinearCourse()) {
      // linear: 체인 끝에 이어 붙인다 (root 직속 분기는 만들지 않음)
      if (!state.data.meta) state.data.meta = {};
      state.data.meta.layout = "linear";
      var chain = linearCourseLessons();
      parentId = chain.length ? chain[chain.length - 1].id : state.data.rootId;
    } else {
      parentId = isAtRoot() ? state.data.rootId : state.centerId;
    }
    var id = newId();
    state.data.nodes.push({
      id: id,
      title: isLinearCourse() ? "새 과" : "새 질문",
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
    if (isLinearCourse()) {
      state.centerId = state.data.rootId;
      state.explored = [state.data.rootId];
      state.adminEditId = id;
      fillEditor(nodeById(id));
      renderFocus("static");
      toast("새 과가 추가되었습니다");
      return;
    }
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
    var id = getEditNodeId();
    if (!id || !state.data || id === state.data.rootId) {
      toast("루트 노드는 삭제할 수 없습니다");
      return;
    }
    var node = nodeById(id);
    if (!node) {
      toast("삭제할 주제를 찾을 수 없습니다");
      return;
    }
    var title = (node.title || "이 주제").trim() || "이 주제";

    // 선형 과정(과 체인): 한 과만 빼고 앞뒤를 다시 잇는다.
    // (기존 트리 삭제면 1과 삭제가 2과~끝까지 전부 지워져 위험함)
    if (isLinearCourse()) {
      var parentId = parentOf(id);
      var kids = childrenOf(id);
      var msg =
        "「" + title + "」만 삭제할까요?\n" +
        (kids.length
          ? "앞뒤 과정은 그대로 이어집니다. (하위 " + kids.length + "개는 삭제되지 않습니다)"
          : "다른 과정은 그대로 둡니다.");
      if (!window.confirm(msg)) return;
      state.data.nodes = state.data.nodes.filter(function (n) { return n.id !== id; });
      state.data.edges = state.data.edges.filter(function (e) {
        return e.from !== id && e.to !== id;
      });
      if (parentId) {
        kids.forEach(function (child) {
          state.data.edges.push({
            id: "e" + parentId + "-" + child.id,
            from: parentId,
            to: child.id,
            type: "hierarchy"
          });
        });
      }
      state.explored = state.explored.filter(function (eid) { return eid !== id; });
      if (!state.explored.length) state.explored = [state.data.rootId];
      state.adminEditId = null;
      openNode(state.explored[state.explored.length - 1], false, "navigate");
      toast("「" + title + "」을(를) 삭제했습니다 — 저장을 눌러 반영하세요");
      return;
    }

    var descendants = [];
    var queue = [id];
    var seen = {};
    seen[id] = true;
    while (queue.length) {
      var cur = queue.shift();
      childrenOf(cur).forEach(function (child) {
        if (seen[child.id]) return;
        seen[child.id] = true;
        descendants.push(child.id);
        queue.push(child.id);
      });
    }
    var treeMsg = descendants.length
      ? "「" + title + "」과 그 아래 주제 " + descendants.length + "개를 모두 삭제할까요?\n(하위 주제까지 함께 지워집니다)"
      : "「" + title + "」을(를) 삭제할까요?";
    if (!window.confirm(treeMsg)) return;
    var remove = seen;
    state.data.nodes = state.data.nodes.filter(function (n) { return !remove[n.id]; });
    state.data.edges = state.data.edges.filter(function (e) {
      return !remove[e.from] && !remove[e.to];
    });
    state.explored = state.explored.filter(function (eid) { return !remove[eid]; });
    if (!state.explored.length) state.explored = [state.data.rootId];
    state.adminEditId = null;
    openNode(state.explored[state.explored.length - 1], false, "navigate");
    toast("삭제되었습니다 — 저장을 눌러 반영하세요");
  }

  function saveMindmap() {
    if (saveInFlight) return Promise.resolve();
    saveInFlight = true;
    if (els.btnSave) {
      els.btnSave.disabled = true;
      els.btnSave.textContent = "저장 중…";
    }
    syncEditorToState();
    if (!state.data || !state.data.rootId || !Array.isArray(state.data.nodes)) {
      saveInFlight = false;
      if (els.btnSave) {
        els.btnSave.disabled = false;
        els.btnSave.textContent = "저장";
      }
      toast("저장 실패 — 과정 데이터가 없습니다. 새로고침 후 다시 시도하세요");
      return Promise.resolve();
    }
    if (!state.data.meta) state.data.meta = {};
    state.data.meta.updatedAt = new Date().toISOString();
    var endpoint = apiUrl("/api/mindmap");
    var body;
    try {
      var payload = Object.assign({ courseSlug: state.courseSlug }, state.data);
      var pin = state.adminPin || LOCAL_ADMIN_PIN || "";
      if (pin) payload.pin = pin;
      body = JSON.stringify(payload);
    } catch (eStr) {
      saveInFlight = false;
      if (els.btnSave) {
        els.btnSave.disabled = false;
        els.btnSave.textContent = "저장";
      }
      toast("저장 실패 — 데이터 직렬화 오류");
      return Promise.resolve();
    }
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      }).catch(function () {
        return { ok: false, status: res.status, data: null };
      });
    }).then(function (result) {
      if (!result.ok) {
        var err = (result.data && result.data.error) || ("HTTP " + result.status);
        if (/thegospel\.(kr|jp)$/i.test(location.hostname)) {
          toast("웹 사이트에서는 저장할 수 없습니다 — 로컬 http://localhost:8780/ 에서 편집하세요");
        } else {
          toast("저장 실패 — " + err);
        }
        return;
      }
      try { renderFocus("static"); } catch (eRender) { /* ignore UI refresh errors */ }
      var dep = result.data && result.data.deploy;
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
    }).catch(function (err) {
      var host = String(location.hostname || "");
      var detail = (err && err.message) ? String(err.message) : "network";
      toast("저장 실패 — " + detail + " (" + host + " → " + endpoint + ")");
    }).finally(function () {
      saveInFlight = false;
      if (els.btnSave) {
        els.btnSave.disabled = false;
        els.btnSave.textContent = "저장";
      }
    });
  }

  function deployToWeb() {
    var btn = els.btnDeploy || els.btnCatalogDeploy;
    function setBusy(busy) {
      if (els.btnDeploy) {
        els.btnDeploy.disabled = busy;
        els.btnDeploy.textContent = busy ? "배포 중…" : "배포";
      }
      if (els.btnCatalogDeploy) {
        els.btnCatalogDeploy.disabled = busy;
        els.btnCatalogDeploy.textContent = busy ? "배포 중…" : "배포";
      }
    }
    setBusy(true);
    var body = {};
    var pin = state.adminPin || LOCAL_ADMIN_PIN || "";
    if (pin) body.pin = pin;
    return fetch(apiUrl("/api/admin/deploy"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          toast((result.data && result.data.error) || "배포 실패");
          return;
        }
        toast((result.data && result.data.message) || "thegospel.kr 배포 진행 중");
      })
      .catch(function () {
        toast("배포 실패 — 로컬 서버(serve.bat)에서만 가능합니다");
      })
      .finally(function () {
        setBusy(false);
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
    syncUrl();
  }

  function parseHash() {
    var h = location.hash || "";
    // Strip back-trap suffix (#...!~token) so routing stays stable.
    h = h.replace(/!~[\w.-]+$/, "");
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
    return fetch(apiUrl("/api/admin/verify"), {
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
        var allowDeep = state.user || state.admin || hasLocalSession();
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
        var orderBtn = e.target.closest(".catalog-card-order");
        if (orderBtn) {
          e.preventDefault();
          e.stopPropagation();
          if (orderBtn.disabled) return;
          moveCatalogOrder(orderBtn.dataset.catalogSlug, orderBtn.dataset.dir);
          return;
        }
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
    if (els.adminUsersList) {
      els.adminUsersList.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest(".admin-user-action") : null;
        if (!btn) return;
        handleAdminUserAction(
          btn.getAttribute("data-action"),
          parseInt(btn.getAttribute("data-user-id"), 10),
          btn.getAttribute("data-user-name") || ""
        );
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
    els.btnBack.addEventListener("click", function () {
      navigateAppBack();
    });
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
      // Appointed operator: open member management directly (no PIN / no re-login).
      if (isOperatorLoggedIn()) {
        openAdminUsersModal();
        return;
      }
      if (state.screen === "catalogs" || state.screen === "catalog") {
        if (SKIP_ADMIN_PIN) {
          loadLocalAdminPin().then(function () {
            enterCatalogAdmin(LOCAL_ADMIN_PIN || "");
          });
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
          if (isOperatorLoggedIn()) {
            openAdminUsersModal();
            return;
          }
          if (SKIP_ADMIN_PIN) {
            loadLocalAdminPin().then(function () {
              enterAdmin(LOCAL_ADMIN_PIN || state.adminPin || "");
            });
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
              enterAdmin(pin);
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
    if (els.btnAiCopy) els.btnAiCopy.addEventListener("click", copyAiAnswer);
    if (els.btnAiInsert) els.btnAiInsert.addEventListener("click", function () { insertAiAnswer("replace"); });
    if (els.btnAiAppend) els.btnAiAppend.addEventListener("click", function () { insertAiAnswer("append"); });
    if (els.btnInsertHymn) els.btnInsertHymn.addEventListener("click", insertHymnAtCursor);
    if (els.btnInsertLink) els.btnInsertLink.addEventListener("click", insertLinkAtCursor);
    if (els.btnInsertImage) els.btnInsertImage.addEventListener("click", insertImageAtCursor);
    bindAsideUi();
    bindScriptureUi();
    bindHymnPlayer();
    loadHymnTitles();
    els.btnSave.addEventListener("click", saveMindmap);
    if (els.btnDeploy) els.btnDeploy.addEventListener("click", deployToWeb);
    if (els.btnCatalogDeploy) els.btnCatalogDeploy.addEventListener("click", deployToWeb);
    els.btnExport.addEventListener("click", exportJson);
    els.btnImport.addEventListener("click", function () { els.importFile.click(); });
    els.importFile.addEventListener("change", function () {
      if (els.importFile.files[0]) importJson(els.importFile.files[0]);
      els.importFile.value = "";
    });
    ["editTitle", "editDesc", "editScripture"].forEach(function (key) {
      if (els[key]) els[key].addEventListener("input", onEditorInput);
    });
  }

  function initPwaInstallBar() {
    var ua = navigator.userAgent || "";
    var deferredPrompt = null;
    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    var isIOS = /iPhone|iPad|iPod/i.test(ua);
    var isWhale = /Whale/i.test(ua);
    var isSamsung = /SamsungBrowser/i.test(ua);
    var isAndroid = /Android/i.test(ua);

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
      '<div id="pwa-install-btn-wrap" class="pwa-install-bar__btn-wrap is-visible">' +
      '<button type="button" id="pwa-install-btn" class="pwa-install-bar__install">홈 화면에 추가하는 방법</button>' +
      "</div>" +
      '<div id="pwa-install-msg" class="pwa-install-bar__msg"></div>';
    document.body.appendChild(bar);

    var msg = document.getElementById("pwa-install-msg");
    var btnWrap = document.getElementById("pwa-install-btn-wrap");
    var btn = document.getElementById("pwa-install-btn");
    var waitGuide = "설치가 완료될 때까지 잠시 기다려 주세요.";
    var guideExpanded = false;

    function manualGuideHtml() {
      if (isIOS) {
        return "Safari 하단 <b>공유(⬆︎)</b> → <b>홈 화면에 추가</b>를 누르세요.<br>" + waitGuide;
      }
      if (isWhale) {
        return "아래에 설치하기 버튼이 보이지 않으면<br>" +
          "하단 메뉴(≡) 또는 오른쪽 위 <b>⋮</b> → <b>홈 화면에 추가</b>(또는 앱 설치)를 선택하세요.<br>" +
          "안 보이면 <b>Chrome</b>으로 이 주소를 열어 주세요.<br>" + waitGuide;
      }
      if (isSamsung) {
        return "아래에 설치하기 버튼이 보이지 않으면<br>" +
          "삼성 인터넷 하단 메뉴 → <b>홈 화면에 추가</b>를 선택하세요.<br>" + waitGuide;
      }
      if (isAndroid) {
        return "아래에 설치하기 버튼이 보이지 않으면<br>" +
          "브라우저 오른쪽 위 <b>⋮</b> → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택하세요.<br>" +
          "그래도 안 되면 Chrome으로 열어 주세요.<br>" + waitGuide;
      }
      return "아래에 설치하기 버튼이 보이지 않으면<br>" +
        "브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택하세요.<br>" + waitGuide;
    }

    function shortHintHtml() {
      if (isIOS) return "위 버튼을 눌러 설치 방법을 확인하세요.";
      if (isWhale) return "웨일 브라우저입니다. 위 버튼을 눌러 홈 화면 추가 방법을 확인하세요.";
      return "위 버튼을 눌러 설치하거나, 방법을 확인하세요.";
    }

    function setManualMode() {
      if (btn) btn.textContent = "홈 화면에 추가하는 방법";
      if (msg) msg.innerHTML = shortHintHtml();
      guideExpanded = false;
    }

    function setPromptMode() {
      if (btn) btn.textContent = "앱 설치하기";
      if (msg) {
        msg.innerHTML =
          "<b>앱 설치하기</b>를 누르세요.<br>" + waitGuide +
          "<br><br>아래에 설치하기 버튼이 보이지 않으면 브라우저 메뉴에서 <b>홈 화면에 추가</b>를 선택하세요.";
      }
    }

    setManualMode();

    var closeBtn = document.getElementById("pwa-install-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { bar.remove(); });
    if (btn) {
      btn.addEventListener("click", function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.finally(function () {
            deferredPrompt = null;
            setManualMode();
          });
          return;
        }
        guideExpanded = !guideExpanded;
        if (msg) msg.innerHTML = guideExpanded ? manualGuideHtml() : shortHintHtml();
        if (btn) btn.textContent = guideExpanded ? "안내 접기" : "홈 화면에 추가하는 방법";
      });
    }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      setPromptMode();
    });
  }

  function ensureCatalogsVisible() {
    if (state.screen !== "catalogs" || !els.catalogList) return;
    if (els.catalogList.querySelector(".catalog-card")) return;
    showCatalogsHome();
  }

  function loadLocalAdminPin() {
    if (!SKIP_ADMIN_PIN) return Promise.resolve("");
    return fetch(apiUrl("/api/admin/local-pin"), { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.pin) {
          LOCAL_ADMIN_PIN = String(data.pin);
          if (!state.adminPin) state.adminPin = LOCAL_ADMIN_PIN;
        }
        return LOCAL_ADMIN_PIN;
      })
      .catch(function () { return ""; });
  }

  /* ── System back ──
   * Home: sit on history index 0 so one system back exits the WebAPK.
   * Deeper screens: one trap entry (trapBack) for go(1) undo on in-app back.
   */
  var backCtl = { armed: false, allowExit: false, quiet: false, handling: false, undoing: false, resetHomeLeft: 0 };

  function resetHistoryAtHome() {
    if (state.screen !== "catalogs") return;
    // URL만 #catalogs로 맞춘다. history.go(-n)은 부트 중 카탈로그 fetch를
    // 취소하거나 bfcache의 「불러오는 중」 DOM을 되살려 첫 화면이 멈춘 것처럼 보인다.
    syncUrl();
  }

  function armForwardTrap() {
    if (backCtl.quiet || backCtl.allowExit) return;
    if (state.screen === "catalogs") return;
    trapBack();
  }

  function currentAppHash() {
    if (state.screen === "catalog" && state.activeCatalogSlug) {
      return "#catalog/" + encodeURIComponent(state.activeCatalogSlug);
    }
    if (state.screen === "course" && state.courseSlug && state.centerId) {
      return "#course/" + encodeURIComponent(state.courseSlug) + "/n/" + encodeURIComponent(state.centerId);
    }
    return "#catalogs";
  }

  function syncUrl() {
    var qs = new URLSearchParams(location.search || "");
    qs.delete("_vflb");
    var q = qs.toString();
    try {
      history.replaceState({ vfl: 1 }, "", location.pathname + (q ? "?" + q : "") + currentAppHash());
    } catch (e) { /* ignore */ }
  }

  function trapBack() {
    var qs = new URLSearchParams(location.search || "");
    qs.delete("_vflb");
    var q = qs.toString();
    var hash = currentAppHash() + "!~t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      history.pushState({ vflTrap: 1 }, "", location.pathname + (q ? "?" + q : "") + hash);
    } catch (e) { /* ignore */ }
  }

  function closeBackOverlays() {
    if (els.scrPopup && !els.scrPopup.hidden) { closeScrPopup(); return true; }
    if (els.asideOverlay && !els.asideOverlay.hidden) { closeAside(); return true; }
    if (els.linkOpenOverlay && !els.linkOpenOverlay.hidden) { closeLinkOpenSheet(); return true; }
    if (els.imageFormOverlay && !els.imageFormOverlay.hidden) { closeImageForm(); return true; }
    if (els.linkFormOverlay && !els.linkFormOverlay.hidden) { closeLinkForm(); return true; }
    if (els.asideFormOverlay && !els.asideFormOverlay.hidden) { closeAsideForm(); return true; }
    if (els.authOverlay && !els.authOverlay.hidden) { closeAuthOverlay(); return true; }
    if (els.adminUsersOverlay && !els.adminUsersOverlay.hidden) { els.adminUsersOverlay.hidden = true; return true; }
    if (els.operatorNoticeOverlay && !els.operatorNoticeOverlay.hidden) { closeOperatorNotice(); return true; }
    if (els.adminOverlay && !els.adminOverlay.hidden) { els.adminOverlay.hidden = true; return true; }
    if (els.catalogFormOverlay && !els.catalogFormOverlay.hidden) { els.catalogFormOverlay.hidden = true; return true; }
    if (els.courseAddOverlay && !els.courseAddOverlay.hidden) { els.courseAddOverlay.hidden = true; return true; }
    var upd = document.getElementById("app-update-modal");
    if (upd && !upd.hidden) { upd.hidden = true; return true; }
    return false;
  }

  /** System back: lesson → course intro → catalog/home → exit. (← 이전은 navigateAppBack) */
  function stepAppBack() {
    if (closeBackOverlays()) return true;

    if (state.screen === "course" && state.data && !isAtRoot()) {
      backCtl.quiet = true;
      try {
        courseRootView();
      } finally { backCtl.quiet = false; }
      syncUrl();
      return true;
    }

    if (state.screen === "course") {
      var cat = state.activeCatalogSlug;
      var courseCount = coursesInActiveCatalogCount(cat);
      if (state.admin) {
        try { exitAdmin(); } catch (e0) { /* ignore */ }
      }
      state.courseSlug = null;
      state.data = null;
      state.centerId = null;
      state.explored = [];
      state.catalog = [];
      backCtl.quiet = true;
      // 과정 1개짜리 카탈로그는 목록 화면이 없으므로 홈으로
      if (cat && (state.adminCatalog || courseCount > 1)) {
        state.activeCatalogSlug = cat;
        setScreen("catalog");
        syncUrl();
        showCatalogCourses(cat, { autoOpen: false }).finally(function () { backCtl.quiet = false; });
      } else {
        state.activeCatalogSlug = null;
        setScreen("catalogs");
        syncUrl();
        showCatalogsHome().finally(function () { backCtl.quiet = false; });
      }
      return true;
    }

    if (state.screen === "catalog") {
      backCtl.quiet = true;
      state.activeCatalogSlug = null;
      state.courseSlug = null;
      state.data = null;
      state.centerId = null;
      state.explored = [];
      state.catalog = [];
      setScreen("catalogs");
      syncUrl();
      showCatalogsHome().finally(function () { backCtl.quiet = false; });
      return true;
    }

    return false;
  }

  /** In-app ← 이전 / ← 차례: one trail step, or intro when at first lesson. */
  function navigateAppBack() {
    if (closeBackOverlays()) return;
    if (state.screen === "course" && state.data && !isAtRoot()) {
      backCtl.quiet = true;
      try {
        if (state.explored.length > 2) goBack();
        else courseRootView();
      } finally { backCtl.quiet = false; }
      syncUrl();
      return;
    }
    if (state.screen === "course") {
      backCtl.quiet = true;
      try {
        var cat = state.activeCatalogSlug;
        var courseCount = coursesInActiveCatalogCount(cat);
        if (cat && (state.adminCatalog || courseCount > 1)) {
          showCatalogCourses(cat, { autoOpen: false });
        } else {
          showCatalogsHome();
        }
      } finally {
        backCtl.quiet = false;
      }
      return;
    }
    if (state.screen === "catalog") {
      backCtl.quiet = true;
      try { showCatalogsHome(); } finally { backCtl.quiet = false; }
    }
  }

  function onSystemBack() {
    if (backCtl.resetHomeLeft > 0) {
      backCtl.resetHomeLeft--;
      syncUrl();
      return;
    }

    if (backCtl.allowExit) return;

    if (backCtl.undoing) {
      backCtl.undoing = false;
      // history.go(1)이 syncUrl 이후에 끝나며 옛 hash로 덮어쓰는 레이스 방지
      syncUrl();
      return;
    }

    if (backCtl.handling) return;
    backCtl.handling = true;
    window.__vflIgnoreHashChange = true;
    try {
      if (closeBackOverlays()) {
        backCtl.undoing = true;
        try { history.go(1); } catch (eO) { backCtl.undoing = false; }
        return;
      }

      if (state.screen === "catalogs") {
        backCtl.allowExit = true;
        return;
      }

      backCtl.undoing = true;
      try {
        history.go(1);
      } catch (eGo) {
        backCtl.undoing = false;
      }

      stepAppBack();
      syncUrl();
      if (state.screen === "catalogs") resetHistoryAtHome();
    } finally {
      backCtl.handling = false;
      try {
        if (typeof queueMicrotask === "function") {
          queueMicrotask(function () { window.__vflIgnoreHashChange = false; });
        } else {
          window.__vflIgnoreHashChange = false;
        }
      } catch (e3) {
        window.__vflIgnoreHashChange = false;
      }
    }
  }

  function initPwaBackButton() {
    if (backCtl.armed) return;
    backCtl.armed = true;
    window.__vflBackBound = true;

    syncUrl();
    resetHistoryAtHome();

    window.addEventListener("popstate", function () {
      onSystemBack();
    });
  }

  function bootApp() {
    initPwaBackButton();
    initFontSize();
    initAiAskMode();
    initAdminPanelResize();
    initAuth();
    initPwaInstallBar();
    bindEvents();
    bindIdleLogout();
    requestPersistentStorage();
    hydrateSessionFromCache();
    if (state.user) onUserSessionReady();
    window.addEventListener("hashchange", function () {
      if (window.__vflIgnoreHashChange || window.__vflBackBound) return;
      routeFromHash();
    });
    window.addEventListener("pageshow", function () {
      ensureCatalogsVisible();
    });
    loadLocalAdminPin();

    // 카탈로그 홈은 세션 API와 무관하게 즉시 로드
    setScreen("catalogs");
    if (els.catalogList && !els.catalogList.querySelector(".catalog-card")) {
      els.catalogList.innerHTML = '<p class="catalog-lead">불러오는 중…</p>';
    }
    loadCatalogsHome();

    function afterSessionReady() {
      updateGoalsUI();
      var route = parseHash();
      if (route.screen === "catalogs") {
        if (els.catalogList && !els.catalogList.querySelector(".catalog-card")) {
          loadCatalogsHome();
        } else if (state.catalogs && state.catalogs.length) {
          updateCatalogHeader();
          renderListPanel();
        }
        resetHistoryAtHome();
        loadAllCourses().then(function () {
          if (state.screen === "catalogs") renderResumeBanner();
        });
        return;
      }
      // 딥링크만 세션 hydrate 후 라우팅
      backCtl.quiet = true;
      try {
        routeFromHash();
      } finally {
        backCtl.quiet = false;
      }
      armForwardTrap();
    }

    if (hasLocalSession()) {
      fetchCurrentUser({ soft: true, maxAttempts: 4 }).then(afterSessionReady);
    } else {
      afterSessionReady();
    }

    ensureCatalogsVisible();
  }

  bootApp();
  if ("serviceWorker" in navigator) {
    // 찬송가·라이프스터디와 동일: 배포 경로면 절대 경로로 등록
    var swUrl = /\/visionforlife(\/|$)/i.test(location.pathname || "")
      ? "/visionforlife/sw.js"
      : assetUrl("sw.js");
    navigator.serviceWorker.register(swUrl).catch(function () {});
  }
})();
