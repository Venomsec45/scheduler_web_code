/* =========================================================
   Trash page — recover or permanently delete removed
   schedules and reminders. Items older than 5 days are
   deleted automatically (by the store and by the server).
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };

  A.ready(function () {
    $("#trash-list").addEventListener("click", onAction);
    $("#empty-trash").addEventListener("click", async function () {
      const n = S.trashItems().length;
      if (!n) return;
      const ok = await A.confirm({ message: "Permanently delete all " + n + " item" + (n === 1 ? "" : "s") + " in the trash? This cannot be undone.", icon: "trash", danger: true, confirmText: "Delete forever", confirmIcon: "trash" });
      if (!ok) return;
      await S.emptyTrash();
      A.toast("Trash emptied.");
    });
    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
  });

  async function onAction(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const type = b.dataset.type, id = b.dataset.id;
    const item = type === "schedule" ? S.getSchedule(id) : S.getReminder(id);
    try {
      if (b.dataset.act === "restore") {
        if (type === "schedule") {
          const reps = S.replacementsFor(item);
          if (reps.length) {
            const ok = await A.confirm({
              message: "Recovering “" + item.label + "” will overwrite the schedule that replaced it.",
              detail: "<ul class=\"conflict-list\">" + reps.map(function (r) { return "<li><strong>" + A.esc(r.label) + "</strong> · " + A.fmtDate(r.date, { year: undefined }) + "</li>"; }).join("") + "</ul><p class=\"muted\">The overwritten schedule moves to the trash, so you can still get it back.</p>",
              icon: "restore", confirmText: "Recover and overwrite", confirmIcon: "restore"
            });
            if (!ok) return;
          }
          const over = await S.restoreSchedule(id);
          A.toast("“" + item.label + "” recovered" + (over.length ? " and " + over.length + " schedule" + (over.length > 1 ? "s" : "") + " overwritten." : "."), { type: "success", action: { label: "View", fn: function () { location.href = A.url("schedules", { open: id }); } } });
        } else {
          await S.restoreReminder(id);
          A.toast("Reminder recovered.", { type: "success" });
        }
      }
      if (b.dataset.act === "delete") {
        const ok = await A.confirm({ message: "Delete “" + item.label + "” forever? This cannot be undone.", icon: "trash", danger: true, confirmText: "Delete forever", confirmIcon: "trash" });
        if (!ok) return;
        if (type === "schedule") await S.deleteSchedule(id); else await S.deleteReminder(id);
        A.toast("Deleted permanently.");
      }
    } catch (err) { A.toast(err.message, { type: "error" }); }
  }

  function render() {
    const items = S.trashItems();
    $("#empty-trash").disabled = !items.length;
    if (!items.length) {
      $("#trash-list").innerHTML = '<li class="empty"><strong>The trash is empty.</strong>Schedules and reminders you remove will appear here for 5 days.</li>';
      return;
    }
    $("#trash-list").innerHTML = items.map(function (x) {
      const it = x.item;
      const days = S.daysLeft(x.deleted_at);
      const leftTxt = days < 1 ? "Deleted automatically in " + Math.max(1, Math.round(days * 24)) + " h" : "Deleted automatically in " + Math.ceil(days) + " day" + (Math.ceil(days) === 1 ? "" : "s");
      const sub = x.type === "schedule"
        ? A.fmtDate(it.date, { year: undefined }) + " · " + it.tasks.length + " task" + (it.tasks.length === 1 ? "" : "s")
        : "Due " + it.deadline.replace("T", " ");
      const ids = ' data-type="' + x.type + '" data-id="' + A.esc(it.id) + '"';
      return '<li class="trash-item">' +
        '<span class="trash-item__swatch" style="background:' + A.esc(x.type === "schedule" ? it.color : "var(--sky)") + '" aria-hidden="true">' + A.icon(x.type === "schedule" ? "calendar" : "alarm") + "</span>" +
        '<div class="trash-item__main"><strong>' + A.esc(it.label) + '</strong><span class="muted">' + (x.type === "schedule" ? "Schedule" : "Reminder") + " · " + A.esc(sub) + "</span>" +
          '<span class="trash-item__left' + (days < 1 ? " is-soon" : "") + '">' + A.icon("clock") + "Removed " + A.timeAgo(x.deleted_at) + " · " + leftTxt + "</span></div>" +
        '<div class="trash-item__actions"><button type="button" class="btn btn--sm btn--mint" data-act="restore"' + ids + ">" + A.icon("restore") + "Recover</button>" +
          '<button type="button" class="btn btn--sm btn--danger" data-act="delete"' + ids + ">" + A.icon("trash") + "Delete forever</button></div>" +
        "</li>";
    }).join("");
  }
})();
