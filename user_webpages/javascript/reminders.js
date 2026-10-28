/* =========================================================
   Reminders page — upcoming, overdue and done reminders.
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, U = S.util, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };

  A.ready(function () {
    $("#reminders").addEventListener("click", onAction);
    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
    const open = new URLSearchParams(location.search).get("open");
    if (open && S.getReminder(open)) A.openReminderEditor(open);
    setInterval(render, 60 * 1000);
  });

  function left(r) { return U.minutesUntil(r.deadline.slice(0, 10), r.deadline.slice(11, 16)); }
  function dueText(r) {
    const m = left(r);
    if (r.done) return "Done";
    if (m < 0) return "Overdue by " + A.fmtDuration(Math.min(-m, 60 * 24 * 99));
    if (m < 60 * 24) return "Due in " + A.fmtDuration(m);
    return "Due in " + Math.round(m / 1440) + " day" + (Math.round(m / 1440) === 1 ? "" : "s");
  }

  async function onAction(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const r = S.getReminder(b.dataset.id);
    if (b.dataset.act === "done") { const was = r.done; await S.setReminderDone(r.id, !was); A.toast(!was ? "Reminder marked as done." : "Reminder reopened.", { type: !was ? "success" : undefined }); }
    if (b.dataset.act === "edit") A.openReminderEditor(r.id);
    if (b.dataset.act === "trash") {
      const ok = await A.confirm({ message: "Are you sure you want to remove this? You can still recover this.", detail: "“" + A.esc(r.label) + "” will stay in the trash for 5 days.", icon: "trash", danger: true, confirmText: "Remove", confirmIcon: "trash" });
      if (!ok) return;
      await S.trashReminder(r.id);
      A.toast("Reminder has been removed.", { duration: 6000, action: { label: "Undo", fn: function () { S.restoreReminder(r.id); } } });
    }
  }

  function render() {
    const all = S.activeReminders().slice().sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
    const cols = [
      { key: "upcoming", title: "Upcoming", items: all.filter(function (r) { return !r.done && left(r) >= 0; }) },
      { key: "overdue", title: "Overdue", items: all.filter(function (r) { return !r.done && left(r) < 0; }) },
      { key: "done", title: "Done", items: all.filter(function (r) { return r.done; }).reverse() }
    ];
    if (!all.length) {
      $("#reminders").innerHTML = '<div class="empty rem-empty"><strong>No reminders yet.</strong>Create one for deadlines that are not part of a schedule.<button type="button" class="btn btn--yellow" data-create="reminder">New reminder</button></div>';
      return;
    }
    $("#reminders").innerHTML = cols.map(function (c) {
      return '<section class="rem-col rem-col--' + c.key + '" aria-labelledby="rc-' + c.key + '"><h2 id="rc-' + c.key + '">' + c.title + ' <span class="rem-count">' + c.items.length + "</span></h2>" +
        (c.items.length ? '<ul class="rem-list">' + c.items.map(item).join("") + "</ul>" : '<p class="empty">Nothing here.</p>') + "</section>";
    }).join("");
  }

  function item(r) {
    const d = r.deadline.split("T");
    return '<li class="rem' + (r.done ? " is-done" : left(r) < 0 ? " is-overdue" : "") + '">' +
      '<button type="button" class="icon-btn icon-btn--check" data-act="done" data-id="' + A.esc(r.id) + '" aria-pressed="' + r.done + '" aria-label="' + (r.done ? "Mark as not done: " : "Mark as done: ") + A.esc(r.label) + '">' + A.icon("check") + "</button>" +
      '<div class="rem__main"><strong>' + A.esc(r.label) + "</strong>" + (r.description ? "<p>" + A.esc(r.description) + "</p>" : "") +
      '<span class="rem__due">' + A.icon("clock") + A.fmtDate(d[0], { year: undefined }) + ", " + U.fmtTime(d[1]) + " · " + dueText(r) + "</span></div>" +
      '<div class="rem__actions"><button type="button" class="icon-btn icon-btn--sm" data-act="edit" data-id="' + A.esc(r.id) + '" aria-label="Edit ' + A.esc(r.label) + '">' + A.icon("edit") + "</button>" +
      '<button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-act="trash" data-id="' + A.esc(r.id) + '" aria-label="Move ' + A.esc(r.label) + ' to trash">' + A.icon("trash") + "</button></div></li>";
  }
})();
