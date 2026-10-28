/* =========================================================
   Scheduler user app — shared script (loaded on every page)
   * App shell: top bar (logo, search, profile) + sidebar
   * Theme (light / dark / system) and accessibility modes
   * Greeting based on the user's time zone
   * Menus, dialogs, toasts, visual alerts
   * Create / modify schedule (calendar → details → timetable)
     with conflict + duplicate checks and undo / redo
   * Create / edit reminder with undo / redo
   * Schedule detail view, trash flow, downloads
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore;
  const U = S.util;

  /* ---------- routes (FastAPI routes; .html files when opened from disk) ---------- */
  const ROUTES = {
    dashboard: "/user/dashboard", schedules: "/user/schedules", tasks: "/user/tasks",
    reminders: "/user/reminders", notifications: "/user/notifications", trash: "/user/trash",
    settings: "/user/settings", support: "/user/support"
  };
  const LOGIN_URL = "/log in";
  function url(page, query) {
    const base = location.protocol === "file:" ? page + ".html" : ROUTES[page];
    return base + (query ? "?" + new URLSearchParams(query).toString() : "");
  }
  const PAGE = document.body.dataset.page;
  const ASSETS = location.protocol === "file:" ? "../images/" : "/user_webpages/images/";

  /* ---------- icons ---------- */
  const P = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 5v14M5 12h14"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
    alarm: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2 6M19 3l3 3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" ' + P + '><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    trash: '<svg viewBox="0 0 24 24" ' + P + '><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/></svg>',
    search: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    x: '<svg viewBox="0 0 24 24" ' + P + '><path d="M18 6 6 18M6 6l12 12"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
    download: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/></svg>',
    edit: '<svg viewBox="0 0 24 24" ' + P + '><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
    palette: '<svg viewBox="0 0 24 24" ' + P + '><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.6-1.3-2-1.3-3.3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
    pin: '<svg viewBox="0 0 24 24" ' + P + '><path d="M9 4h6l-1 6 4 3v2H6v-2l4-3-1-6zM12 15v6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" ' + P + '><path d="m9 6 6 6-6 6"/></svg>',
    chevronL: '<svg viewBox="0 0 24 24" ' + P + '><path d="m15 6-6 6 6 6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" ' + P + '><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    help: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>',
    undo: '<svg viewBox="0 0 24 24" ' + P + '><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    redo: '<svg viewBox="0 0 24 24" ' + P + '><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
    warning: '<svg viewBox="0 0 24 24" ' + P + '><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17v.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" ' + P + ' stroke-width="3"><path d="m5 12 5 5 9-10"/></svg>',
    ban: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
    restore: '<svg viewBox="0 0 24 24" ' + P + '><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    file: '<svg viewBox="0 0 24 24" ' + P + '><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    sheet: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
    code: '<svg viewBox="0 0 24 24" ' + P + '><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>',
    move: '<svg viewBox="0 0 24 24" ' + P + '><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" ' + P + '><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    image: '<svg viewBox="0 0 24 24" ' + P + '><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>'
  };
  function icon(name) { return ICONS[name] || ""; }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtDate(d, opts) {
    const p = d.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString(undefined, Object.assign({ weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }, opts || {}));
  }
  function fmtRange(t) { return U.fmtTime(t.start) + " – " + U.fmtTime(t.end); }
  function fmtDuration(min) { const h = Math.floor(min / 60), m = min % 60; return (h ? h + "h" : "") + (m ? (h ? " " : "") + m + "m" : (h ? "" : "0m")); }
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Math.floor(s / 86400) + " d ago";
  }
  function initials(name, email) {
    const src = (name || email || "?").trim();
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  function bgClass(bg) { return bg && bg.type === "pattern" ? "bg-" + bg.value : ""; }
  /* Black or white text, whichever reads better on the color */
  function textOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return "#000";
    const n = parseInt(m[1], 16);
    const lin = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
    return L > 0.22 ? "#000" : "#FFF";
  }
  function bgStyle(s) {
    const bg = s.background || {};
    const base = bg.type === "color" ? bg.value : (s.color || "#FFDE59");
    let st = "background-color:" + esc(base) + ";color:" + (bg.type === "image" ? "#000" : textOn(base)) + ";";
    if (bg.type === "image") st += "background-image:url('" + String(bg.value).replace(/'/g, "%27") + "');background-size:cover;background-position:center;";
    return st;
  }
  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "schedule"; }

  /* =========================================================
     Theme & accessibility
     ========================================================= */
  const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");
  const motionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function applySettings() {
    const st = S.state.settings, a = st.a11y, root = document.documentElement;
    const theme = st.theme === "system" ? (darkMQ.matches ? "dark" : "light") : st.theme;
    root.dataset.theme = theme;
    root.dataset.cb = a.colorblind || "none";
    root.dataset.contrast = a.highContrast ? "high" : "normal";
    root.dataset.dyslexia = a.dyslexia ? "on" : "off";
    root.dataset.bold = a.bold ? "on" : "off";
    root.dataset.underline = a.underlineLinks ? "on" : "off";
    root.dataset.motion = a.reduceMotion || motionMQ.matches ? "reduce" : "full";
    root.style.setProperty("--font-scale", (a.fontScale || 100) / 100);
    try { localStorage.setItem("scheduler-theme-cache", JSON.stringify({ theme: theme, cb: root.dataset.cb, contrast: root.dataset.contrast, scale: a.fontScale || 100 })); } catch (e) { /* ignore */ }
  }
  darkMQ.addEventListener && darkMQ.addEventListener("change", function () { if (S.state.settings.theme === "system") applySettings(); });
  function chartPatterns() { const a = S.state.settings.a11y; return !!(a.chartPatterns || (a.colorblind && a.colorblind !== "none")); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  /* Greeting from the hour in the user's time zone */
  function greeting() {
    const n = U.now();
    const h = Math.floor(n.min / 60);
    const part = h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "afternoon" : "evening";
    const name = (S.state.profile.name || "").split(" ")[0];
    return { text: "Good " + part + (name ? ", " + name : ""), part: part, tz: U.timezone(), date: n.date, min: n.min };
  }

  /* =========================================================
     Toasts, visual alerts
     ========================================================= */
  function toast(message, opts) {
    opts = opts || {};
    const box = document.querySelector(".toasts");
    const el = document.createElement("div");
    const dur = opts.duration || 4000;
    el.className = "toast" + (opts.type ? " toast--" + opts.type : "");
    el.setAttribute("role", opts.type === "error" ? "alert" : "status");
    el.innerHTML = '<span class="toast__msg">' + esc(message) + "</span>" +
      (opts.action ? '<button type="button" class="toast__action">' + esc(opts.action.label) + "</button>" : "") +
      '<span class="toast__bar" style="animation-duration:' + dur + 'ms"></span>';
    box.appendChild(el);
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, 320);
    }
    if (opts.action) el.querySelector(".toast__action").addEventListener("click", function () { opts.action.fn(); close(); });
    setTimeout(close, dur);
    return { close: close };
  }
  function visualAlert() {
    const el = document.createElement("div");
    el.className = "visual-alert";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
    if (navigator.vibrate) { try { navigator.vibrate([120, 80, 120]); } catch (e) { /* ignore */ } }
  }
  S.on("notify", function (n) {
    const a = S.state.settings.a11y;
    if (a.visualAlerts) visualAlert();
    if (a.textAlerts !== false) toast(n.title + ": " + n.body, { duration: 7000 });
  });

  /* =========================================================
     Menus (open downward, items slide in, icon on the left)
     ========================================================= */
  let openMenu = null;
  function closeMenus() {
    if (!openMenu) return;
    const m = openMenu; openMenu = null;
    m.menu.classList.remove("is-open");
    m.trigger.setAttribute("aria-expanded", "false");
    setTimeout(function () { if (!m.menu.classList.contains("is-open") && m.temporary) m.menu.remove(); }, 350);
  }
  document.addEventListener("click", function (e) {
    if (openMenu && !openMenu.menu.contains(e.target) && !openMenu.trigger.contains(e.target)) closeMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openMenu) { const t = openMenu.trigger; closeMenus(); t.focus(); e.stopPropagation(); }
  }, true);

  /* items: [{ label, icon, onClick, danger, checked, keepOpen, submenu:[...] }] */
  function buildMenuItems(items) {
    return items.map(function (it, i) {
      if (it.header) return '<div class="menu__head">' + it.header + "</div>";
      if (it.submenu) {
        return '<button type="button" class="menu__item" role="menuitem" aria-haspopup="true" aria-expanded="false" data-i="' + i + '">' + icon(it.icon) + "<span>" + esc(it.label) + "</span>" + '<svg class="menu__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></button>' +
          '<div class="submenu" data-sub="' + i + '"><div>' + it.submenu.map(function (s, j) {
            return '<button type="button" class="menu__item" role="menuitem" data-i="' + i + '" data-j="' + j + '" tabindex="-1">' + icon(s.icon) + "<span>" + esc(s.label) + "</span></button>";
          }).join("") + "</div></div>";
      }
      const role = it.checked !== undefined ? 'role="menuitemcheckbox" aria-checked="' + !!it.checked + '"' : 'role="menuitem"';
      return '<button type="button" class="menu__item' + (it.danger ? " menu__item--danger" : "") + '" ' + role + ' data-i="' + i + '">' + icon(it.icon) + "<span>" + esc(it.label) + "</span>" + (it.checked !== undefined ? '<span class="menu__check" aria-hidden="true"></span>' : "") + "</button>";
    }).join("");
  }
  function menu(trigger, items, opts) {
    opts = opts || {};
    if (openMenu && openMenu.trigger === trigger) { closeMenus(); return; }
    closeMenus();
    const host = trigger.parentElement;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const el = document.createElement("div");
    el.className = "menu" + (opts.align === "left" ? " menu--left" : "");
    el.setAttribute("role", "menu");
    if (opts.label) el.setAttribute("aria-label", opts.label);
    el.innerHTML = buildMenuItems(items);
    host.appendChild(el);
    trigger.setAttribute("aria-expanded", "true");
    openMenu = { menu: el, trigger: trigger, temporary: true };
    requestAnimationFrame(function () { el.classList.add("is-open"); });

    el.addEventListener("click", function (e) {
      const b = e.target.closest(".menu__item");
      if (!b) return;
      const it = items[+b.dataset.i];
      if (it.submenu && b.dataset.j === undefined) {
        const sub = el.querySelector('[data-sub="' + b.dataset.i + '"]');
        const open = !sub.classList.contains("is-open");
        sub.classList.toggle("is-open", open);
        b.setAttribute("aria-expanded", String(open));
        sub.querySelectorAll(".menu__item").forEach(function (x) { x.tabIndex = open ? 0 : -1; });
        if (open) sub.querySelector(".menu__item").focus();
        return;
      }
      const target = b.dataset.j !== undefined ? it.submenu[+b.dataset.j] : it;
      if (target.checked !== undefined) {
        target.checked = !target.checked;
        b.setAttribute("aria-checked", String(target.checked));
      }
      if (!target.keepOpen) closeMenus();
      if (target.onClick) target.onClick(target.checked);
    });
    el.addEventListener("keydown", function (e) {
      const list = Array.from(el.querySelectorAll(".menu__item")).filter(function (x) { return x.offsetParent !== null && x.tabIndex !== -1; });
      const i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === "Tab") closeMenus();
    });
    setTimeout(function () { const f = el.querySelector(".menu__item"); if (f && opts.focus !== false) f.focus(); }, 60);
    return el;
  }

  /* =========================================================
     Modals & dialogs
     ========================================================= */
  function modal(opts) {
    const d = document.createElement("dialog");
    d.className = "modal" + (opts.size ? " modal--" + opts.size : "") + (opts.className ? " " + opts.className : "");
    if (opts.labelledby !== false) d.setAttribute("aria-labelledby", "mt-" + (d.id = "m" + Date.now()));
    d.innerHTML =
      (opts.head !== undefined ? opts.head :
        '<div class="modal__head"><div><h2 id="mt-' + d.id + '">' + esc(opts.title || "") + "</h2>" + (opts.subtitle ? '<p class="card__sub">' + opts.subtitle + "</p>" : "") + "</div>" +
        '<div class="modal__tools">' + (opts.tools || "") + '<button type="button" class="icon-btn" data-close aria-label="Close">' + icon("x") + "</button></div></div>") +
      '<div class="modal__body">' + (opts.body || "") + "</div>" +
      (opts.foot ? '<div class="modal__foot">' + opts.foot + "</div>" : "");
    document.body.appendChild(d);
    d.addEventListener("cancel", function (e) {
      if (opts.beforeClose && opts.beforeClose() === false) { e.preventDefault(); }
    });
    d.addEventListener("close", function () { closeMenus(); if (opts.onClose) opts.onClose(); setTimeout(function () { d.remove(); }, 50); });
    d.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { tryClose(); }
      if (e.target === d) tryClose(); // click on the transparent area outside
    });
    function tryClose() {
      if (opts.beforeClose) {
        const r = opts.beforeClose();
        if (r === false) return;
        if (r && r.then) { r.then(function (ok) { if (ok !== false) d.close(); }); return; }
      }
      d.close();
    }
    d.tryClose = tryClose;
    d.showModal();
    return d;
  }

  /* Choice dialog: resolves with the value of the button pressed (null on cancel) */
  function choose(opts) {
    return new Promise(function (resolve) {
      let result = null;
      const d = modal({
        className: "alert-dialog",
        head: "",
        labelledby: false,
        body: '<div class="alert-dialog__icon' + (opts.danger ? " alert-dialog__icon--danger" : "") + '" aria-hidden="true">' + icon(opts.icon || "warning") + "</div>" +
          '<p id="ad-msg">' + esc(opts.message) + "</p>" + (opts.detail ? '<div class="muted">' + opts.detail + "</div>" : ""),
        foot: opts.buttons.map(function (b) {
          return '<button type="button" class="btn ' + (b.className || "") + '" data-value="' + esc(b.value) + '">' + (b.icon ? icon(b.icon) : "") + esc(b.label) + "</button>";
        }).join(""),
        onClose: function () { resolve(result); }
      });
      d.setAttribute("role", "alertdialog");
      d.setAttribute("aria-describedby", "ad-msg");
      d.querySelectorAll("[data-value]").forEach(function (b) {
        b.addEventListener("click", function () { result = b.dataset.value === "cancel" ? null : b.dataset.value; d.close(); });
      });
      const first = d.querySelector('[data-value="cancel"]') || d.querySelector("[data-value]");
      if (first) first.focus();
    });
  }
  function confirm(opts) {
    return choose({
      message: opts.message, detail: opts.detail, icon: opts.icon, danger: opts.danger,
      buttons: [
        { value: "ok", label: opts.confirmText || "OK", icon: opts.confirmIcon, className: opts.danger ? "btn--danger" : "btn--yellow" },
        { value: "cancel", label: opts.cancelText || "Cancel" }
      ]
    }).then(function (v) { return v === "ok"; });
  }

  /* =========================================================
     App shell
     ========================================================= */
  function buildShell() {
    const top = document.getElementById("topbar");
    const side = document.getElementById("sidebar");
    if (!top || !side) return;

    top.className = "topbar";
    top.innerHTML =
      '<button type="button" class="icon-btn topbar__menu-btn" id="sidebar-toggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">' + icon("menu") + "</button>" +
      '<a class="topbar__brand" href="' + url("dashboard") + '" aria-label="Scheduler dashboard">' +
        '<span class="logo-full"><img class="logo-light" src="' + ASSETS + 'logo.svg" alt="Scheduler" width="380" height="96"><img class="logo-dark" src="' + ASSETS + 'logo-dark.svg" alt="Scheduler" width="380" height="96"></span>' +
        '<img class="logo-mark" src="' + ASSETS + 'logo-mark.svg" alt="Scheduler" width="90" height="94">' +
      "</a>" +
      '<div class="topbar__spacer"></div>' +
      '<div class="search" role="search">' +
        '<label class="visually-hidden" for="search-input">Search schedules, tasks and reminders</label>' +
        '<span class="search__icon" aria-hidden="true">' + icon("search") + "</span>" +
        '<input class="search__input" id="search-input" type="search" placeholder="Search…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list">' +
        '<kbd class="search__kbd" aria-hidden="true">/</kbd>' +
        '<div class="search__results" id="search-results" role="listbox" hidden></div>' +
      "</div>" +
      '<div class="profile"><button type="button" class="avatar" id="profile-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu"></button></div>';

    const nav = [
      { page: "dashboard", label: "Dashboard", icon: "dashboard" },
      { page: "schedules", label: "Schedules", icon: "calendar" },
      { page: "tasks", label: "Tasks", icon: "tasks" },
      { page: "reminders", label: "Reminders", icon: "alarm" },
      { page: "notifications", label: "Notifications", icon: "bell", badge: true },
      { page: "trash", label: "Trash", icon: "trash" }
    ];
    side.className = "sidebar";
    side.setAttribute("aria-label", "Main navigation");
    side.innerHTML =
      '<div class="create"><button type="button" class="create__btn" id="create-btn" aria-haspopup="menu" aria-expanded="false"><span class="create__plus" aria-hidden="true">' + icon("plus") + "</span>Create</button></div>" +
      '<nav aria-label="Main"><ul class="sidenav">' + nav.map(function (n) {
        return '<li><a href="' + url(n.page) + '"' + (n.page === PAGE ? ' aria-current="page"' : "") + ">" + icon(n.icon) + "<span>" + n.label + "</span>" +
          (n.badge ? '<span class="sidenav__badge" id="notif-badge" hidden></span>' : "") + "</a></li>";
      }).join("") + "</ul></nav>" +
      '<div class="sidebar__foot">' +
        '<ul class="sidenav"><li><a href="' + url("support") + '"' + (PAGE === "support" ? ' aria-current="page"' : "") + ">" + icon("help") + "<span>Help &amp; support</span></a></li>" +
        '<li><a href="' + url("settings") + '"' + (PAGE === "settings" ? ' aria-current="page"' : "") + ">" + icon("gear") + "<span>Settings</span></a></li></ul>" +
        '<div class="conn" id="conn-status" role="status"><span class="conn__dot" aria-hidden="true"></span><span id="conn-text">Loading…</span></div>' +
      "</div>";

    /* Mobile sidebar */
    const app = document.getElementById("app");
    const toggle = document.getElementById("sidebar-toggle");
    function setSidebar(open) {
      app.classList.toggle("sidebar-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () { setSidebar(!app.classList.contains("sidebar-open")); });
    document.querySelector(".scrim").addEventListener("click", function () { setSidebar(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setSidebar(false); });

    /* Plus button: create a schedule / create a reminder */
    const createBtn = document.getElementById("create-btn");
    createBtn.addEventListener("click", function () {
      menu(createBtn, [
        { label: "Create a schedule", icon: "calendar", onClick: function () { setSidebar(false); openScheduleEditor(); } },
        { label: "Create a reminder", icon: "alarm", onClick: function () { setSidebar(false); openReminderEditor(); } }
      ], { align: "left", label: "Create" });
    });

    /* Profile menu: settings and log out */
    const profileBtn = document.getElementById("profile-btn");
    profileBtn.addEventListener("click", function () {
      const p = S.state.profile;
      menu(profileBtn, [
        { header: "<strong>" + esc(p.name || "Your account") + "</strong><small>" + esc(p.email || "Not logged in") + "</small>" },
        { label: "Settings", icon: "gear", onClick: function () { location.href = url("settings"); } },
        { label: "Help & support", icon: "help", onClick: function () { location.href = url("support"); } },
        { label: "Log out", icon: "logout", danger: true, onClick: logout }
      ], { label: "Account" });
    });

    initSearch();

    document.addEventListener("keydown", function (e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select" && !document.querySelector("dialog[open]")) {
        e.preventDefault(); document.getElementById("search-input").focus();
      }
    });
  }

  function refreshShell() {
    const p = S.state.profile;
    const btn = document.getElementById("profile-btn");
    if (btn) btn.textContent = initials(p.name, p.email);
    const badge = document.getElementById("notif-badge");
    if (badge) {
      const n = S.unreadCount();
      badge.hidden = !n;
      badge.textContent = n > 99 ? "99+" : n;
      badge.setAttribute("aria-label", n + " unread");
    }
    const conn = document.getElementById("conn-status");
    if (conn) {
      conn.dataset.mode = S.state.mode;
      document.getElementById("conn-text").textContent = S.state.mode === "server"
        ? "Synced with your account. Emails are on."
        : (S.state.apiOnline ? "Not logged in. Changes are saved in this browser only." : "Offline preview. Changes are saved in this browser only.");
    }
  }

  async function logout() {
    const ok = await confirm({ message: "Log out of Scheduler?", confirmText: "Log out", confirmIcon: "logout", danger: true });
    if (!ok) return;
    await S.logout();
    if (location.protocol === "file:") { toast("Logged out."); return; }
    location.href = encodeURI(LOGIN_URL);
  }

  /* ---------- Search ---------- */
  function initSearch() {
    const input = document.getElementById("search-input");
    const box = document.getElementById("search-results");
    let results = [], active = -1;

    function run() {
      const q = U.norm(input.value);
      if (!q) { hide(); return; }
      results = [];
      S.activeSchedules().forEach(function (s) {
        if (U.norm(s.label + " " + s.description).indexOf(q) !== -1) results.push({ group: "Schedules", label: s.label, sub: fmtDate(s.date), go: function () { openSchedule(s.id); } });
        (s.tasks || []).forEach(function (t) {
          if (U.norm(t.label + " " + t.description).indexOf(q) !== -1) results.push({ group: "Tasks", label: t.label, sub: fmtDate(s.date) + " · " + fmtRange(t), go: function () { openSchedule(s.id); } });
        });
      });
      S.activeReminders().forEach(function (r) {
        if (U.norm(r.label + " " + r.description).indexOf(q) !== -1) results.push({ group: "Reminders", label: r.label, sub: r.deadline.replace("T", " "), go: function () { location.href = url("reminders", { open: r.id }); } });
      });
      results = results.slice(0, 12);
      active = results.length ? 0 : -1;
      render();
    }
    function render() {
      if (!results.length) {
        box.innerHTML = '<div class="search__empty">No matches for “' + esc(input.value) + "”.</div>";
      } else {
        let last = "";
        box.innerHTML = results.map(function (r, i) {
          const head = r.group !== last ? '<div class="search__group">' + r.group + "</div>" : "";
          last = r.group;
          return head + '<button type="button" class="search__item' + (i === active ? " is-active" : "") + '" role="option" id="sr-' + i + '" aria-selected="' + (i === active) + '" data-i="' + i + '"><span><strong>' + esc(r.label) + "</strong><small>" + esc(r.sub) + "</small></span></button>";
        }).join("");
      }
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", active >= 0 ? "sr-" + active : "");
    }
    function hide() { box.hidden = true; input.setAttribute("aria-expanded", "false"); }
    input.addEventListener("input", run);
    input.addEventListener("focus", function () { if (input.value) run(); });
    input.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(results.length - 1, active + 1); render(); }
      if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); render(); }
      if (e.key === "Enter" && results[active]) { e.preventDefault(); hide(); results[active].go(); }
      if (e.key === "Escape") { hide(); }
    });
    box.addEventListener("click", function (e) {
      const b = e.target.closest("[data-i]");
      if (b) { hide(); results[+b.dataset.i].go(); }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search")) hide(); });
  }

  /* =========================================================
     Mini calendar (used inside the schedule editor)
     ========================================================= */
  function renderCalendar(host, opts) {
    const st = { y: 0, m: 0 };
    const start = (opts.selected || U.now().date).split("-").map(Number);
    st.y = start[0]; st.m = start[1] - 1;
    const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    function draw() {
      const ws = S.state.settings.weekStart;
      const first = new Date(Date.UTC(st.y, st.m, 1));
      const lead = (first.getUTCDay() - ws + 7) % 7;
      const startDate = U.addDays(first.toISOString().slice(0, 10), -lead);
      const today = U.now().date;
      const busy = {};
      S.activeSchedules().forEach(function (s) { busy[s.date] = (busy[s.date] || 0) + 1; });
      let cells = "";
      for (let i = 0; i < 7; i++) cells += '<div class="cal__dow" aria-hidden="true">' + DOW[(ws + i) % 7] + "</div>";
      for (let i = 0; i < 42; i++) {
        const d = U.addDays(startDate, i);
        const other = +d.slice(5, 7) - 1 !== st.m;
        cells += '<button type="button" class="cal__day' + (other ? " is-other" : "") + (d === today ? " is-today" : "") + (busy[d] ? " has-items" : "") +
          '" data-date="' + d + '" aria-pressed="' + (d === opts.selected) + '" aria-label="' + fmtDate(d, { weekday: "long", month: "long" }) + (busy[d] ? ", " + busy[d] + " schedule" + (busy[d] > 1 ? "s" : "") : "") + '">' + (+d.slice(8)) + "</button>";
      }
      host.innerHTML =
        '<div class="cal"><div class="cal__head">' +
          '<button type="button" class="icon-btn icon-btn--sm" data-nav="-1" aria-label="Previous month">' + icon("chevronL") + "</button>" +
          '<span class="cal__title" aria-live="polite">' + new Date(Date.UTC(st.y, st.m, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }) + "</span>" +
          '<button type="button" class="icon-btn icon-btn--sm" data-nav="1" aria-label="Next month">' + icon("chevron") + "</button>" +
        '</div><div class="cal__grid">' + cells + "</div></div>";
    }
    host.addEventListener("click", function (e) {
      const nav = e.target.closest("[data-nav]");
      if (nav) { st.m += +nav.dataset.nav; if (st.m < 0) { st.m = 11; st.y--; } if (st.m > 11) { st.m = 0; st.y++; } draw(); return; }
      const day = e.target.closest("[data-date]");
      if (day) { opts.selected = day.dataset.date; draw(); host.querySelector('[data-date="' + opts.selected + '"]').focus(); opts.onPick(day.dataset.date); }
    });
    draw();
  }

  /* =========================================================
     Schedule editor: create / modify
     ========================================================= */
  const COLORS = [
    { name: "Yellow", value: "#FFDE59" }, { name: "Gold", value: "#FFC759" }, { name: "Amber", value: "#FFAE59" },
    { name: "Orange", value: "#FF8159" }, { name: "Red", value: "#FF5959" }, { name: "Blue", value: "#134EF2" },
    { name: "Sky", value: "#A9C6FF" }, { name: "Mint", value: "#8BE3BF" }, { name: "White", value: "#FFFFFF" }
  ];
  const PATTERNS = ["dots", "grid", "stripes", "waves", "checks"];
  const URG_LABEL = { optional: "Optional", normal: "Normal", medium: "Medium", high: "High", urgent: "Urgent" };

  function timeOptions(selected, from, to) {
    let html = "";
    for (let m = from; m <= to; m += 30) html += '<option value="' + U.toTime(m) + '"' + (U.toTime(m) === selected ? " selected" : "") + ">" + U.fmtTime(U.toTime(m)) + "</option>";
    return html;
  }

  function openScheduleEditor(opts) {
    opts = opts || {};
    const editing = opts.scheduleId ? S.getSchedule(opts.scheduleId) : null;
    const draft = editing ? {
      date: editing.date, label: editing.label, description: editing.description, color: editing.color,
      background: JSON.parse(JSON.stringify(editing.background || { type: "none", value: "" })),
      tasks: JSON.parse(JSON.stringify(editing.tasks || [])), overwrites: []
    } : { date: opts.date || "", label: "", description: "", color: "#FFDE59", background: { type: "none", value: "" }, tasks: [], overwrites: [] };
    let step = opts.step || (editing ? 3 : (draft.date ? 2 : 1));
    let editTaskId = null;
    let slotStart = U.toTime(9 * 60);

    /* Undo / redo history of the whole draft */
    const history = [JSON.stringify(draft)];
    let hIndex = 0;
    function snapshot() {
      const snap = JSON.stringify(draft);
      if (snap === history[hIndex]) return;
      history.splice(hIndex + 1);
      history.push(snap);
      if (history.length > 100) history.shift();
      hIndex = history.length - 1;
      syncUndo();
    }
    function restore(i) {
      hIndex = i;
      Object.assign(draft, JSON.parse(history[hIndex]));
      editTaskId = null;
      draw();
    }
    function dirty() { return history.length > 1 && history[hIndex] !== history[0]; }

    const steps = ["Pick a day", "Details", "Timetable"];
    const d = modal({
      size: "wide",
      head: '<div class="modal__head editor__head"><div><h2 id="ed-title">' + (editing ? "Modify schedule" : "Create a schedule") + '</h2><ol class="steps" aria-label="Progress">' +
        steps.map(function (s, i) { return '<li data-step="' + (i + 1) + '"><span>' + (i + 1) + "</span>" + s + "</li>"; }).join("") + "</ol></div>" +
        '<div class="modal__tools"><button type="button" class="icon-btn" data-close aria-label="Close">' + icon("x") + "</button></div></div>",
      body: '<div id="ed-body"></div>',
      foot: '<div class="modal__foot-group"><button type="button" class="btn btn--sm" id="ed-undo">' + icon("undo") + 'Undo</button><button type="button" class="btn btn--sm" id="ed-redo">' + icon("redo") + "Redo</button></div>" +
        '<div class="modal__foot-group"><button type="button" class="btn btn--ghost" id="ed-discard">Discard</button><button type="button" class="btn" id="ed-back">Back</button><button type="button" class="btn btn--yellow" id="ed-next">Next</button></div>',
      beforeClose: function () {
        if (!dirty()) return true;
        return confirm({ message: "Discard this schedule? Your changes will be lost.", confirmText: "Discard", danger: true, icon: "trash" });
      }
    });
    d.setAttribute("aria-labelledby", "ed-title");
    d.classList.add("editor");
    const body = d.querySelector("#ed-body");
    const undoBtn = d.querySelector("#ed-undo"), redoBtn = d.querySelector("#ed-redo");
    const backBtn = d.querySelector("#ed-back"), nextBtn = d.querySelector("#ed-next");

    function syncUndo() { undoBtn.disabled = hIndex === 0; redoBtn.disabled = hIndex >= history.length - 1; }
    undoBtn.addEventListener("click", function () { if (hIndex > 0) restore(hIndex - 1); });
    redoBtn.addEventListener("click", function () { if (hIndex < history.length - 1) restore(hIndex + 1); });
    d.addEventListener("keydown", function (e) {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target.tagName || "").toLowerCase();
      if (!mod || tag === "input" || tag === "textarea") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undoBtn.click(); }
      if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redoBtn.click(); }
    });
    d.querySelector("#ed-discard").addEventListener("click", function () { d.tryClose(); });
    backBtn.addEventListener("click", function () { if (step > 1) { step--; draw(); } });
    nextBtn.addEventListener("click", next);

    async function next() {
      if (step === 1) {
        if (!draft.date) { toast("Pick a day on the calendar first.", { type: "error" }); return; }
        step = 2; draw(); return;
      }
      if (step === 2) {
        const label = body.querySelector("#ed-label");
        if (!draft.label.trim()) {
          label.classList.add("is-invalid");
          body.querySelector("#ed-label-err").textContent = "Give your schedule a label.";
          label.focus();
          return;
        }
        const dup = S.findDuplicateSchedule(draft.label, draft.date, editing && editing.id);
        if (dup) {
          const ok = await confirm({ message: "You already have a schedule called “" + dup.label + "” on " + fmtDate(dup.date) + ". Create a duplicate anyway?", confirmText: "Keep both", icon: "warning" });
          if (!ok) return;
        }
        step = 3; draw(); return;
      }
      save();
    }

    async function save() {
      if (!draft.tasks.length) { toast("Add at least one task to the timetable before saving.", { type: "error" }); return; }
      nextBtn.disabled = true;
      try {
        const data = { date: draft.date, label: draft.label, description: draft.description, color: draft.color, background: draft.background, tasks: draft.tasks };
        const saved = editing ? await S.updateSchedule(editing.id, data, draft.overwrites) : await S.createSchedule(data, draft.overwrites);
        history.length = 1; history[0] = JSON.stringify(draft); hIndex = 0; // not dirty any more
        d.close();
        toast(editing ? "Schedule updated." : "Schedule saved. You can find it under Schedules.", {
          type: "success", duration: 6000,
          action: PAGE === "schedules" ? null : { label: "View", fn: function () { location.href = url("schedules", { open: saved.id }); } }
        });
      } catch (err) {
        toast(err.message || "Could not save the schedule.", { type: "error" });
      } finally { nextBtn.disabled = false; }
    }

    function draw() {
      d.querySelectorAll(".steps li").forEach(function (li) {
        const n = +li.dataset.step;
        li.classList.toggle("is-current", n === step);
        li.classList.toggle("is-done", n < step);
        if (n === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      });
      backBtn.hidden = step === 1;
      nextBtn.textContent = step === 3 ? (editing ? "Save changes" : "Save schedule") : "Next";
      syncUndo();
      if (step === 1) drawStep1();
      if (step === 2) drawStep2();
      if (step === 3) drawStep3();
    }

    /* Step 1 — calendar */
    function drawStep1() {
      body.innerHTML = '<div class="ed-step1"><div><h3>Choose a day for this schedule</h3><p class="muted">Days with a dot already have a schedule.</p><div id="ed-cal"></div></div>' +
        '<div class="ed-picked" aria-live="polite">' + (draft.date ? "<span class=\"muted\">Selected day</span><strong>" + fmtDate(draft.date, { weekday: "long", month: "long" }) + "</strong>" + dayLoadNote(draft.date) : '<span class="muted">No day selected yet.</span>') + "</div></div>";
      renderCalendar(body.querySelector("#ed-cal"), {
        selected: draft.date,
        onPick: function (date) { draft.date = date; snapshot(); step = 2; draw(); }
      });
    }
    function dayLoadNote(date) {
      const count = S.activeSchedules().filter(function (s) { return s.date === date && (!editing || s.id !== editing.id); }).length;
      if (!count) return '<span class="muted">Nothing planned yet.</span>';
      const load = S.dayLoad(date);
      return '<span class="muted">' + count + " other schedule" + (count > 1 ? "s" : "") + " · " + fmtDuration(load) + " booked</span>";
    }

    /* Step 2 — label, description, color, background */
    function drawStep2() {
      const custom = COLORS.every(function (c) { return c.value.toLowerCase() !== String(draft.color).toLowerCase(); });
      const bg = draft.background || { type: "none" };
      body.innerHTML =
        '<div class="ed-step2"><div>' +
          '<p class="ed-date">' + icon("calendar") + "<span>" + fmtDate(draft.date, { weekday: "long", month: "long" }) + '</span> <button type="button" class="btn btn--sm btn--ghost" id="ed-change-day">Change day</button></p>' +
          '<div class="field"><label class="label" for="ed-label">Label</label><input class="input" id="ed-label" maxlength="80" value="' + esc(draft.label) + '" placeholder="e.g. Study week, Client day" aria-describedby="ed-label-err"><span class="field__error" id="ed-label-err"></span></div>' +
          '<div class="field"><label class="label" for="ed-desc">Description</label><textarea class="textarea" id="ed-desc" maxlength="1000" placeholder="What is this schedule for?">' + esc(draft.description) + "</textarea></div>" +
          '<fieldset class="field ed-fieldset"><legend class="label">Color</legend><div class="swatches">' +
            COLORS.map(function (c) {
              return '<label class="swatch"><input type="radio" name="ed-color" value="' + c.value + '"' + (c.value.toLowerCase() === String(draft.color).toLowerCase() ? " checked" : "") + '><span style="background:' + c.value + '"></span><span class="visually-hidden">' + c.name + "</span></label>";
            }).join("") +
            '<label class="swatch swatch--custom' + (custom ? " is-custom" : "") + '"><input type="color" id="ed-color-custom" value="' + (custom ? esc(draft.color) : "#7C5CFF") + '" aria-label="Custom color"><span class="swatch__plus" aria-hidden="true">+</span></label>' +
          "</div></fieldset>" +
          '<fieldset class="field ed-fieldset"><legend class="label">Background</legend><div class="bg-options">' +
            '<label class="bg-opt"><input type="radio" name="ed-bg" value="none"' + (bg.type === "none" ? " checked" : "") + '><span class="bg-opt__prev" style="background:' + esc(draft.color) + '"></span><span>Plain</span></label>' +
            PATTERNS.map(function (p) {
              return '<label class="bg-opt"><input type="radio" name="ed-bg" value="pattern:' + p + '"' + (bg.type === "pattern" && bg.value === p ? " checked" : "") + '><span class="bg-opt__prev bg-' + p + '" style="background-color:' + esc(draft.color) + '"></span><span>' + p[0].toUpperCase() + p.slice(1) + "</span></label>";
            }).join("") +
            '<label class="bg-opt"><input type="radio" name="ed-bg" value="color"' + (bg.type === "color" ? " checked" : "") + '><span class="bg-opt__prev" style="background:' + (bg.type === "color" ? esc(bg.value) : "#FFF4D6") + '"></span><span>Custom color</span></label>' +
            '<label class="bg-opt"><input type="radio" name="ed-bg" value="image"' + (bg.type === "image" ? " checked" : "") + '><span class="bg-opt__prev bg-opt__prev--img"' + (bg.type === "image" ? ' style="background-image:url(\'' + bg.value + '\');background-size:cover"' : "") + ">" + icon("image") + "</span><span>Image</span></label>" +
          "</div>" +
          '<div class="bg-extra"' + (bg.type === "color" ? "" : " hidden") + ' id="ed-bg-color-wrap"><label class="label" for="ed-bg-color">Background color</label> <input type="color" id="ed-bg-color" value="' + (bg.type === "color" ? esc(bg.value) : "#FFF4D6") + '"></div>' +
          '<div class="bg-extra"' + (bg.type === "image" ? "" : " hidden") + ' id="ed-bg-img-wrap"><label class="label" for="ed-bg-img">Upload an image (max 1.5 MB)</label><input class="input" type="file" id="ed-bg-img" accept="image/png,image/jpeg,image/webp,image/gif"></div>' +
          "</fieldset>" +
        "</div>" +
        '<div class="ed-preview-wrap"><span class="label">Preview</span><div class="sched-card ' + bgClass(bg) + '" style="' + bgStyle(draft) + '" id="ed-preview">' +
          '<span class="sched-card__date">' + fmtDate(draft.date, { weekday: "short", year: undefined }) + "</span>" +
          '<strong class="sched-card__label">' + esc(draft.label || "Your schedule") + "</strong>" +
          '<span class="sched-card__meta">' + draft.tasks.length + " task" + (draft.tasks.length === 1 ? "" : "s") + "</span>" +
        "</div>" +
        '<div id="ed-dup" class="notice notice--warn" hidden></div></div></div>';

      const labelIn = body.querySelector("#ed-label");
      function checkDup() {
        const box = body.querySelector("#ed-dup");
        const dup = draft.label.trim() && S.findDuplicateSchedule(draft.label, draft.date, editing && editing.id);
        box.hidden = !dup;
        if (dup) box.innerHTML = icon("warning") + "<span>A schedule called “" + esc(dup.label) + "” already exists on this day. Saving will create a duplicate.</span>";
      }
      function preview() {
        const p = body.querySelector("#ed-preview");
        p.className = "sched-card " + bgClass(draft.background);
        p.setAttribute("style", bgStyle(draft));
        p.querySelector(".sched-card__label").textContent = draft.label || "Your schedule";
        body.querySelectorAll(".bg-opt__prev:not(.bg-opt__prev--img)").forEach(function (el, i) { if (i <= PATTERNS.length) el.style.backgroundColor = draft.color; });
      }
      labelIn.addEventListener("input", function () { draft.label = labelIn.value; labelIn.classList.remove("is-invalid"); body.querySelector("#ed-label-err").textContent = ""; preview(); checkDup(); });
      labelIn.addEventListener("change", snapshot);
      const desc = body.querySelector("#ed-desc");
      desc.addEventListener("input", function () { draft.description = desc.value; });
      desc.addEventListener("change", snapshot);
      body.querySelectorAll('input[name="ed-color"]').forEach(function (r) {
        r.addEventListener("change", function () { draft.color = r.value; body.querySelector(".swatch--custom").classList.remove("is-custom"); preview(); snapshot(); });
      });
      const customIn = body.querySelector("#ed-color-custom");
      customIn.addEventListener("input", function () {
        draft.color = customIn.value;
        body.querySelectorAll('input[name="ed-color"]').forEach(function (r) { r.checked = false; });
        body.querySelector(".swatch--custom").classList.add("is-custom");
        preview();
      });
      customIn.addEventListener("change", snapshot);
      body.querySelectorAll('input[name="ed-bg"]').forEach(function (r) {
        r.addEventListener("change", function () {
          const v = r.value;
          body.querySelector("#ed-bg-color-wrap").hidden = v !== "color";
          body.querySelector("#ed-bg-img-wrap").hidden = v !== "image";
          if (v === "none") draft.background = { type: "none", value: "" };
          else if (v.indexOf("pattern:") === 0) draft.background = { type: "pattern", value: v.slice(8) };
          else if (v === "color") draft.background = { type: "color", value: body.querySelector("#ed-bg-color").value };
          else if (v === "image") { if (draft.background.type !== "image") { body.querySelector("#ed-bg-img").click(); return; } }
          preview(); snapshot();
        });
      });
      const bgColor = body.querySelector("#ed-bg-color");
      bgColor.addEventListener("input", function () { draft.background = { type: "color", value: bgColor.value }; bgColor.closest("fieldset").querySelector('input[value="color"]').nextElementSibling.style.background = bgColor.value; preview(); });
      bgColor.addEventListener("change", snapshot);
      body.querySelector("#ed-bg-img").addEventListener("change", function (e) {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 1.5 * 1024 * 1024) { toast("That image is larger than 1.5 MB. Choose a smaller one.", { type: "error" }); e.target.value = ""; return; }
        const reader = new FileReader();
        reader.onload = function () { draft.background = { type: "image", value: reader.result }; snapshot(); drawStep2(); };
        reader.readAsDataURL(f);
      });
      body.querySelector("#ed-change-day").addEventListener("click", function () { step = 1; draw(); });
      checkDup();
      if (!opts.noFocus) labelIn.focus();
    }

    /* Step 3 — timetable on the left, task form on the right */
    function drawStep3() {
      const others = [];
      S.activeSchedules().forEach(function (s) {
        if (s.date !== draft.date || (editing && s.id === editing.id)) return;
        const removed = [];
        draft.overwrites.forEach(function (o) { if (String(o.scheduleId) === String(s.id)) removed.push.apply(removed, o.taskIds.map(String)); });
        s.tasks.forEach(function (t) { if (t.status !== "cancelled" && removed.indexOf(String(t.id)) === -1) others.push({ s: s, t: t }); });
      });
      let rows = "";
      for (let m = S.constants.DAY_START; m < S.constants.DAY_END; m += 60) {
        const here = draft.tasks.filter(function (t) { return U.toMin(t.start) >= m && U.toMin(t.start) < m + 60; });
        const busy = others.filter(function (o) { return U.overlaps(m, m + 60, U.toMin(o.t.start), U.toMin(o.t.end)); });
        rows += '<li class="tt__row' + (U.toTime(m) === slotStart && !editTaskId ? " is-selected" : "") + '">' +
          '<button type="button" class="tt__slot" data-slot="' + U.toTime(m) + '" aria-label="Add a task from ' + U.fmtTime(U.toTime(m)) + " to " + U.fmtTime(U.toTime(m + 60)) + '">' +
            '<span class="tt__time">' + U.fmtTime(U.toTime(m)).replace(" ", "\u00a0") + " – " + U.fmtTime(U.toTime(m + 60)).replace(" ", "\u00a0") + "</span></button>" +
          '<div class="tt__items">' +
            here.map(function (t) {
              return '<button type="button" class="tt__task urg--' + t.urgency + (editTaskId === String(t.id) ? " is-editing" : "") + '" data-task="' + esc(t.id) + '"><strong>' + esc(t.label) + "</strong><small>" + fmtRange(t) + " · " + URG_LABEL[t.urgency] + "</small></button>";
            }).join("") +
            busy.map(function (o) { return '<span class="tt__busy" title="Planned in another schedule">' + esc(o.t.label) + " <small>(" + esc(o.s.label) + ")</small></span>"; }).join("") +
          "</div></li>";
      }
      const editingTask = editTaskId ? draft.tasks.find(function (t) { return String(t.id) === editTaskId; }) : null;
      const f = editingTask || { start: slotStart, end: U.toTime(Math.min(U.toMin(slotStart) + 60, S.constants.DAY_END)), label: "", description: "", urgency: "normal" };

      body.innerHTML =
        '<div class="ed-step3">' +
          '<section class="tt" aria-label="Timetable for ' + fmtDate(draft.date) + '">' +
            '<div class="tt__head"><strong>' + esc(draft.label) + '</strong><span class="muted">' + fmtDate(draft.date, { weekday: "long", month: "long" }) + "</span></div>" +
            '<ol class="tt__list">' + rows + "</ol>" +
          "</section>" +
          '<section class="task-form" aria-label="' + (editingTask ? "Edit task" : "New task") + '">' +
            "<h3>" + (editingTask ? "Edit task" : "Add a task") + "</h3>" +
            '<div class="row"><div class="field"><label class="label" for="tf-start">Start</label><select class="select" id="tf-start">' + timeOptions(f.start, S.constants.DAY_START, S.constants.DAY_END - 30) + '</select></div>' +
            '<div class="field"><label class="label" for="tf-end">End</label><select class="select" id="tf-end">' + timeOptions(f.end, S.constants.DAY_START + 30, S.constants.DAY_END) + "</select></div></div>" +
            '<div class="field"><label class="label" for="tf-label">Label</label><input class="input" id="tf-label" maxlength="80" value="' + esc(f.label) + '" placeholder="e.g. Math review"><span class="field__error" id="tf-err"></span></div>' +
            '<div class="field"><label class="label" for="tf-desc">Description</label><textarea class="textarea" id="tf-desc" maxlength="500" placeholder="Details, links, location…">' + esc(f.description) + "</textarea></div>" +
            '<fieldset class="field ed-fieldset"><legend class="label">Urgency level</legend><div class="chips">' +
              S.constants.URGENCY.map(function (u) {
                return '<label class="chip"><input type="radio" name="tf-urg" value="' + u + '"' + (f.urgency === u ? " checked" : "") + '><span><i class="chip__dot urg-dot--' + u + '"></i>' + URG_LABEL[u] + "</span></label>";
              }).join("") +
            "</div></fieldset>" +
            '<div class="task-form__actions">' +
              '<button type="button" class="btn btn--blue" id="tf-add">' + icon(editingTask ? "check" : "plus") + (editingTask ? "Update task" : "Add to timetable") + "</button>" +
              (editingTask ? '<button type="button" class="btn" id="tf-cancel">Cancel edit</button><button type="button" class="btn btn--danger" id="tf-remove">' + icon("trash") + "Remove</button>" : "") +
            "</div>" +
            '<p class="hint">' + draft.tasks.length + " task" + (draft.tasks.length === 1 ? "" : "s") + " in this schedule · " + fmtDuration(draft.tasks.reduce(function (a, t) { return a + U.toMin(t.end) - U.toMin(t.start); }, 0)) + " planned</p>" +
          "</section>" +
        "</div>";

      body.querySelectorAll("[data-slot]").forEach(function (b) {
        b.addEventListener("click", function () { slotStart = b.dataset.slot; editTaskId = null; drawStep3(); body.querySelector("#tf-label").focus(); });
      });
      body.querySelectorAll("[data-task]").forEach(function (b) {
        b.addEventListener("click", function () { editTaskId = b.dataset.task; drawStep3(); body.querySelector("#tf-label").focus(); });
      });
      const startSel = body.querySelector("#tf-start"), endSel = body.querySelector("#tf-end");
      startSel.addEventListener("change", function () {
        if (U.toMin(endSel.value) <= U.toMin(startSel.value)) endSel.value = U.toTime(Math.min(U.toMin(startSel.value) + 60, S.constants.DAY_END));
      });
      body.querySelector("#tf-add").addEventListener("click", addTask);
      body.querySelector("#tf-label").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTask(); } });
      if (editingTask) {
        body.querySelector("#tf-cancel").addEventListener("click", function () { editTaskId = null; drawStep3(); });
        body.querySelector("#tf-remove").addEventListener("click", function () {
          draft.tasks = draft.tasks.filter(function (t) { return String(t.id) !== editTaskId; });
          editTaskId = null; snapshot(); drawStep3();
          toast("Task removed. Use Undo to bring it back.");
        });
      }
      const sel = body.querySelector(".tt__row.is-selected, .tt__task.is-editing");
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
    }

    async function addTask() {
      const label = body.querySelector("#tf-label");
      const t = {
        id: editTaskId || U.uid("t"),
        start: body.querySelector("#tf-start").value,
        end: body.querySelector("#tf-end").value,
        label: label.value.trim(),
        description: body.querySelector("#tf-desc").value.trim(),
        urgency: (body.querySelector('input[name="tf-urg"]:checked') || {}).value || "normal",
        status: "pending"
      };
      const err = body.querySelector("#tf-err");
      if (!t.label) { label.classList.add("is-invalid"); err.textContent = "Give this task a label."; label.focus(); return; }
      if (U.toMin(t.end) <= U.toMin(t.start)) { err.textContent = "The end time must be after the start time."; return; }
      if (editTaskId) {
        const old = draft.tasks.find(function (x) { return String(x.id) === editTaskId; });
        t.status = old.status; t.completed_at = old.completed_at;
      }

      const ignore = [];
      draft.overwrites.forEach(function (o) { ignore.push.apply(ignore, o.taskIds.map(String)); });
      const hits = S.findConflicts(draft.date, t.start, t.end, {
        excludeScheduleId: editing && editing.id, draftTasks: draft.tasks, excludeTaskId: editTaskId, ignoreTaskIds: ignore
      });

      if (hits.length) {
        const dup = hits.some(function (h) { return S.isDuplicateTask(h, t.label, t.start, t.end); });
        const list = "<ul class=\"conflict-list\">" + hits.map(function (h) {
          return "<li><strong>" + esc(h.task.label) + "</strong> · " + fmtRange(h.task) + (h.schedule ? " <small>(in “" + esc(h.schedule.label) + "”)</small>" : " <small>(in this schedule)</small>") + "</li>";
        }).join("") + "</ul>" + (dup ? '<p class="notice notice--warn">' + icon("warning") + "<span>This looks like a duplicate of a task you already planned.</span></p>" : "");
        const free = S.findFreeSlot(draft.date, U.toMin(t.end) - U.toMin(t.start), U.toMin(t.end), {
          excludeScheduleId: editing && editing.id, draftTasks: draft.tasks, excludeTaskId: editTaskId, ignoreTaskIds: ignore
        });
        const choice = await choose({
          message: "Another schedule has been planned. Do you want to move this or overwrite that schedule?",
          detail: list + (free ? '<p class="muted">Moving will place it at ' + U.fmtTime(free.start) + " – " + U.fmtTime(free.end) + ".</p>" : '<p class="muted">There is no free slot left on this day to move it to.</p>'),
          icon: "warning",
          buttons: [
            free ? { value: "move", label: "Move this", icon: "move", className: "btn--yellow" } : null,
            { value: "overwrite", label: "Overwrite that", className: "btn--orange" },
            { value: "cancel", label: "Cancel" }
          ].filter(Boolean)
        });
        if (!choice) return;
        if (choice === "move") {
          t.start = free.start; t.end = free.end;
          toast("Moved to " + U.fmtTime(free.start) + " – " + U.fmtTime(free.end) + ".");
        } else {
          hits.forEach(function (h) {
            if (h.source === "draft") {
              draft.tasks = draft.tasks.filter(function (x) { return x !== h.task; });
            } else {
              let o = draft.overwrites.find(function (x) { return String(x.scheduleId) === String(h.schedule.id); });
              if (!o) { o = { scheduleId: h.schedule.id, taskIds: [] }; draft.overwrites.push(o); }
              o.taskIds.push(String(h.task.id));
            }
          });
          toast("The other task will be overwritten when you save.");
        }
      }

      if (editTaskId) draft.tasks = draft.tasks.map(function (x) { return String(x.id) === editTaskId ? t : x; });
      else draft.tasks.push(t);
      draft.tasks.sort(function (a, b) { return U.toMin(a.start) - U.toMin(b.start); });
      slotStart = U.toTime(Math.min(U.toMin(t.end), S.constants.DAY_END - 60));
      editTaskId = null;
      snapshot();
      drawStep3();
      if (S.dayLoad(draft.date) + draft.tasks.reduce(function (a, x) { return a + U.toMin(x.end) - U.toMin(x.start); }, 0) > S.state.settings.busyThresholdHours * 60) {
        toast("This day is getting very busy. Check the dashboard for suggestions to move some tasks.", { duration: 5000 });
      }
    }

    draw();
    return d;
  }

  /* =========================================================
     Reminder editor
     ========================================================= */
  function openReminderEditor(id) {
    const existing = id ? S.getReminder(id) : null;
    const draft = existing ? { label: existing.label, deadline: existing.deadline, description: existing.description } : { label: "", deadline: "", description: "" };
    const history = [JSON.stringify(draft)];
    let hIndex = 0, timer = null;

    const d = modal({
      title: existing ? "Edit reminder" : "Create a reminder",
      body:
        '<div class="field"><label class="label" for="rm-label">Label</label><input class="input" id="rm-label" maxlength="80" placeholder="e.g. Submit report"><span class="field__error" id="rm-label-err"></span></div>' +
        '<div class="field"><label class="label" for="rm-deadline">Deadline</label><input class="input" id="rm-deadline" type="datetime-local"><span class="field__error" id="rm-deadline-err"></span></div>' +
        '<div class="field"><label class="label" for="rm-desc">Description</label><textarea class="textarea" id="rm-desc" maxlength="500" placeholder="Anything you need to remember"></textarea></div>',
      foot: '<div class="modal__foot-group"><button type="button" class="btn btn--sm" id="rm-undo">' + icon("undo") + 'Undo</button><button type="button" class="btn btn--sm" id="rm-redo">' + icon("redo") + "Redo</button></div>" +
        '<div class="modal__foot-group"><button type="button" class="btn btn--ghost" id="rm-discard">Discard</button><button type="button" class="btn btn--yellow" id="rm-save">Save</button></div>',
      beforeClose: function () {
        if (history[hIndex] === history[0] && JSON.stringify(read()) === history[0]) return true;
        return confirm({ message: "Discard this reminder? Your changes will be lost.", confirmText: "Discard", danger: true, icon: "trash" });
      }
    });
    const f = { label: d.querySelector("#rm-label"), deadline: d.querySelector("#rm-deadline"), description: d.querySelector("#rm-desc") };
    const undoB = d.querySelector("#rm-undo"), redoB = d.querySelector("#rm-redo");
    function read() { return { label: f.label.value, deadline: f.deadline.value, description: f.description.value }; }
    function write(o) { f.label.value = o.label; f.deadline.value = o.deadline; f.description.value = o.description; }
    function sync() { undoB.disabled = hIndex === 0; redoB.disabled = hIndex >= history.length - 1; }
    function snap() {
      const s = JSON.stringify(read());
      if (s === history[hIndex]) return;
      history.splice(hIndex + 1); history.push(s); hIndex = history.length - 1; sync();
    }
    write(draft); sync();
    Object.values(f).forEach(function (el) {
      el.addEventListener("input", function () { el.classList.remove("is-invalid"); clearTimeout(timer); timer = setTimeout(snap, 400); });
      el.addEventListener("change", function () { clearTimeout(timer); snap(); });
    });
    undoB.addEventListener("click", function () { clearTimeout(timer); snap(); if (hIndex > 0) { hIndex--; write(JSON.parse(history[hIndex])); sync(); } });
    redoB.addEventListener("click", function () { if (hIndex < history.length - 1) { hIndex++; write(JSON.parse(history[hIndex])); sync(); } });
    d.addEventListener("keydown", function (e) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); undoB.click(); }
    });
    d.querySelector("#rm-discard").addEventListener("click", function () { d.tryClose(); });
    d.querySelector("#rm-save").addEventListener("click", async function () {
      const v = read();
      let ok = true;
      if (!v.label.trim()) { f.label.classList.add("is-invalid"); d.querySelector("#rm-label-err").textContent = "Give your reminder a label."; ok = false; } else d.querySelector("#rm-label-err").textContent = "";
      if (!v.deadline) { f.deadline.classList.add("is-invalid"); d.querySelector("#rm-deadline-err").textContent = "Choose a deadline."; ok = false; } else d.querySelector("#rm-deadline-err").textContent = "";
      if (!ok) { d.querySelector(".is-invalid").focus(); return; }
      try {
        await S.saveReminder(v, existing && existing.id);
        history.length = 1; history[0] = JSON.stringify(v); hIndex = 0;
        d.close();
        toast(existing ? "Reminder updated." : "Reminder saved.", { type: "success" });
      } catch (err) { toast(err.message, { type: "error" }); }
    });
    f.label.focus();
    return d;
  }

  /* =========================================================
     Schedule detail
     ========================================================= */
  function openSchedule(id) {
    const s = S.getSchedule(id);
    if (!s || s.deleted_at) { toast("That schedule is no longer available.", { type: "error" }); return; }
    let d;
    function head(sc) {
      const dl = S.scheduleDeadline(sc);
      return '<div class="modal__head detail__head ' + bgClass(sc.background) + '" style="' + bgStyle(sc) + '">' +
        '<div class="detail__title"><span class="detail__chip">' + icon("calendar") + fmtDate(sc.date, { weekday: "long", month: "long" }) + "</span>" +
        (sc.pinned ? '<span class="detail__chip">' + icon("pin") + "Pinned</span>" : "") +
        '<h2 id="dt-title">' + esc(sc.label) + "</h2>" +
        (dl ? '<span class="detail__chip">' + icon("clock") + "Deadline " + U.fmtTime(dl.time) + "</span>" : "") + "</div>" +
        '<div class="modal__tools">' +
          '<button type="button" class="icon-btn icon-btn--danger" id="dt-trash" aria-label="Move schedule to trash" title="Move to trash">' + icon("trash") + "</button>" +
          '<button type="button" class="icon-btn" id="dt-more" aria-haspopup="menu" aria-expanded="false" aria-label="More options">' + icon("dots") + "</button>" +
          '<button type="button" class="icon-btn" data-close aria-label="Close">' + icon("x") + "</button>" +
        "</div></div>";
    }
    function bodyHtml(sc) {
      const tasks = (sc.tasks || []).map(function (t) {
        const st = S.taskStatus(t, sc);
        return '<li class="dtask dtask--' + st + '">' +
          '<button type="button" class="icon-btn icon-btn--check" data-check="' + esc(t.id) + '" aria-pressed="' + (t.status === "finished") + '" aria-label="' + (t.status === "finished" ? "Mark “" + esc(t.label) + "” as not done" : "Mark “" + esc(t.label) + "” as done") + '">' + icon("check") + "</button>" +
          '<div class="dtask__main"><div class="dtask__top"><strong>' + esc(t.label) + '</strong><span class="dtask__time">' + fmtRange(t) + "</span></div>" +
          (t.description ? "<p>" + esc(t.description) + "</p>" : "") +
          '<div class="dtask__badges"><span class="badge badge--' + st + '">' + statusLabel(st) + '</span><span class="badge badge--' + t.urgency + '">' + URG_LABEL[t.urgency] + "</span></div></div>" +
          (t.status === "pending" ? '<button type="button" class="btn btn--sm btn--ghost" data-cancel="' + esc(t.id) + '">' + icon("ban") + "Cancel</button>" :
            t.status === "cancelled" ? '<button type="button" class="btn btn--sm btn--ghost" data-reopen="' + esc(t.id) + '">' + icon("restore") + "Reopen</button>" : "") +
          "</li>";
      }).join("");
      const done = sc.tasks.filter(function (t) { return t.status === "finished"; }).length;
      return (sc.description ? '<p class="detail__desc">' + esc(sc.description) + "</p>" : '<p class="muted">No description.</p>') +
        '<div class="detail__progress"><span>' + done + " of " + sc.tasks.length + ' tasks done</span><div class="detail__bar"><i style="width:' + (sc.tasks.length ? done / sc.tasks.length * 100 : 0) + '%"></i></div></div>' +
        '<h3>Tasks</h3><ul class="dtasks">' + (tasks || '<li class="empty">No tasks.</li>') + "</ul>" +
        '<details class="detail__activity"><summary><h3>Activity</h3></summary><ul>' + (sc.activity || []).map(function (a) {
          return "<li><span>" + esc(a.text) + '</span><time class="muted" datetime="' + a.at + '">' + timeAgo(a.at) + "</time></li>";
        }).join("") + "</ul></details>";
    }
    function wire() {
      const sc = S.getSchedule(id);
      d.querySelector("#dt-trash").addEventListener("click", function () { trashScheduleFlow(sc.id, d); });
      const more = d.querySelector("#dt-more");
      more.addEventListener("click", function () {
        const cur = S.getSchedule(id);
        menu(more, [
          { label: "Download", icon: "download", submenu: [
            { label: "PDF file", icon: "file", onClick: function () { exportSchedule(cur, "pdf"); } },
            { label: "Excel file", icon: "sheet", onClick: function () { exportSchedule(cur, "xlsx"); } },
            { label: "JSON file", icon: "code", onClick: function () { exportSchedule(cur, "json"); } },
            { label: "CSV file", icon: "sheet", onClick: function () { exportSchedule(cur, "csv"); } }
          ] },
          { label: "Modify", icon: "edit", onClick: function () { d.close(); openScheduleEditor({ scheduleId: cur.id, step: 3 }); } },
          { label: "Customize", icon: "palette", onClick: function () { d.close(); openScheduleEditor({ scheduleId: cur.id, step: 2, noFocus: true }); } },
          { label: cur.pinned ? "Unpin" : "Pin", icon: "pin", onClick: async function () {
            const was = cur.pinned;
            await S.patchSchedule(cur.id, { pinned: !was }, was ? "Unpinned" : "Pinned");
            toast(was ? "Schedule unpinned." : "Schedule pinned.");
          } },
          { label: "Move to trash", icon: "trash", danger: true, onClick: function () { trashScheduleFlow(cur.id, d); } }
        ], { label: "Schedule options" });
      });
    }
    function refresh() {
      const sc = S.getSchedule(id);
      if (!sc || sc.deleted_at || !d.open) return;
      const focusKey = document.activeElement && (document.activeElement.dataset.check || document.activeElement.id);
      d.querySelector(".modal__head").outerHTML = head(sc);
      d.querySelector(".modal__body").innerHTML = bodyHtml(sc);
      wire();
      if (focusKey) { const el = d.querySelector('[data-check="' + focusKey + '"]') || d.querySelector("#" + focusKey); if (el) el.focus(); }
    }
    d = modal({ size: "md", head: head(s), body: bodyHtml(s), className: "detail" });
    d.setAttribute("aria-labelledby", "dt-title");
    wire();
    /* One delegated listener for the task buttons (the body is re-rendered, the element stays) */
    d.querySelector(".modal__body").addEventListener("click", async function (e) {
        const c = e.target.closest("[data-check],[data-cancel],[data-reopen]");
        if (!c) return;
        const t = S.getSchedule(id).tasks.find(function (x) { return String(x.id) === (c.dataset.check || c.dataset.cancel || c.dataset.reopen); });
        let status = "pending";
        if (c.dataset.check) status = t.status === "finished" ? "pending" : "finished";
        if (c.dataset.cancel) status = "cancelled";
        try {
          await S.setTaskStatus(id, t.id, status);
          if (status === "finished") toast("“" + t.label + "” marked as done.", { type: "success" });
        } catch (err) { toast(err.message, { type: "error" }); }
      });

    const off = function () { refresh(); };
    S.on("change", off);
    return d;
  }
  function statusLabel(st) { return { finished: "Finished", pending: "Pending", cancelled: "Cancelled", overtime: "Overtime" }[st] || st; }

  /* Trash flow: warning → remove → top toast with Undo (6 seconds) */
  async function trashScheduleFlow(id, dialog) {
    const s = S.getSchedule(id);
    const ok = await confirm({
      message: "Are you sure you want to remove this? You can still recover this.",
      detail: "“" + esc(s.label) + "” will stay in the trash for " + S.constants.TRASH_DAYS + " days.",
      icon: "trash", danger: true, confirmText: "Remove", confirmIcon: "trash"
    });
    if (!ok) return;
    try {
      await S.trashSchedule(id);
      if (dialog && dialog.open) dialog.close();
      toast("Schedule has been removed.", {
        duration: 6000,
        action: { label: "Undo", fn: async function () { await S.restoreSchedule(id); toast("Schedule restored.", { type: "success" }); } }
      });
    } catch (err) { toast(err.message, { type: "error" }); }
  }

  /* =========================================================
     Downloads: PDF, Excel, JSON, CSV
     ========================================================= */
  function exportRows(s) {
    return s.tasks.map(function (t) {
      return [s.label, s.date, U.fmtTime(t.start), U.fmtTime(t.end), t.label, t.description || "", URG_LABEL[t.urgency], statusLabel(S.taskStatus(t, s))];
    });
  }
  const EXPORT_HEAD = ["Schedule", "Date", "Start", "End", "Task", "Description", "Urgency", "Status"];

  function exportSchedule(s, fmt) {
    const name = slug(s.label) + "-" + s.date;
    // Logged in: let the server build real .xlsx / .pdf files
    if (S.state.mode === "server" && (fmt === "xlsx" || fmt === "pdf")) {
      location.href = "/api/user/schedules/" + encodeURIComponent(s.id) + "/export?format=" + fmt;
      return;
    }
    if (fmt === "json") {
      const clean = JSON.parse(JSON.stringify(s));
      if (clean.background && clean.background.type === "image") clean.background.value = "(image)";
      download(name + ".json", JSON.stringify(clean, null, 2), "application/json");
    }
    if (fmt === "csv") {
      const cell = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const lines = [EXPORT_HEAD].concat(exportRows(s)).map(function (r) { return r.map(cell).join(","); });
      download(name + ".csv", "\ufeff" + lines.join("\r\n"), "text/csv");
    }
    if (fmt === "xlsx") {
      // Excel 2003 XML spreadsheet: opens directly in Excel, no library needed
      const x = function (v) { return esc(v); };
      const row = function (r, style) { return "<Row>" + r.map(function (c) { return '<Cell' + (style ? ' ss:StyleID="h"' : "") + '><Data ss:Type="String">' + x(c) + "</Data></Cell>"; }).join("") + "</Row>"; };
      const xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
        '<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#FFDE59" ss:Pattern="Solid"/></Style></Styles>' +
        '<Worksheet ss:Name="Schedule"><Table>' + row(EXPORT_HEAD, true) + exportRows(s).map(function (r) { return row(r); }).join("") + "</Table></Worksheet></Workbook>";
      download(name + ".xls", xml, "application/vnd.ms-excel");
    }
    if (fmt === "pdf") download(name + ".pdf", buildPdf(s), "application/pdf");
    toast("Download started.");
  }

  /* Minimal PDF writer (text only, Helvetica) so PDFs work offline too */
  function buildPdf(s) {
    const ascii = function (t) {
      return String(t).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/\u00a0/g, " ")
        .replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    };
    const wrap = function (text, max) {
      const words = String(text).split(/\s+/), out = []; let line = "";
      words.forEach(function (w) { if ((line + " " + w).trim().length > max) { out.push(line); line = w; } else line = (line + " " + w).trim(); });
      if (line) out.push(line); return out.length ? out : [""];
    };
    const lines = [];
    lines.push({ t: s.label, size: 20, bold: true });
    lines.push({ t: fmtDate(s.date, { weekday: "long", month: "long" }), size: 11 });
    const dl = S.scheduleDeadline(s);
    if (dl) lines.push({ t: "Deadline: " + U.fmtTime(dl.time), size: 11 });
    if (s.description) wrap(s.description, 90).forEach(function (l) { lines.push({ t: l, size: 11 }); });
    lines.push({ t: "", size: 8 });
    lines.push({ t: "Tasks", size: 14, bold: true });
    s.tasks.forEach(function (t) {
      lines.push({ t: U.fmtTime(t.start) + " - " + U.fmtTime(t.end) + "   " + t.label + "   [" + URG_LABEL[t.urgency] + ", " + statusLabel(S.taskStatus(t, s)) + "]", size: 11, bold: true });
      if (t.description) wrap(t.description, 92).forEach(function (l) { lines.push({ t: "    " + l, size: 10 }); });
    });
    lines.push({ t: "", size: 8 });
    lines.push({ t: "Exported from Scheduler on " + new Date().toLocaleString(), size: 9 });

    const pages = [[]]; let y = 800;
    lines.forEach(function (l) {
      const h = l.size + 6;
      if (y - h < 50) { pages.push([]); y = 800; }
      y -= h; pages[pages.length - 1].push({ l: l, y: y });
    });
    const objs = [];
    objs.push("<< /Type /Catalog /Pages 2 0 R >>");
    objs.push(null); // pages, filled later
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const kids = [];
    pages.forEach(function (pg) {
      let stream = "0.07 0.31 0.95 rg 50 815 495 4 re f 0 0 0 rg\n";
      pg.forEach(function (it) { stream += "BT /" + (it.l.bold ? "F2" : "F1") + " " + it.l.size + " Tf 50 " + it.y + " Td (" + ascii(it.l.t) + ") Tj ET\n"; });
      objs.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream");
      const contentNo = objs.length;
      objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentNo + " 0 R >>");
      kids.push(objs.length + " 0 R");
    });
    objs[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
    let out = "%PDF-1.4\n"; const offsets = [];
    objs.forEach(function (o, i) { offsets.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    const xref = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map(function (o) { return String(o).padStart(10, "0") + " 00000 n \n"; }).join("");
    out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return out;
  }

  /* =========================================================
     Boot
     ========================================================= */
  const readyFns = [];
  let isReady = false;
  function ready(fn) { if (isReady) fn(); else readyFns.push(fn); }

  buildShell();
  /* Any button with data-create="schedule" or "reminder" opens the matching form */
  document.addEventListener("click", function (e) {
    const b = e.target.closest("[data-create]");
    if (!b) return;
    if (b.dataset.create === "schedule") openScheduleEditor(b.dataset.date ? { date: b.dataset.date } : {});
    if (b.dataset.create === "reminder") openReminderEditor();
  });
  S.on("change", function (e) {
    if (e.type === "settings" || e.type === "init") applySettings();
    refreshShell();
  });
  S.init().then(function () {
    isReady = true;
    readyFns.forEach(function (fn) { fn(); });
    const q = new URLSearchParams(location.search);
    if (q.get("open") && PAGE === "schedules") openSchedule(q.get("open"));
    if (q.get("create") === "schedule") openScheduleEditor();
    if (q.get("create") === "reminder") openReminderEditor();
  });

  window.App = {
    ready: ready, url: url, icon: icon, esc: esc, fmtDate: fmtDate, fmtRange: fmtRange, fmtDuration: fmtDuration, timeAgo: timeAgo,
    toast: toast, confirm: confirm, choose: choose, modal: modal, menu: menu, closeMenus: closeMenus,
    greeting: greeting, applySettings: applySettings, chartPatterns: chartPatterns, cssVar: cssVar, statusLabel: statusLabel,
    openScheduleEditor: openScheduleEditor, openReminderEditor: openReminderEditor, openSchedule: openSchedule,
    trashScheduleFlow: trashScheduleFlow, exportSchedule: exportSchedule, download: download, bgClass: bgClass, bgStyle: bgStyle, textOn: textOn,
    logout: logout, URG_LABEL: URG_LABEL, COLORS: COLORS
  };
})();
