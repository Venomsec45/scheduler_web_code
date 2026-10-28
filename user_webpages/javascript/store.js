/* =========================================================
   Scheduler user app — data store
   ---------------------------------------------------------
   * Server mode: the user is logged in, every change goes
     through the FastAPI endpoints under /api/user/...
   * Local mode: no session / backend not reachable. Data is
     kept in this browser (localStorage) so every page still
     works while the backend is being connected.
   Also contains the scheduling logic: conflict + duplicate
   detection, statistics for the pie charts, schedule-moving
   recommendations, deadline checks and the 5-day trash purge.
   ========================================================= */
(function () {
  "use strict";

  const API = "/api";
  const LS_KEY = "scheduler-app-v1";
  const TRASH_DAYS = 5;
  const DAY_START = 6 * 60;   // timetable starts 6:00 AM
  const DAY_END = 23 * 60;    // timetable ends 11:00 PM
  const URGENCY = ["optional", "normal", "medium", "high", "urgent"];
  const STATUSES = ["finished", "pending", "cancelled", "overtime"];
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const DEFAULT_SETTINGS = {
    theme: "system",
    timezone: "auto",
    weekStart: 1,
    busyThresholdHours: 8,
    a11y: {
      colorblind: "none",
      highContrast: false,
      fontScale: 100,
      bold: false,
      underlineLinks: false,
      reduceMotion: false,
      dyslexia: false,
      chartPatterns: false,
      visualAlerts: false,
      textAlerts: true
    },
    notifications: {
      inApp: true,
      email: true,
      leadMinutes: 30,
      kinds: { near: true, overdue: true, early: true, reminder: true, recommendation: true }
    },
    dashboard: { charts: { status: true, days: true, weeks: true, hours: false } },
    privacy: { analytics: false, showProfileToTeam: false },
    dismissedRecs: []
  };

  const state = {
    mode: "local",
    apiOnline: false,
    ready: false,
    profile: { name: "", email: "", phone: "", country: "" },
    settings: clone(DEFAULT_SETTINGS),
    schedules: [],
    reminders: [],
    notifications: []
  };

  const listeners = {};

  /* ---------- small helpers ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || "l") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function merge(base, extra) {
    const out = clone(base);
    if (!extra || typeof extra !== "object") return out;
    Object.keys(extra).forEach(function (k) {
      if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
        out[k] = merge(out[k], extra[k]);
      } else if (extra[k] !== undefined) {
        out[k] = extra[k];
      }
    });
    return out;
  }
  function toMin(t) { const p = String(t || "0:0").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function toTime(m) { m = Math.max(0, Math.min(24 * 60, m)); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function fmtTime(t) {
    const m = toMin(t); let h = Math.floor(m / 60); const mm = m % 60; const ap = h >= 12 && h < 24 ? "PM" : "AM";
    h = h % 12 || 12; return h + (mm ? ":" + String(mm).padStart(2, "0") : "") + " " + ap;
  }
  function parseISODate(d) { const p = d.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function isoDate(dt) { return dt.toISOString().slice(0, 10); }
  function addDays(d, n) { const x = parseISODate(d); x.setUTCDate(x.getUTCDate() + n); return isoDate(x); }
  function dayDiff(a, b) { return Math.round((parseISODate(b) - parseISODate(a)) / 864e5); }
  function weekday(d) { return parseISODate(d).getUTCDay(); }
  function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

  function timezone() {
    const tz = state.settings.timezone;
    if (tz && tz !== "auto") return tz;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }
  /* Current wall-clock date and minutes in the user's time zone */
  function now() {
    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone(), year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date());
    } catch (e) {
      parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    }
    const g = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
    return { date: g("year") + "-" + g("month") + "-" + g("day"), min: (+g("hour") % 24) * 60 + (+g("minute")) };
  }
  /* Minutes from now until a given date + time (negative = in the past) */
  function minutesUntil(date, time) {
    const n = now();
    return dayDiff(n.date, date) * 1440 + toMin(time) - n.min;
  }
  function weekStartOf(date) {
    const ws = state.settings.weekStart;
    const diff = (weekday(date) - ws + 7) % 7;
    return addDays(date, -diff);
  }

  /* ---------- events ---------- */
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }

  /* ---------- persistence ---------- */
  function saveLocal() {
    if (state.mode !== "local") return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        profile: state.profile, settings: state.settings,
        schedules: state.schedules, reminders: state.reminders, notifications: state.notifications
      }));
    } catch (e) { console.warn("Could not save to this browser:", e); }
  }
  function loadLocal() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { saved = null; }
    // Pick up the email used on the main website's demo sign up, if any
    let mainUser = null;
    try { mainUser = JSON.parse(localStorage.getItem("scheduler-user") || "null"); } catch (e) { mainUser = null; }
    state.profile = merge({ name: "", email: "", phone: "", country: "" }, saved && saved.profile);
    if (!state.profile.email && mainUser && mainUser.email) {
      state.profile.email = mainUser.email;
      state.profile.name = state.profile.name || mainUser.email.split("@")[0];
    }
    state.settings = merge(DEFAULT_SETTINGS, saved && saved.settings);
    state.schedules = (saved && saved.schedules) || [];
    state.reminders = (saved && saved.reminders) || [];
    state.notifications = (saved && saved.notifications) || [];
  }
  function applyBootstrap(b) {
    state.profile = merge({ name: "", email: "", phone: "", country: "" }, b.profile);
    state.settings = merge(DEFAULT_SETTINGS, b.settings);
    state.schedules = b.schedules || [];
    state.reminders = b.reminders || [];
    state.notifications = b.notifications || [];
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(API + path, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : {},
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.indexOf("application/json") !== -1) data = await res.json();
    if (!res.ok) {
      const err = new Error((data && (data.detail && data.detail.message || data.detail)) || ("Request failed (" + res.status + ")"));
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  async function init() {
    try {
      const r = await fetch(API + "/health", { credentials: "same-origin" });
      state.apiOnline = r.ok;
    } catch (e) { state.apiOnline = false; }

    if (state.apiOnline) {
      try {
        applyBootstrap(await api("/user/bootstrap"));
        state.mode = "server";
      } catch (e) {
        state.mode = "local";
        loadLocal();
      }
    } else {
      loadLocal();
    }
    state.ready = true;
    purgeTrash();
    tick();
    setInterval(tick, 60 * 1000);
    emit("change", { type: "init" });
    return state;
  }

  async function refreshFromServer() {
    if (state.mode !== "server") return;
    try { applyBootstrap(await api("/user/bootstrap")); emit("change", { type: "refresh" }); } catch (e) { /* keep current */ }
  }

  function commit(type) { saveLocal(); emit("change", { type: type }); }

  /* ---------- lookups ---------- */
  function getSchedule(id) { return state.schedules.find(function (s) { return String(s.id) === String(id); }); }
  function getReminder(id) { return state.reminders.find(function (r) { return String(r.id) === String(id); }); }
  function activeSchedules() { return state.schedules.filter(function (s) { return !s.deleted_at; }); }
  function activeReminders() { return state.reminders.filter(function (r) { return !r.deleted_at; }); }

  function scheduleDeadline(s) {
    if (!s.tasks || !s.tasks.length) return null;
    const last = s.tasks.reduce(function (a, t) { return toMin(t.end) > toMin(a.end) ? t : a; });
    return { date: s.date, time: last.end };
  }

  /* Effective status: a pending task whose end time has passed is "overtime" */
  function taskStatus(task, schedule) {
    if (task.status === "pending" && minutesUntil(schedule.date, task.end) < 0) return "overtime";
    return task.status;
  }

  function allTasks(opts) {
    opts = opts || {};
    const out = [];
    activeSchedules().forEach(function (s) {
      if (opts.from && s.date < opts.from) return;
      if (opts.to && s.date > opts.to) return;
      (s.tasks || []).forEach(function (t) {
        out.push({ task: t, schedule: s, date: s.date, status: taskStatus(t, s), minutes: Math.max(0, toMin(t.end) - toMin(t.start)) });
      });
    });
    out.sort(function (a, b) { return a.date === b.date ? toMin(a.task.start) - toMin(b.task.start) : (a.date < b.date ? -1 : 1); });
    return out;
  }

  /* ---------- conflict & duplicate detection ---------- */
  function overlaps(aS, aE, bS, bE) { return aS < bE && bS < aE; }

  /* Tasks already planned on `date` that overlap start–end.
     opts.excludeScheduleId skips the schedule being edited (its tasks are passed in opts.draftTasks). */
  function findConflicts(date, start, end, opts) {
    opts = opts || {};
    const s1 = toMin(start), e1 = toMin(end);
    const hits = [];
    activeSchedules().forEach(function (s) {
      if (s.date !== date) return;
      if (opts.excludeScheduleId && String(s.id) === String(opts.excludeScheduleId)) return;
      (s.tasks || []).forEach(function (t) {
        if (t.status === "cancelled") return;
        if ((opts.ignoreTaskIds || []).indexOf(String(t.id)) !== -1) return;
        if (overlaps(s1, e1, toMin(t.start), toMin(t.end))) hits.push({ schedule: s, task: t, source: "saved" });
      });
    });
    (opts.draftTasks || []).forEach(function (t) {
      if (opts.excludeTaskId && String(t.id) === String(opts.excludeTaskId)) return;
      if (overlaps(s1, e1, toMin(t.start), toMin(t.end))) hits.push({ schedule: null, task: t, source: "draft" });
    });
    return hits;
  }

  function isDuplicateTask(hit, label, start, end) {
    return norm(hit.task.label) === norm(label) && hit.task.start === start && hit.task.end === end;
  }

  function findDuplicateSchedule(label, date, excludeId) {
    return activeSchedules().find(function (s) {
      return s.date === date && norm(s.label) === norm(label) && String(s.id) !== String(excludeId || "");
    }) || null;
  }

  /* Next free slot of `duration` minutes on `date`, starting at/after fromMin */
  function findFreeSlot(date, duration, fromMin, opts) {
    opts = opts || {};
    for (let m = Math.max(DAY_START, fromMin || DAY_START); m + duration <= DAY_END; m += 30) {
      if (!findConflicts(date, toTime(m), toTime(m + duration), opts).length) return { start: toTime(m), end: toTime(m + duration) };
    }
    for (let m = DAY_START; m + duration <= Math.min(DAY_END, fromMin || DAY_END); m += 30) {
      if (!findConflicts(date, toTime(m), toTime(m + duration), opts).length) return { start: toTime(m), end: toTime(m + duration) };
    }
    return null;
  }

  /* ---------- schedules ---------- */
  function stamp(s, text) {
    s.activity = s.activity || [];
    s.activity.unshift({ at: new Date().toISOString(), text: text });
    s.activity = s.activity.slice(0, 40);
  }
  function normalizeTask(t) {
    return {
      id: t.id || uid("t"),
      start: t.start, end: t.end,
      label: (t.label || "").trim(),
      description: (t.description || "").trim(),
      urgency: URGENCY.indexOf(t.urgency) !== -1 ? t.urgency : "normal",
      status: t.status || "pending",
      completed_at: t.completed_at || null,
      notified_near: !!t.notified_near,
      notified_over: !!t.notified_over
    };
  }
  /* overwrites: [{ scheduleId, taskIds: [] }] — tasks in other schedules the user chose to overwrite */
  function applyOverwritesLocal(overwrites) {
    (overwrites || []).forEach(function (o) {
      const s = getSchedule(o.scheduleId);
      if (!s) return;
      const ids = o.taskIds.map(String);
      const removed = s.tasks.filter(function (t) { return ids.indexOf(String(t.id)) !== -1; });
      s.tasks = s.tasks.filter(function (t) { return ids.indexOf(String(t.id)) === -1; });
      removed.forEach(function (t) { stamp(s, "“" + t.label + "” was overwritten by another schedule"); });
      s.updated_at = new Date().toISOString();
    });
  }

  async function createSchedule(data, overwrites) {
    if (state.mode === "server") {
      const res = await api("/user/schedules", { method: "POST", body: { schedule: data, overwrites: overwrites || [], confirmed: true } });
      (res.updated || []).forEach(replaceSchedule);
      state.schedules.push(res.schedule);
      emit("change", { type: "schedule" });
      return res.schedule;
    }
    applyOverwritesLocal(overwrites);
    const s = {
      id: uid("s"),
      label: data.label.trim(),
      description: (data.description || "").trim(),
      date: data.date,
      color: data.color || "#FFDE59",
      background: data.background || { type: "none", value: "" },
      pinned: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      activity: [],
      tasks: (data.tasks || []).map(normalizeTask)
    };
    stamp(s, "Schedule created with " + s.tasks.length + " task" + (s.tasks.length === 1 ? "" : "s"));
    state.schedules.push(s);
    commit("schedule");
    return s;
  }

  function replaceSchedule(s) {
    const i = state.schedules.findIndex(function (x) { return String(x.id) === String(s.id); });
    if (i === -1) state.schedules.push(s); else state.schedules[i] = s;
  }

  async function updateSchedule(id, data, overwrites) {
    if (state.mode === "server") {
      const res = await api("/user/schedules/" + id, { method: "PUT", body: { schedule: data, overwrites: overwrites || [], confirmed: true } });
      (res.updated || []).forEach(replaceSchedule);
      replaceSchedule(res.schedule);
      emit("change", { type: "schedule" });
      return res.schedule;
    }
    applyOverwritesLocal(overwrites);
    const s = getSchedule(id);
    if (!s) throw new Error("Schedule not found");
    s.label = data.label.trim();
    s.description = (data.description || "").trim();
    s.date = data.date;
    s.color = data.color;
    s.background = data.background;
    s.tasks = (data.tasks || []).map(normalizeTask);
    s.updated_at = new Date().toISOString();
    stamp(s, "Schedule modified");
    commit("schedule");
    return s;
  }

  async function patchSchedule(id, patch, note) {
    if (state.mode === "server") {
      replaceSchedule(await api("/user/schedules/" + id, { method: "PATCH", body: patch }));
      emit("change", { type: "schedule" });
      return getSchedule(id);
    }
    const s = getSchedule(id);
    Object.assign(s, patch);
    s.updated_at = new Date().toISOString();
    if (note) stamp(s, note);
    commit("schedule");
    return s;
  }

  async function trashSchedule(id) {
    if (state.mode === "server") {
      replaceSchedule(await api("/user/schedules/" + id + "/trash", { method: "POST" }));
      emit("change", { type: "trash" });
      return;
    }
    const s = getSchedule(id);
    s.deleted_at = new Date().toISOString();
    s.pinned = false;
    stamp(s, "Moved to trash");
    commit("trash");
  }

  /* Active schedules that took this schedule's place (same day, overlapping tasks) */
  function replacementsFor(s) {
    return activeSchedules().filter(function (o) {
      if (o.date !== s.date || String(o.id) === String(s.id)) return false;
      return (s.tasks || []).some(function (t) {
        return (o.tasks || []).some(function (u) { return u.status !== "cancelled" && overlaps(toMin(t.start), toMin(t.end), toMin(u.start), toMin(u.end)); });
      });
    });
  }

  /* Recover from trash. Any schedule that replaced it is overwritten (moved to trash, so it can still be recovered). */
  async function restoreSchedule(id) {
    if (state.mode === "server") {
      const res = await api("/user/schedules/" + id + "/restore", { method: "POST" });
      (res.overwritten || []).forEach(replaceSchedule);
      replaceSchedule(res.schedule);
      emit("change", { type: "trash" });
      return res.overwritten || [];
    }
    const s = getSchedule(id);
    const reps = replacementsFor(s);
    reps.forEach(function (o) {
      o.deleted_at = new Date().toISOString();
      o.pinned = false;
      stamp(o, "Overwritten when “" + s.label + "” was recovered");
    });
    s.deleted_at = null;
    stamp(s, "Recovered from trash");
    commit("trash");
    return reps;
  }

  async function deleteSchedule(id) {
    if (state.mode === "server") await api("/user/schedules/" + id, { method: "DELETE" });
    state.schedules = state.schedules.filter(function (s) { return String(s.id) !== String(id); });
    commit("trash");
  }

  async function setTaskStatus(scheduleId, taskId, status) {
    const s = getSchedule(scheduleId);
    const t = s.tasks.find(function (x) { return String(x.id) === String(taskId); });
    if (state.mode === "server") {
      replaceSchedule(await api("/user/tasks/" + taskId, { method: "PATCH", body: { status: status } }));
      await refreshNotifications();
      emit("change", { type: "task" });
      return;
    }
    const early = status === "finished" && minutesUntil(s.date, t.end) > 0;
    t.status = status;
    t.completed_at = status === "finished" ? new Date().toISOString() : null;
    stamp(s, status === "finished" ? "Finished “" + t.label + "”" : status === "cancelled" ? "Cancelled “" + t.label + "”" : "Reopened “" + t.label + "”");
    if (early) notify("early", "Finished before the deadline", "Nice work! “" + t.label + "” was finished before " + fmtTime(t.end) + ".", { type: "schedule", id: s.id });
    commit("task");
  }

  /* Move a task to another day (used by recommendations) */
  async function moveTask(scheduleId, taskId, toDate, start, end) {
    if (state.mode === "server") {
      await api("/user/tasks/" + taskId + "/move", { method: "POST", body: { date: toDate, start: start, end: end } });
      await refreshFromServer();
      return;
    }
    const from = getSchedule(scheduleId);
    const t = from.tasks.find(function (x) { return String(x.id) === String(taskId); });
    from.tasks = from.tasks.filter(function (x) { return x !== t; });
    stamp(from, "Moved “" + t.label + "” to " + toDate);
    let target = activeSchedules().find(function (s) { return s.date === toDate && norm(s.label) === norm(from.label); }) ||
      activeSchedules().find(function (s) { return s.date === toDate; });
    if (!target) {
      target = {
        id: uid("s"), label: from.label, description: from.description, date: toDate,
        color: from.color, background: from.background, pinned: false, deleted_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), activity: [], tasks: []
      };
      state.schedules.push(target);
    }
    t.start = start; t.end = end; t.notified_near = false; t.notified_over = false;
    target.tasks.push(t);
    target.tasks.sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
    stamp(target, "Received “" + t.label + "” from " + from.date);
    commit("schedule");
  }

  /* ---------- reminders ---------- */
  async function saveReminder(data, id) {
    if (state.mode === "server") {
      const r = await api(id ? "/user/reminders/" + id : "/user/reminders", { method: id ? "PUT" : "POST", body: data });
      const i = state.reminders.findIndex(function (x) { return String(x.id) === String(r.id); });
      if (i === -1) state.reminders.push(r); else state.reminders[i] = r;
      emit("change", { type: "reminder" });
      return r;
    }
    if (id) {
      const r = getReminder(id);
      const deadlineChanged = r.deadline !== data.deadline;
      Object.assign(r, { label: data.label.trim(), deadline: data.deadline, description: (data.description || "").trim() });
      if (deadlineChanged) { r.notified_near = false; r.notified_over = false; }
      commit("reminder");
      return r;
    }
    const r = {
      id: uid("r"), label: data.label.trim(), deadline: data.deadline, description: (data.description || "").trim(),
      done: false, deleted_at: null, created_at: new Date().toISOString(), notified_near: false, notified_over: false
    };
    state.reminders.push(r);
    commit("reminder");
    return r;
  }
  async function setReminderDone(id, done) {
    if (state.mode === "server") return saveReminderPatch(id, { done: done });
    getReminder(id).done = done;
    commit("reminder");
  }
  async function saveReminderPatch(id, patch) {
    const r = await api("/user/reminders/" + id, { method: "PATCH", body: patch });
    const i = state.reminders.findIndex(function (x) { return String(x.id) === String(id); });
    state.reminders[i] = r;
    emit("change", { type: "reminder" });
    return r;
  }
  async function trashReminder(id) {
    if (state.mode === "server") return saveReminderPatch(id, { trashed: true });
    getReminder(id).deleted_at = new Date().toISOString();
    commit("trash");
  }
  async function restoreReminder(id) {
    if (state.mode === "server") return saveReminderPatch(id, { trashed: false });
    getReminder(id).deleted_at = null;
    commit("trash");
  }
  async function deleteReminder(id) {
    if (state.mode === "server") await api("/user/reminders/" + id, { method: "DELETE" });
    state.reminders = state.reminders.filter(function (r) { return String(r.id) !== String(id); });
    commit("trash");
  }

  /* ---------- trash ---------- */
  function trashItems() {
    const items = [];
    state.schedules.forEach(function (s) { if (s.deleted_at) items.push({ type: "schedule", item: s, deleted_at: s.deleted_at }); });
    state.reminders.forEach(function (r) { if (r.deleted_at) items.push({ type: "reminder", item: r, deleted_at: r.deleted_at }); });
    items.sort(function (a, b) { return a.deleted_at < b.deleted_at ? 1 : -1; });
    return items;
  }
  function daysLeft(deletedAt) {
    const ms = new Date(deletedAt).getTime() + TRASH_DAYS * 864e5 - Date.now();
    return Math.max(0, ms / 864e5);
  }
  /* Items in the trash for more than 5 days are deleted automatically (the server does the same). */
  function purgeTrash() {
    if (state.mode !== "local") return;
    const cutoff = Date.now() - TRASH_DAYS * 864e5;
    const before = state.schedules.length + state.reminders.length;
    state.schedules = state.schedules.filter(function (s) { return !s.deleted_at || new Date(s.deleted_at).getTime() > cutoff; });
    state.reminders = state.reminders.filter(function (r) { return !r.deleted_at || new Date(r.deleted_at).getTime() > cutoff; });
    if (state.schedules.length + state.reminders.length !== before) saveLocal();
  }
  async function emptyTrash() {
    if (state.mode === "server") {
      await api("/user/trash", { method: "DELETE" });
      state.schedules = state.schedules.filter(function (s) { return !s.deleted_at; });
      state.reminders = state.reminders.filter(function (r) { return !r.deleted_at; });
      emit("change", { type: "trash" });
      return;
    }
    state.schedules = state.schedules.filter(function (s) { return !s.deleted_at; });
    state.reminders = state.reminders.filter(function (r) { return !r.deleted_at; });
    commit("trash");
  }

  /* ---------- notifications ---------- */
  function notify(kind, title, body, ref) {
    const ns = state.settings.notifications;
    if (!ns.inApp || ns.kinds[kind] === false) return null;
    const n = { id: uid("n"), kind: kind, title: title, body: body, ref: ref || null, read: false, created_at: new Date().toISOString() };
    state.notifications.unshift(n);
    state.notifications = state.notifications.slice(0, 200);
    emit("notify", n);
    return n;
  }
  async function refreshNotifications() {
    if (state.mode !== "server") return;
    try {
      const before = state.notifications.map(function (n) { return String(n.id); });
      state.notifications = await api("/user/notifications");
      state.notifications.filter(function (n) { return before.indexOf(String(n.id)) === -1 && !n.read; })
        .forEach(function (n) { emit("notify", n); });
      emit("change", { type: "notifications" });
    } catch (e) { /* offline */ }
  }
  async function removeNotification(id) {
    if (state.mode === "server") await api("/user/notifications/" + id, { method: "DELETE" });
    state.notifications = state.notifications.filter(function (n) { return String(n.id) !== String(id); });
    commit("notifications");
  }
  async function markNotificationsRead(ids) {
    if (state.mode === "server") await api("/user/notifications/read", { method: "POST", body: { ids: ids || null } });
    state.notifications.forEach(function (n) { if (!ids || ids.map(String).indexOf(String(n.id)) !== -1) n.read = true; });
    commit("notifications");
  }
  async function clearNotifications() {
    if (state.mode === "server") await api("/user/notifications", { method: "DELETE" });
    state.notifications = [];
    commit("notifications");
  }
  function unreadCount() { return state.notifications.filter(function (n) { return !n.read; }).length; }

  /* Runs every minute: deadline warnings for tasks and reminders (server mode: the backend does this and emails). */
  function tick() {
    if (state.mode === "server") { refreshNotifications(); return; }
    purgeTrash();
    const lead = +state.settings.notifications.leadMinutes || 30;
    let changed = false;
    activeSchedules().forEach(function (s) {
      (s.tasks || []).forEach(function (t) {
        if (t.status !== "pending") return;
        const left = minutesUntil(s.date, t.end);
        if (left > 0 && left <= lead && !t.notified_near) {
          t.notified_near = true; changed = true;
          notify("near", "Deadline coming up", "“" + t.label + "” ends at " + fmtTime(t.end) + " (" + left + " min left) and is not finished yet.", { type: "schedule", id: s.id });
        }
        if (left <= 0 && !t.notified_over) {
          t.notified_over = true; t.notified_near = true; changed = true;
          notify("overdue", "Task not finished", "“" + t.label + "” passed its end time (" + fmtTime(t.end) + ", " + s.date + ") without being finished.", { type: "schedule", id: s.id });
        }
      });
    });
    activeReminders().forEach(function (r) {
      if (r.done) return;
      const d = r.deadline.split("T");
      const left = minutesUntil(d[0], d[1]);
      if (left > 0 && left <= lead && !r.notified_near) {
        r.notified_near = true; changed = true;
        notify("reminder", "Reminder due soon", "“" + r.label + "” is due at " + fmtTime(d[1]) + ".", { type: "reminder", id: r.id });
      }
      if (left <= 0 && !r.notified_over) {
        r.notified_over = true; r.notified_near = true; changed = true;
        notify("reminder", "Reminder overdue", "“" + r.label + "” passed its deadline.", { type: "reminder", id: r.id });
      }
    });
    if (changed) commit("tick");
  }

  /* ---------- statistics ---------- */
  function statusBreakdown(from, to) {
    const groups = { finished: [], pending: [], cancelled: [], overtime: [] };
    allTasks({ from: from, to: to }).forEach(function (x) { groups[x.status].push(x); });
    return groups;
  }
  function weekDates(weekStart) { const d = []; for (let i = 0; i < 7; i++) d.push(addDays(weekStart, i)); return d; }
  function busyByWeekday(weekStart) {
    const days = weekDates(weekStart);
    const list = allTasks({ from: days[0], to: days[6] }).filter(function (x) { return x.status !== "cancelled"; });
    return days.map(function (d) {
      const items = list.filter(function (x) { return x.date === d; });
      return { key: d, label: WEEKDAYS[weekday(d)], date: d, minutes: items.reduce(function (a, x) { return a + x.minutes; }, 0), items: items };
    });
  }
  function monthWeeks(year, month) {
    const first = year + "-" + String(month + 1).padStart(2, "0") + "-01";
    const last = isoDate(new Date(Date.UTC(year, month + 1, 0)));
    const weeks = [];
    let start = first, i = 1;
    while (start <= last) {
      let end = addDays(start, 6); if (end > last) end = last;
      weeks.push({ key: "w" + i, label: "Week " + i, from: start, to: end });
      start = addDays(end, 1); i++;
    }
    return weeks;
  }
  function busyByWeekOfMonth(year, month) {
    return monthWeeks(year, month).map(function (w) {
      const items = allTasks({ from: w.from, to: w.to }).filter(function (x) { return x.status !== "cancelled"; });
      return Object.assign(w, { minutes: items.reduce(function (a, x) { return a + x.minutes; }, 0), items: items });
    });
  }
  /* Booked minutes per hour, for a single date or for a whole week (dates array) */
  function busyByHour(dates) {
    const set = Array.isArray(dates) ? dates : [dates];
    const list = allTasks().filter(function (x) { return set.indexOf(x.date) !== -1 && x.status !== "cancelled"; });
    const out = [];
    for (let h = DAY_START / 60; h < DAY_END / 60; h++) {
      const hs = h * 60, he = hs + 60;
      const items = list.filter(function (x) { return overlaps(hs, he, toMin(x.task.start), toMin(x.task.end)); });
      const minutes = items.reduce(function (a, x) { return a + Math.min(he, toMin(x.task.end)) - Math.max(hs, toMin(x.task.start)); }, 0);
      out.push({ key: "h" + h, label: fmtTime(toTime(hs)) + " – " + fmtTime(toTime(he)), minutes: minutes, items: items });
    }
    return out;
  }
  function topDays(from, to, limit) {
    const map = {};
    allTasks({ from: from, to: to }).forEach(function (x) {
      if (x.status === "cancelled") return;
      (map[x.date] = map[x.date] || { date: x.date, count: 0, minutes: 0 }).count++;
      map[x.date].minutes += x.minutes;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count || b.minutes - a.minutes; }).slice(0, limit || 5);
  }
  function topWeeks(year, month, limit) {
    return busyByWeekOfMonth(year, month)
      .map(function (w) { return { label: w.label, from: w.from, to: w.to, count: w.items.length, minutes: w.minutes }; })
      .filter(function (w) { return w.count > 0; })
      .sort(function (a, b) { return b.count - a.count || b.minutes - a.minutes; }).slice(0, limit || 5);
  }

  /* ---------- schedule-moving recommendations ---------- */
  function dayLoad(date) {
    return allTasks({ from: date, to: date }).filter(function (x) { return x.status !== "cancelled"; }).reduce(function (a, x) { return a + x.minutes; }, 0);
  }
  function recommendations() {
    const limit = (+state.settings.busyThresholdHours || 8) * 60;
    const today = now().date;
    const dismissed = state.settings.dismissedRecs || [];
    const recs = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const load = dayLoad(date);
      if (load <= limit) continue;
      const movable = allTasks({ from: date, to: date })
        .filter(function (x) { return x.status === "pending" && x.task.urgency !== "urgent" && minutesUntil(date, x.task.start) > 0; })
        .sort(function (a, b) { return URGENCY.indexOf(a.task.urgency) - URGENCY.indexOf(b.task.urgency) || toMin(b.task.start) - toMin(a.task.start); });
      if (!movable.length) continue;
      const pick = movable[0];
      // lightest upcoming day (next 7 days) where the task fits
      let best = null;
      for (let j = 1; j <= 7; j++) {
        const cand = addDays(date, j);
        const candLoad = dayLoad(cand);
        if (candLoad + pick.minutes > limit) continue;
        const slot = findConflicts(cand, pick.task.start, pick.task.end).length ? findFreeSlot(cand, pick.minutes, toMin(pick.task.start)) : { start: pick.task.start, end: pick.task.end };
        if (!slot) continue;
        if (!best || candLoad < best.load) best = { date: cand, load: candLoad, slot: slot };
      }
      if (!best) continue;
      const id = pick.task.id + ">" + best.date + "@" + best.slot.start;
      if (dismissed.indexOf(id) !== -1) continue;
      recs.push({
        id: id, schedule: pick.schedule, task: pick.task, fromDate: date, toDate: best.date,
        start: best.slot.start, end: best.slot.end,
        fromLoad: Math.round(load / limit * 100), toLoad: Math.round((best.load + pick.minutes) / limit * 100)
      });
    }
    return recs;
  }
  async function dismissRecommendation(id) {
    const list = (state.settings.dismissedRecs || []).concat(id).slice(-100);
    await saveSettings({ dismissedRecs: list });
  }

  /* ---------- profile & settings ---------- */
  async function saveSettings(patch) {
    state.settings = merge(state.settings, patch);
    if (Array.isArray(patch.dismissedRecs)) state.settings.dismissedRecs = patch.dismissedRecs;
    if (state.mode === "server") await api("/user/settings", { method: "PUT", body: state.settings });
    commit("settings");
  }
  async function saveProfile(patch) {
    if (state.mode === "server") state.profile = await api("/user/profile", { method: "PUT", body: patch });
    else state.profile = merge(state.profile, patch);
    commit("profile");
  }
  async function changePassword(current, next) {
    if (state.mode !== "server") throw new Error("Log in to change your password.");
    return api("/user/password", { method: "POST", body: { current_password: current, new_password: next } });
  }
  async function logout() {
    if (state.apiOnline) { try { await api("/auth/logout", { method: "POST" }); } catch (e) { /* ignore */ } }
  }
  async function sendSupport(body) {
    if (!state.apiOnline) throw new Error("The server is not reachable, so the message could not be sent.");
    return api("/user/support", { method: "POST", body: body });
  }
  async function sendTestEmail() {
    if (state.mode !== "server") throw new Error("Log in to receive emails.");
    return api("/user/test-email", { method: "POST" });
  }
  async function deleteAccount() {
    if (state.mode === "server") await api("/user/account", { method: "DELETE" });
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  }
  function exportAll() {
    return { exported_at: new Date().toISOString(), profile: state.profile, settings: state.settings, schedules: state.schedules, reminders: state.reminders, notifications: state.notifications };
  }

  window.SchedulerStore = {
    state: state, init: init, on: on, api: api,
    constants: { URGENCY: URGENCY, STATUSES: STATUSES, WEEKDAYS: WEEKDAYS, DAY_START: DAY_START, DAY_END: DAY_END, TRASH_DAYS: TRASH_DAYS },
    util: { toMin: toMin, toTime: toTime, fmtTime: fmtTime, addDays: addDays, dayDiff: dayDiff, weekday: weekday, now: now, timezone: timezone, minutesUntil: minutesUntil, weekStartOf: weekStartOf, weekDates: weekDates, uid: uid, norm: norm, overlaps: overlaps },
    getSchedule: getSchedule, getReminder: getReminder, activeSchedules: activeSchedules, activeReminders: activeReminders,
    scheduleDeadline: scheduleDeadline, taskStatus: taskStatus, allTasks: allTasks,
    findConflicts: findConflicts, isDuplicateTask: isDuplicateTask, findDuplicateSchedule: findDuplicateSchedule, findFreeSlot: findFreeSlot,
    createSchedule: createSchedule, updateSchedule: updateSchedule, patchSchedule: patchSchedule,
    trashSchedule: trashSchedule, restoreSchedule: restoreSchedule, deleteSchedule: deleteSchedule, replacementsFor: replacementsFor,
    setTaskStatus: setTaskStatus, moveTask: moveTask,
    saveReminder: saveReminder, setReminderDone: setReminderDone, trashReminder: trashReminder, restoreReminder: restoreReminder, deleteReminder: deleteReminder,
    trashItems: trashItems, daysLeft: daysLeft, emptyTrash: emptyTrash,
    notify: notify, removeNotification: removeNotification, markNotificationsRead: markNotificationsRead, clearNotifications: clearNotifications, unreadCount: unreadCount, refreshNotifications: refreshNotifications,
    statusBreakdown: statusBreakdown, busyByWeekday: busyByWeekday, busyByWeekOfMonth: busyByWeekOfMonth, busyByHour: busyByHour, monthWeeks: monthWeeks,
    topDays: topDays, topWeeks: topWeeks, dayLoad: dayLoad,
    recommendations: recommendations, dismissRecommendation: dismissRecommendation,
    saveSettings: saveSettings, saveProfile: saveProfile, changePassword: changePassword, logout: logout,
    sendSupport: sendSupport, sendTestEmail: sendTestEmail, deleteAccount: deleteAccount, exportAll: exportAll
  };
})();
