/* =========================================================
   Schedules page
   * Month calendar with every schedule on its day
   * Day panel listing that day's schedules
   * List view (upcoming / past / all) with a filter
   * Pinned schedules on top
   Clicking a schedule opens the detail view (App.openSchedule).
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, U = S.util, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };
  let y, m, selected, view = "calendar";

  A.ready(function () {
    const n = U.now();
    y = +n.date.slice(0, 4); m = +n.date.slice(5, 7) - 1; selected = n.date;
    const q = new URLSearchParams(location.search);
    if (q.get("open")) { const s = S.getSchedule(q.get("open")); if (s) { y = +s.date.slice(0, 4); m = +s.date.slice(5, 7) - 1; selected = s.date; } }
    try { view = localStorage.getItem("scheduler-sched-view") || (window.innerWidth < 640 ? "list" : "calendar"); } catch (e) { /* ignore */ }

    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { view = b.dataset.view; try { localStorage.setItem("scheduler-sched-view", view); } catch (e) { /* ignore */ } render(); });
    });
    document.querySelectorAll("[data-month]").forEach(function (b) {
      b.addEventListener("click", function () { m += +b.dataset.month; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } render(); });
    });
    $("#month-today").addEventListener("click", function () { const d = U.now().date; y = +d.slice(0, 4); m = +d.slice(5, 7) - 1; selected = d; render(); });
    $("#list-filter").addEventListener("input", renderList);
    $("#list-range").addEventListener("change", renderList);
    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
  });

  function card(s, compact) {
    const done = s.tasks.filter(function (t) { return t.status === "finished"; }).length;
    const over = s.tasks.filter(function (t) { return S.taskStatus(t, s) === "overtime"; }).length;
    const dl = S.scheduleDeadline(s);
    return '<button type="button" class="sched-card sched-card--btn ' + A.bgClass(s.background) + '" style="' + A.bgStyle(s) + '" data-open="' + A.esc(s.id) + '">' +
      '<span class="sched-card__date">' + A.fmtDate(s.date, { year: undefined }) + (s.pinned ? " · Pinned" : "") + "</span>" +
      '<strong class="sched-card__label">' + A.esc(s.label) + "</strong>" +
      '<span class="sched-card__meta">' + done + "/" + s.tasks.length + " done" + (over ? " · " + over + " overtime" : "") + (dl && !compact ? " · until " + U.fmtTime(dl.time) : "") + "</span>" +
      "</button>";
  }
  function wireOpen(root) {
    root.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { A.openSchedule(b.dataset.open); }); });
  }

  function render() {
    document.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === view)); });
    $("#calendar-view").hidden = view !== "calendar";
    $("#list-view").hidden = view !== "list";
    renderPinned();
    if (view === "calendar") renderMonth(); else renderList();
  }

  function renderPinned() {
    const pins = S.activeSchedules().filter(function (s) { return s.pinned; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    $("#pinned").hidden = !pins.length;
    $("#pinned-list").innerHTML = pins.map(function (s) { return card(s, true); }).join("");
    wireOpen($("#pinned-list"));
  }

  function renderMonth() {
    $("#month-title").textContent = new Date(Date.UTC(y, m, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    const ws = S.state.settings.weekStart;
    const first = y + "-" + String(m + 1).padStart(2, "0") + "-01";
    const start = U.addDays(first, -((U.weekday(first) - ws + 7) % 7));
    const today = U.now().date;
    const byDate = {};
    S.activeSchedules().forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });
    if (selected.slice(0, 7) !== first.slice(0, 7)) selected = first.slice(0, 7) === today.slice(0, 7) ? today : first;

    let html = '<div class="month__row month__row--head" role="row">';
    for (let i = 0; i < 7; i++) html += '<div class="month__dow" role="columnheader">' + S.constants.WEEKDAYS[(ws + i) % 7].slice(0, 3) + "</div>";
    html += "</div>";
    for (let w = 0; w < 6; w++) {
      html += '<div class="month__row" role="row">';
      for (let i = 0; i < 7; i++) {
        const d = U.addDays(start, w * 7 + i);
        const list = (byDate[d] || []).sort(function (a, b) { return (b.pinned - a.pinned) || (a.label < b.label ? -1 : 1); });
        const other = d.slice(0, 7) !== first.slice(0, 7);
        html += '<div class="month__cell' + (other ? " is-other" : "") + (d === today ? " is-today" : "") + (d === selected ? " is-selected" : "") + '" role="gridcell">' +
          '<button type="button" class="month__day" data-day="' + d + '" aria-pressed="' + (d === selected) + '" aria-label="' + A.fmtDate(d, { weekday: "long", month: "long" }) + ", " + list.length + " schedule" + (list.length === 1 ? "" : "s") + '">' + (+d.slice(8)) + "</button>" +
          '<div class="month__chips">' + list.slice(0, 3).map(function (s) {
            return '<button type="button" class="month__chip ' + A.bgClass(s.background) + '" style="' + A.bgStyle(s) + '" data-open="' + A.esc(s.id) + '" title="' + A.esc(s.label) + '">' + A.esc(s.label) + "</button>";
          }).join("") + (list.length > 3 ? '<button type="button" class="month__more" data-day="' + d + '">+' + (list.length - 3) + " more</button>" : "") + "</div>" +
          '<button type="button" class="month__add" data-create="schedule" data-date="' + d + '" aria-label="Create a schedule on ' + A.fmtDate(d, { weekday: "long", month: "long" }) + '">+</button>' +
          (list.length ? '<span class="month__dots" aria-hidden="true">' + list.slice(0, 4).map(function (s) { return '<i style="background:' + A.esc(s.color) + '"></i>'; }).join("") + "</span>" : "") +
          "</div>";
      }
      html += "</div>";
    }
    const dayList = byDate[selected] || [];
    html += '<section class="dayp" aria-live="polite"><div class="dayp__head"><h3>' + A.fmtDate(selected, { weekday: "long", month: "long" }) + "</h3>" +
      '<button type="button" class="btn btn--sm btn--yellow" data-create="schedule" data-date="' + selected + '">' + A.icon("plus") + "Add schedule</button></div>" +
      (dayList.length ? '<div class="dayp__list">' + dayList.map(function (s) { return card(s); }).join("") + "</div>" : '<p class="empty">No schedules on this day.</p>') + "</section>";

    const grid = $("#month-grid");
    grid.innerHTML = html;
    wireOpen(grid);
    grid.querySelectorAll("[data-day]").forEach(function (b) {
      b.addEventListener("click", function () {
        selected = b.dataset.day;
        if (selected.slice(0, 7) !== first.slice(0, 7)) { y = +selected.slice(0, 4); m = +selected.slice(5, 7) - 1; }
        renderMonth();
        const again = grid.querySelector('.month__day[data-day="' + selected + '"]');
        if (again) again.focus();
      });
    });
  }

  function renderList() {
    if (view !== "list") return;
    const q = U.norm($("#list-filter").value);
    const range = $("#list-range").value;
    const today = U.now().date;
    const list = S.activeSchedules().filter(function (s) {
      if (range === "upcoming" && s.date < today) return false;
      if (range === "past" && s.date >= today) return false;
      return !q || U.norm(s.label + " " + s.description + " " + s.tasks.map(function (t) { return t.label; }).join(" ")).indexOf(q) !== -1;
    }).sort(function (a, b) { return range === "past" ? (a.date < b.date ? 1 : -1) : (a.date < b.date ? -1 : 1); });
    const groups = {};
    list.forEach(function (s) { (groups[s.date] = groups[s.date] || []).push(s); });
    const keys = Object.keys(groups);
    $("#list-groups").innerHTML = keys.length ? keys.map(function (d) {
      return '<section class="lgroup"><h2 class="lgroup__date">' + A.fmtDate(d, { weekday: "long", month: "long" }) + (d === today ? ' <span class="badge badge--pending">Today</span>' : "") + '</h2><div class="lgroup__cards">' + groups[d].map(function (s) { return card(s); }).join("") + "</div></section>";
    }).join("") : '<div class="empty"><strong>No schedules found.</strong>Use the Create button to plan your first schedule.<button type="button" class="btn btn--yellow" data-create="schedule">New schedule</button></div>';
    wireOpen($("#list-groups"));
  }
})();
