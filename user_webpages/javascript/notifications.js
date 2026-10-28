/* =========================================================
   Notifications page — filter, read, remove notifications.
   Email delivery and which kinds you receive are set in
   Settings › Notifications.
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };
  const KIND = {
    near: { label: "Due soon", icon: "clock", cls: "yellow" },
    overdue: { label: "Overdue", icon: "warning", cls: "red" },
    early: { label: "Finished early", icon: "check", cls: "mint" },
    reminder: { label: "Reminder", icon: "alarm", cls: "sky" },
    recommendation: { label: "Suggestion", icon: "move", cls: "amber" },
    system: { label: "Scheduler", icon: "bell", cls: "sand" }
  };
  let filter = "all";

  A.ready(function () {
    $("#notif-settings").href = A.url("settings") + "#notifications";
    document.querySelectorAll("[data-kind]").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.dataset.kind; render(); });
    });
    $("#mark-read").addEventListener("click", function () { S.markNotificationsRead(); });
    $("#clear-all").addEventListener("click", async function () {
      if (!S.state.notifications.length) return;
      const ok = await A.confirm({ message: "Remove all notifications?", icon: "trash", danger: true, confirmText: "Clear all" });
      if (ok) { await S.clearNotifications(); A.toast("Notifications cleared."); }
    });
    $("#notif-list").addEventListener("click", async function (e) {
      const rm = e.target.closest("[data-remove]");
      if (rm) {
        const id = rm.dataset.remove;
        const li = rm.closest("li");
        li.classList.add("is-leaving");
        setTimeout(function () { S.removeNotification(id); }, 220);
        return;
      }
      const go = e.target.closest("[data-go]");
      if (go) {
        const n = S.state.notifications.find(function (x) { return String(x.id) === go.dataset.go; });
        if (!n) return;
        if (!n.read) await S.markNotificationsRead([n.id]);
        if (n.ref && n.ref.type === "schedule") A.openSchedule(n.ref.id);
        if (n.ref && n.ref.type === "reminder") location.href = A.url("reminders", { open: n.ref.id });
      }
    });
    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
  });

  function render() {
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.kind === filter)); });
    const ns = S.state.settings.notifications;
    const list = S.state.notifications.filter(function (n) {
      if (filter === "all") return true;
      if (filter === "unread") return !n.read;
      return n.kind === filter;
    });
    const off = !ns.inApp ? '<li class="notice notice--warn">' + A.icon("warning") + "<span>In-app notifications are turned off. Turn them on in Settings › Notifications.</span></li>" : "";
    if (!list.length) {
      $("#notif-list").innerHTML = off + '<li class="empty"><strong>You\'re all caught up.</strong>Deadline warnings, finished tasks and suggestions will show up here.</li>';
      return;
    }
    $("#notif-list").innerHTML = off + list.map(function (n) {
      const k = KIND[n.kind] || KIND.system;
      return '<li class="notif' + (n.read ? "" : " is-unread") + '">' +
        '<span class="notif__icon notif__icon--' + k.cls + '" aria-hidden="true">' + A.icon(k.icon) + "</span>" +
        '<button type="button" class="notif__body" data-go="' + A.esc(n.id) + '"' + (n.ref ? "" : " disabled") + ">" +
          '<span class="notif__top"><strong>' + A.esc(n.title) + "</strong>" + (n.read ? "" : '<span class="notif__dot">New</span>') + "</span>" +
          "<span>" + A.esc(n.body) + "</span>" +
          '<span class="notif__meta">' + k.label + " · " + A.timeAgo(n.created_at) + (n.emailed ? " · Emailed" : "") + "</span>" +
        "</button>" +
        '<button type="button" class="icon-btn icon-btn--sm" data-remove="' + A.esc(n.id) + '" aria-label="Remove notification: ' + A.esc(n.title) + '">' + A.icon("x") + "</button>" +
        "</li>";
    }).join("");
  }
})();
