/* =========================================================
   Tasks page — every task across schedules, filterable by
   status, with quick done / cancel / reopen actions.
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, U = S.util, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };
  let filter = "all";

  A.ready(function () {
    const q = new URLSearchParams(location.search).get("status");
    if (q && ["pending", "overtime", "finished", "cancelled"].indexOf(q) !== -1) filter = q;
    document.querySelectorAll("[data-status]").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.dataset.status; render(); });
    });
    $("#task-search").addEventListener("input", render);
    $("#task-sort").addEventListener("change", render);
    $("#task-list").addEventListener("click", onAction);
    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
  });

  async function onAction(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const sid = b.dataset.sid, tid = b.dataset.tid;
    if (b.dataset.act === "open") { A.openSchedule(sid); return; }
    const t = S.getSchedule(sid).tasks.find(function (x) { return String(x.id) === tid; });
    const next = b.dataset.act === "check" ? (t.status === "finished" ? "pending" : "finished") : b.dataset.act === "cancel" ? "cancelled" : "pending";
    try {
      await S.setTaskStatus(sid, tid, next);
      A.toast(next === "finished" ? "“" + t.label + "” marked as done." : next === "cancelled" ? "“" + t.label + "” cancelled." : "“" + t.label + "” reopened.", { type: next === "finished" ? "success" : undefined });
    } catch (err) { A.toast(err.message, { type: "error" }); }
  }

  function render() {
    const all = S.allTasks();
    const counts = { all: all.length, pending: 0, overtime: 0, finished: 0, cancelled: 0 };
    all.forEach(function (x) { counts[x.status]++; });
    document.querySelectorAll("[data-status]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.status === filter));
      b.querySelector(".count").textContent = counts[b.dataset.status];
    });

    const q = U.norm($("#task-search").value);
    let list = all.filter(function (x) {
      return (filter === "all" || x.status === filter) && (!q || U.norm(x.task.label + " " + x.task.description + " " + x.schedule.label).indexOf(q) !== -1);
    });
    const byUrgency = $("#task-sort").value === "urgency";
    if (byUrgency) list = list.slice().sort(function (a, b) { return S.constants.URGENCY.indexOf(b.task.urgency) - S.constants.URGENCY.indexOf(a.task.urgency) || (a.date < b.date ? -1 : 1); });

    const box = $("#task-list");
    if (!list.length) {
      box.innerHTML = '<div class="empty"><strong>' + (all.length ? "No tasks match this filter." : "No tasks yet.") + "</strong>" + (all.length ? "Try another status or search." : "Tasks you add to a schedule's timetable appear here.") +
        (all.length ? "" : '<button type="button" class="btn btn--yellow" data-create="schedule">Create a schedule</button>') + "</div>";
      return;
    }
    const groups = [];
    list.forEach(function (x) {
      const key = byUrgency ? A.URG_LABEL[x.task.urgency] : x.date;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) { g = { key: key, items: [] }; groups.push(g); }
      g.items.push(x);
    });
    const today = U.now().date;
    box.innerHTML = groups.map(function (g) {
      const title = byUrgency ? g.key + " urgency" : A.fmtDate(g.key, { weekday: "long", month: "long" }) + (g.key === today ? " · Today" : "");
      return '<section class="tgroup"><h2 class="tgroup__title">' + A.esc(title) + '</h2><ul class="tlist">' + g.items.map(row).join("") + "</ul></section>";
    }).join("");
  }

  function row(x) {
    const t = x.task, s = x.schedule;
    const ids = ' data-sid="' + A.esc(s.id) + '" data-tid="' + A.esc(t.id) + '"';
    return '<li class="trow trow--' + x.status + '">' +
      '<button type="button" class="icon-btn icon-btn--check" data-act="check"' + ids + ' aria-pressed="' + (t.status === "finished") + '" aria-label="' + (t.status === "finished" ? "Mark as not done: " : "Mark as done: ") + A.esc(t.label) + '">' + A.icon("check") + "</button>" +
      '<div class="trow__time">' + A.fmtRange(t) + '<small>' + A.fmtDate(x.date, { weekday: "short", year: undefined }) + "</small></div>" +
      '<div class="trow__main"><strong>' + A.esc(t.label) + "</strong>" + (t.description ? "<p>" + A.esc(t.description) + "</p>" : "") +
        '<button type="button" class="trow__sched" data-act="open"' + ids + '><i style="background:' + A.esc(s.color) + '"></i>' + A.esc(s.label) + "</button></div>" +
      '<div class="trow__badges"><span class="badge badge--' + x.status + '">' + A.statusLabel(x.status) + '</span><span class="badge badge--' + t.urgency + '">' + A.URG_LABEL[t.urgency] + "</span></div>" +
      '<div class="trow__actions">' + (t.status === "pending" ? '<button type="button" class="btn btn--sm btn--ghost" data-act="cancel"' + ids + ">" + A.icon("ban") + "Cancel</button>" :
        t.status === "cancelled" ? '<button type="button" class="btn btn--sm btn--ghost" data-act="reopen"' + ids + ">" + A.icon("restore") + "Reopen</button>" : "") + "</div>" +
      "</li>";
  }
})();
