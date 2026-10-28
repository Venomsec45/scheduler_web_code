/* =========================================================
   Scheduler user app — pie (donut) chart
   * Every slice is keyboard focusable and clickable
   * Optional patterns on slices for color-blind users
   * "No data yet" state when there is nothing to show
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const PATTERNS = ["stripes", "dots", "cross", "grid", "back", "rings", "zig"];
  let seq = 0;

  function patternMarkup(id, kind, color) {
    const ink = "rgba(0,0,0,.55)";
    const bodies = {
      stripes: '<path d="M-2 2 l4 -4 M0 10 l10 -10 M8 12 l4 -4" stroke="' + ink + '" stroke-width="2.4"/>',
      dots: '<circle cx="5" cy="5" r="2" fill="' + ink + '"/>',
      cross: '<path d="M0 0 L10 10 M10 0 L0 10" stroke="' + ink + '" stroke-width="1.6"/>',
      grid: '<path d="M0 5 H10 M5 0 V10" stroke="' + ink + '" stroke-width="1.6"/>',
      back: '<path d="M-2 8 l4 4 M0 0 l10 10 M8 -2 l4 4" stroke="' + ink + '" stroke-width="2.4"/>',
      rings: '<circle cx="5" cy="5" r="3" fill="none" stroke="' + ink + '" stroke-width="1.6"/>',
      zig: '<path d="M0 7 L2.5 3 L5 7 L7.5 3 L10 7" fill="none" stroke="' + ink + '" stroke-width="1.6"/>'
    };
    return '<pattern id="' + id + '" width="10" height="10" patternUnits="userSpaceOnUse">' +
      '<rect width="10" height="10" fill="' + color + '"/>' + bodies[kind] + "</pattern>";
  }

  function arcPath(cx, cy, r, r0, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = function (rad, a) { return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const s = p(r, a0), e = p(r, a1), si = p(r0, a1), ei = p(r0, a0);
    return "M" + s[0] + " " + s[1] + " A" + r + " " + r + " 0 " + large + " 1 " + e[0] + " " + e[1] +
      " L" + si[0] + " " + si[1] + " A" + r0 + " " + r0 + " 0 " + large + " 0 " + ei[0] + " " + ei[1] + " Z";
  }

  function PieChart(el, opts) {
    this.el = el;
    this.opts = Object.assign({ emptyText: "No data yet", centerLabel: "total", patterns: false, format: null }, opts);
    this.id = "pie" + (++seq);
    this.selected = null;
    this.render();
  }

  PieChart.prototype.update = function (data, extra) {
    this.opts.data = data;
    if (extra) Object.assign(this.opts, extra);
    if (this.selected && !data.some(function (d) { return d.key === this.selected && d.value > 0; }, this)) this.selected = null;
    this.render();
  };

  PieChart.prototype.select = function (key) {
    this.selected = this.selected === key ? null : key;
    this.render();
    if (this.opts.onSelect) this.opts.onSelect(this.selected);
    const again = this.el.querySelector('[data-key="' + key + '"].pie__slice');
    if (again) again.focus();
  };

  PieChart.prototype.render = function () {
    const self = this, o = this.opts;
    const data = (o.data || []).filter(function (d) { return d.value > 0; });
    const total = data.reduce(function (a, d) { return a + d.value; }, 0);
    const fmt = o.format || function (v) { return String(v); };
    const pct = function (v) { return total ? Math.round(v / total * 1000) / 10 : 0; };

    let defs = "";
    let slices = "";
    let center = "";

    if (!total) {
      slices = '<circle class="pie__empty-ring" cx="100" cy="100" r="71"/>';
      center = '<text class="pie__center-num" x="100" y="98" text-anchor="middle" style="font-size:15px">' + o.emptyText + '</text>' +
        '<text class="pie__center-label" x="100" y="118" text-anchor="middle">' + (o.emptyHint || "") + "</text>";
    } else {
      let a = -Math.PI / 2;
      data.forEach(function (d, i) {
        const span = d.value / total * Math.PI * 2;
        const a1 = a + span - (data.length > 1 ? 0.0001 : 0);
        let fill = d.color;
        if (o.patterns) {
          const pid = self.id + "-p" + i;
          defs += patternMarkup(pid, PATTERNS[i % PATTERNS.length], d.color);
          fill = "url(#" + pid + ")";
        }
        const path = span >= Math.PI * 2 - 0.0001
          ? arcPath(100, 100, 90, 52, -Math.PI / 2, Math.PI / 2) + " " + arcPath(100, 100, 90, 52, Math.PI / 2, Math.PI * 1.5 - 0.0001)
          : arcPath(100, 100, 90, 52, a, a1);
        slices += '<path class="pie__slice' + (self.selected === d.key ? " is-selected" : "") + '" data-key="' + d.key + '" d="' + path +
          '" fill="' + fill + '" tabindex="0" role="button" aria-pressed="' + (self.selected === d.key) + '" aria-label="' +
          escapeAttr(d.label + ": " + pct(d.value) + "% (" + fmt(d.value) + "). Press to see details") + '"><title>' +
          escapeAttr(d.label + " — " + pct(d.value) + "%") + "</title></path>";
        a += span;
      });
      const sel = data.find(function (d) { return d.key === self.selected; });
      center = '<text class="pie__center-num" x="100" y="104" text-anchor="middle">' + (sel ? pct(sel.value) + "%" : fmt(total)) + "</text>" +
        '<text class="pie__center-label" x="100" y="124" text-anchor="middle">' + escapeAttr(sel ? sel.label : o.centerLabel) + "</text>";
    }

    const legend = (o.data || []).map(function (d, i) {
      const idx = data.indexOf(d);
      const swatch = o.patterns && idx !== -1
        ? '<svg class="pie__swatch" viewBox="0 0 10 10" aria-hidden="true"><defs>' + patternMarkup(self.id + "-l" + i, PATTERNS[idx % PATTERNS.length], d.color) + '</defs><rect width="10" height="10" fill="url(#' + self.id + "-l" + i + ')"/></svg>'
        : '<span class="pie__swatch" style="background:' + d.color + '" aria-hidden="true"></span>';
      return '<li><button type="button" data-key="' + d.key + '" aria-pressed="' + (self.selected === d.key) + '"' + (d.value > 0 ? "" : " disabled") + ">" +
        swatch + '<span class="pie__legend-label">' + escapeHtml(d.label) + '</span><span class="pie__legend-val">' + pct(d.value) + "%</span></button></li>";
    }).join("");

    this.el.innerHTML =
      '<div class="pie">' +
        '<svg class="pie__svg" viewBox="0 0 200 200" role="group" aria-label="' + escapeAttr(o.title || "Pie chart") + '"><defs>' + defs + "</defs>" + slices + center + "</svg>" +
        '<ul class="pie__legend">' + legend + "</ul>" +
      "</div>";

    this.el.querySelectorAll("[data-key]").forEach(function (node) {
      node.addEventListener("click", function () { self.select(node.dataset.key); });
      if (node.tagName.toLowerCase() === "path") {
        node.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.select(node.dataset.key); }
        });
      }
    });
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }

  window.PieChart = PieChart;
})();
