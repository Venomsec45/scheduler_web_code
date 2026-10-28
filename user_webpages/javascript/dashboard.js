/* =========================================================
   Dashboard page
   * Greeting based on the user's time zone
   * Pie charts: tasks by status, busiest days of the week,
     busiest weeks of the month, busiest hours of a day/week
   * Three-dot menu to choose which charts are shown
   * Click a slice to see the tasks behind it
   * Schedule-moving recommendations
   * Top days / top weeks with the most tasks
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, U = S.util, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };

  const BRAND = ["#FF5959", "#FF8159", "#FFAE59", "#FFC759", "#FFDE59", "#134EF2", "#8BE3BF", "#A9C6FF"];
  const SAFE = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#999999"];
  const GRAY = ["#1F1F1F", "#4A4A4A", "#6E6E6E", "#929292", "#B5B5B5", "#D6D6D6", "#F2F2F2", "#FFFFFF"];

  let weekStart, year, month, hoursDay = "week";
  let drill = null;
  const charts = {};

  A.ready(init);

  function palette(i) {
    const cb = S.state.settings.a11y.colorblind;
    const list = cb === "achromatopsia" ? GRAY : (cb && cb !== "none" ? SAFE : BRAND);
    return list[i % list.length];
  }
  function minutesFmt(v) { return A.fmtDuration(v); }

  function init() {
    const n = U.now();
    weekStart = U.weekStartOf(n.date);
    year = +n.date.slice(0, 4);
    month = +n.date.slice(5, 7) - 1;

    charts.status = new PieChart($("#chart-status"), { title: "Tasks by status", centerLabel: "tasks", emptyHint: "Create a schedule to start", onSelect: function (k) { openDrill("status", k); } });
    charts.days = new PieChart($("#chart-days"), { title: "Busiest days of the week", centerLabel: "booked", format: minutesFmt, emptyHint: "Nothing booked this week", onSelect: function (k) { openDrill("days", k); } });
    charts.weeks = new PieChart($("#chart-weeks"), { title: "Busiest weeks of the month", centerLabel: "booked", format: minutesFmt, emptyHint: "Nothing booked this month", onSelect: function (k) { openDrill("weeks", k); } });
    charts.hours = new PieChart($("#chart-hours"), { title: "Busiest hours", centerLabel: "booked", format: minutesFmt, emptyHint: "Nothing booked here", onSelect: function (k) { openDrill("hours", k); } });

    document.querySelectorAll("[data-week]").forEach(function (b) {
      b.addEventListener("click", function () { weekStart = U.addDays(weekStart, 7 * +b.dataset.week); syncMonthToWeek(); hoursDay = "week"; closeDrill(); render(); });
    });
    document.querySelectorAll("[data-month]").forEach(function (b) {
      b.addEventListener("click", function () {
        month += +b.dataset.month;
        if (month < 0) { month = 11; year--; }
        if (month > 11) { month = 0; year++; }
        closeDrill(); render();
      });
    });
    $("#period-today").addEventListener("click", function () {
      const d = U.now().date;
      weekStart = U.weekStartOf(d); year = +d.slice(0, 4); month = +d.slice(5, 7) - 1; hoursDay = "week";
      closeDrill(); render();
    });
    $("#status-range").addEventListener("change", function () { closeDrill(); render(); });
    $("#hours-day").addEventListener("change", function (e) { hoursDay = e.target.value; closeDrill(); render(); });

    const dots = $("#charts-menu");
    dots.addEventListener("click", function () {
      const c = S.state.settings.dashboard.charts;
      const opt = function (key, label) {
        return { label: label, icon: "dashboard", checked: !!c[key], keepOpen: true, onClick: function (on) {
          const next = Object.assign({}, S.state.settings.dashboard.charts); next[key] = on;
          S.saveSettings({ dashboard: { charts: next } });
        } };
      };
      A.menu(dots, [
        { header: "<strong>Charts to show</strong><small>Pick the charts you want on your dashboard.</small>" },
        opt("status", "Tasks by status"),
        opt("days", "Busiest days of the week"),
        opt("weeks", "Busiest weeks of the month"),
        opt("hours", "Busiest hours")
      ], { label: "Charts to show" });
    });

    S.on("change", function (e) { if (e.type !== "init") render(); });
    render();
    setInterval(greet, 60 * 1000);
  }

  function syncMonthToWeek() {
    const mid = U.addDays(weekStart, 3);
    year = +mid.slice(0, 4); month = +mid.slice(5, 7) - 1;
  }
  function monthRange() {
    const from = year + "-" + String(month + 1).padStart(2, "0") + "-01";
    const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return { from: from, to: to };
  }

  /* ---------- greeting ---------- */
  function greet() {
    const g = A.greeting();
    $("#greeting").textContent = g.text + ".";
    $("#greet-date").textContent = A.fmtDate(g.date, { weekday: "long", month: "long" }) + " · " + g.tz.replace(/_/g, " ");
    const today = S.allTasks({ from: g.date, to: g.date }).filter(function (x) { return x.status === "pending"; }).length;
    $("#greet-sub").textContent = today ? "You have " + today + " task" + (today > 1 ? "s" : "") + " left today." : "Nothing left on today's list. Plan something new or take a breather.";
  }

  /* ---------- render ---------- */
  function render() {
    greet();
    renderTiles();
    renderRecs();
    renderCharts();
    renderTop();
    if (drill) openDrill(drill.chart, drill.key, true);
  }

  function renderTiles() {
    const n = U.now();
    const today = S.allTasks({ from: n.date, to: n.date });
    const week = S.allTasks({ from: weekStart, to: U.addDays(weekStart, 6) }).filter(function (x) { return x.status !== "cancelled"; });
    const weekDone = week.filter(function (x) { return x.status === "finished"; }).length;
    const overtime = S.allTasks().filter(function (x) { return x.status === "overtime"; }).length;
    const nextRem = S.activeReminders().filter(function (r) { return !r.done && U.minutesUntil(r.deadline.slice(0, 10), r.deadline.slice(11, 16)) > 0; })
      .sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; })[0];
    const tiles = [
      { cls: "yellow", num: today.length, label: "Tasks today", sub: today.filter(function (x) { return x.status === "finished"; }).length + " finished" },
      { cls: "mint", num: week.length ? Math.round(weekDone / week.length * 100) + "%" : "–", label: "Done this week", sub: weekDone + " of " + week.length + " tasks" },
      { cls: "red", num: overtime, label: "Overtime", sub: "unfinished after deadline", href: A.url("tasks", { status: "overtime" }) },
      { cls: "sky", num: nextRem ? U.fmtTime(nextRem.deadline.slice(11, 16)) : "–", label: "Next reminder", sub: nextRem ? nextRem.label : "none due", href: A.url("reminders") }
    ];
    $("#tiles").innerHTML = tiles.map(function (t) {
      const inner = '<span class="tile__num">' + A.esc(t.num) + '</span><span class="tile__label">' + t.label + '</span><span class="tile__sub">' + A.esc(t.sub) + "</span>";
      return t.href ? '<a class="tile tile--' + t.cls + '" href="' + t.href + '">' + inner + "</a>" : '<div class="tile tile--' + t.cls + '">' + inner + "</div>";
    }).join("");
  }

  function renderRecs() {
    const recs = S.recommendations().slice(0, 3);
    const box = $("#recs");
    box.hidden = !recs.length;
    if (!recs.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<h2 class="recs__title">' + A.icon("warning") + "Your schedule is getting crowded</h2>" + recs.map(function (r) {
      return '<article class="rec"><p><strong>' + A.fmtDate(r.fromDate, { year: undefined }) + " is " + r.fromLoad + "% booked.</strong> Move “" + A.esc(r.task.label) + "” (" + A.URG_LABEL[r.task.urgency] + ") to " +
        A.fmtDate(r.toDate, { year: undefined }) + " at " + U.fmtTime(r.start) + "? That day would be " + r.toLoad + "% booked.</p>" +
        '<div class="rec__actions"><button type="button" class="btn btn--sm btn--blue" data-accept="' + A.esc(r.id) + '">' + A.icon("move") + 'Move it</button>' +
        '<button type="button" class="btn btn--sm" data-dismiss="' + A.esc(r.id) + '">Keep it</button></div></article>';
    }).join("");
    box.querySelectorAll("[data-accept]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const r = recs.find(function (x) { return x.id === b.dataset.accept; });
        b.disabled = true;
        try {
          await S.moveTask(r.schedule.id, r.task.id, r.toDate, r.start, r.end);
          A.toast("Moved “" + r.task.label + "” to " + A.fmtDate(r.toDate, { year: undefined }) + ".", { type: "success" });
        } catch (err) { A.toast(err.message, { type: "error" }); b.disabled = false; }
      });
    });
    box.querySelectorAll("[data-dismiss]").forEach(function (b) {
      b.addEventListener("click", function () { S.dismissRecommendation(b.dataset.dismiss); });
    });
  }

  function statusRange() {
    const v = $("#status-range").value;
    if (v === "week") return { from: weekStart, to: U.addDays(weekStart, 6) };
    if (v === "month") return monthRange();
    return {};
  }

  function renderCharts() {
    const show = S.state.settings.dashboard.charts;
    const patterns = A.chartPatterns();
    const weekEnd = U.addDays(weekStart, 6);
    $("#week-label").textContent = A.fmtDate(weekStart, { weekday: undefined, year: undefined }) + " – " + A.fmtDate(weekEnd, { weekday: undefined });
    $("#month-label").textContent = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

    document.querySelectorAll(".chart-card").forEach(function (c) { c.hidden = !show[c.dataset.chart]; });
    $("#charts-none").hidden = Object.keys(show).some(function (k) { return show[k]; });

    /* Status */
    const r = statusRange();
    const g = S.statusBreakdown(r.from, r.to);
    charts.status.update([
      { key: "finished", label: "Finished", value: g.finished.length, color: A.cssVar("--st-finished") },
      { key: "pending", label: "Pending", value: g.pending.length, color: A.cssVar("--st-pending") },
      { key: "cancelled", label: "Cancelled", value: g.cancelled.length, color: A.cssVar("--st-cancelled") },
      { key: "overtime", label: "Overtime (unfinished)", value: g.overtime.length, color: A.cssVar("--st-overtime") }
    ], { patterns: patterns });

    /* Days of the selected week */
    charts.days.update(S.busyByWeekday(weekStart).map(function (d, i) {
      return { key: d.date, label: d.label + " · " + A.fmtDate(d.date, { weekday: undefined, year: undefined }), value: d.minutes, color: palette(i) };
    }), { patterns: patterns });

    /* Weeks of the selected month */
    charts.weeks.update(S.busyByWeekOfMonth(year, month).map(function (w, i) {
      return { key: w.key, label: w.label + " (" + A.fmtDate(w.from, { weekday: undefined, year: undefined }) + " – " + (+w.to.slice(8)) + ")", value: w.minutes, color: palette(i) };
    }), { patterns: patterns });

    /* Hours: whole week or a single day */
    const sel = $("#hours-day");
    const days = U.weekDates(weekStart);
    if (hoursDay !== "week" && days.indexOf(hoursDay) === -1) hoursDay = "week";
    sel.innerHTML = '<option value="week">Whole week</option>' + days.map(function (d) {
      return '<option value="' + d + '"' + (d === hoursDay ? " selected" : "") + ">" + A.fmtDate(d, { year: undefined }) + "</option>";
    }).join("");
    sel.value = hoursDay;
    charts.hours.update(S.busyByHour(hoursDay === "week" ? days : hoursDay).map(function (h, i) {
      return { key: h.key, label: h.label, value: h.minutes, color: palette(i) };
    }).filter(function (h) { return h.value > 0; }), { patterns: patterns });
  }

  /* ---------- drill-down: tasks behind a slice ---------- */
  function itemsFor(chart, key) {
    if (chart === "status") { const r = statusRange(); return S.statusBreakdown(r.from, r.to)[key] || []; }
    if (chart === "days") return (S.busyByWeekday(weekStart).find(function (d) { return d.key === key; }) || { items: [] }).items;
    if (chart === "weeks") return (S.busyByWeekOfMonth(year, month).find(function (w) { return w.key === key; }) || { items: [] }).items;
    if (chart === "hours") return (S.busyByHour(hoursDay === "week" ? U.weekDates(weekStart) : hoursDay).find(function (h) { return h.key === key; }) || { items: [] }).items;
    return [];
  }
  function titleFor(chart, key) {
    if (chart === "status") return { finished: "Finished tasks", pending: "Pending tasks", cancelled: "Cancelled tasks", overtime: "Overtime: tasks not finished before their deadline" }[key];
    if (chart === "days") return "Tasks on " + A.fmtDate(key, { weekday: "long", month: "long" });
    if (chart === "weeks") { const w = S.busyByWeekOfMonth(year, month).find(function (x) { return x.key === key; }); return w ? "Tasks in " + w.label + " (" + A.fmtDate(w.from, { year: undefined }) + " – " + A.fmtDate(w.to, { year: undefined }) + ")" : ""; }
    if (chart === "hours") { const h = S.busyByHour(hoursDay === "week" ? U.weekDates(weekStart) : hoursDay).find(function (x) { return x.key === key; }); return h ? "Tasks between " + h.label + (hoursDay === "week" ? " this week" : " on " + A.fmtDate(hoursDay, { year: undefined })) : ""; }
    return "";
  }
  function closeDrill() {
    drill = null;
    $("#drill").hidden = true;
    Object.keys(charts).forEach(function (k) { if (charts[k].selected) { charts[k].selected = null; } });
  }
  function openDrill(chart, key, silent) {
    if (!key) { if (!silent) closeDrill(); renderChartsOnlyIfNeeded(); return; }
    Object.keys(charts).forEach(function (k) { if (k !== chart && charts[k].selected) { charts[k].selected = null; charts[k].render(); } });
    drill = { chart: chart, key: key };
    const items = itemsFor(chart, key);
    const box = $("#drill");
    box.hidden = false;
    box.innerHTML =
      '<div class="drill__head"><h3>' + A.esc(titleFor(chart, key)) + ' <span class="drill__count">' + items.length + " task" + (items.length === 1 ? "" : "s") + "</span></h3>" +
      '<div class="drill__actions">' + (chart === "days" ? '<button type="button" class="btn btn--sm btn--yellow" id="drill-hours">' + A.icon("clock") + "See busiest hours of this day</button>" : "") +
      '<button type="button" class="icon-btn icon-btn--sm" id="drill-close" aria-label="Close details">' + A.icon("x") + "</button></div></div>" +
      (items.length ? '<ul class="drill__list">' + items.map(function (x) {
        return '<li><button type="button" class="drill__item" data-open="' + A.esc(x.schedule.id) + '">' +
          '<span class="drill__time">' + A.fmtDate(x.date, { year: undefined }) + "<br>" + A.fmtRange(x.task) + "</span>" +
          '<span class="drill__main"><strong>' + A.esc(x.task.label) + "</strong><small>" + A.esc(x.schedule.label) + "</small></span>" +
          '<span class="drill__badges"><span class="badge badge--' + x.status + '">' + A.statusLabel(x.status) + '</span><span class="badge badge--' + x.task.urgency + '">' + A.URG_LABEL[x.task.urgency] + "</span></span>" +
          "</button></li>";
      }).join("") + "</ul>" : '<p class="empty">No tasks here.</p>');
    box.querySelector("#drill-close").addEventListener("click", function () {
      const c = charts[chart]; c.selected = null; c.render(); closeDrill();
    });
    box.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { A.openSchedule(b.dataset.open); }); });
    const hb = box.querySelector("#drill-hours");
    if (hb) hb.addEventListener("click", function () {
      hoursDay = key;
      if (!S.state.settings.dashboard.charts.hours) {
        const next = Object.assign({}, S.state.settings.dashboard.charts, { hours: true });
        S.saveSettings({ dashboard: { charts: next } });
      }
      closeDrill(); render();
      const card = document.querySelector('[data-chart="hours"]');
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.querySelector("select").focus({ preventScroll: true });
    });
  }
  function renderChartsOnlyIfNeeded() { /* selection cleared by the chart itself */ }

  /* ---------- top days / top weeks ---------- */
  function renderTop() {
    const mr = monthRange();
    const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    $("#top-days-sub").textContent = "In " + label;
    $("#top-weeks-sub").textContent = "In " + label;
    const days = S.topDays(mr.from, mr.to, 5);
    const weeks = S.topWeeks(year, month, 5);
    $("#top-days").innerHTML = days.length ? rankRows(days.map(function (d) {
      return { title: A.fmtDate(d.date, { weekday: "long", month: "long", year: undefined }), count: d.count, minutes: d.minutes };
    })) : '<li class="empty"><strong>No data yet</strong>Your busiest days will show up here.</li>';
    $("#top-weeks").innerHTML = weeks.length ? rankRows(weeks.map(function (w) {
      return { title: w.label + " · " + A.fmtDate(w.from, { weekday: undefined, year: undefined }) + " – " + (+w.to.slice(8)), count: w.count, minutes: w.minutes };
    })) : '<li class="empty"><strong>No data yet</strong>Your busiest weeks will show up here.</li>';
  }
  function rankRows(rows) {
    const max = Math.max.apply(null, rows.map(function (r) { return r.count; }));
    return rows.map(function (r, i) {
      return '<li class="rank__row"><span class="rank__num">' + (i + 1) + '</span><div class="rank__main"><div class="rank__top"><strong>' + A.esc(r.title) + "</strong><span>" + r.count + " task" + (r.count === 1 ? "" : "s") + " · " + A.fmtDuration(r.minutes) + '</span></div><div class="rank__bar"><i style="width:' + (r.count / max * 100) + '%"></i></div></div></li>';
    }).join("");
  }
})();
