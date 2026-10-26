/* =========================================================
   How it works page script — step-by-step walkthrough
   ========================================================= */
(function () {
  "use strict";

  const tabs = Array.from(document.querySelectorAll(".step-tab"));
  const panels = Array.from(document.querySelectorAll(".step-panel"));
  const prev = document.getElementById("prev-step");
  const next = document.getElementById("next-step");
  const fill = document.getElementById("stepper-fill");
  let current = 0;

  function show(index, focusTab) {
    current = Math.max(0, Math.min(index, tabs.length - 1));
    tabs.forEach(function (tab, i) {
      const active = i === current;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-done", i < current);
      panels[i].hidden = !active;
    });
    fill.style.setProperty("--fill", ((current + 1) / tabs.length * 100) + "%");
    prev.disabled = current === 0;
    next.textContent = current === tabs.length - 1 ? "Start over" : "Next step";
    // Keep the active tab visible in the horizontal tab strip on small screens (no page jump)
    const strip = tabs[current].parentElement;
    if (strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: tabs[current].offsetLeft - strip.offsetLeft - 8, behavior: "smooth" });
    }
    if (focusTab) tabs[current].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { show(i); });
    tab.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); show(current + 1, true); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); show(current - 1, true); }
      if (e.key === "Home") { e.preventDefault(); show(0, true); }
      if (e.key === "End") { e.preventDefault(); show(tabs.length - 1, true); }
    });
  });

  prev.addEventListener("click", function () { show(current - 1); });
  next.addEventListener("click", function () {
    show(current === tabs.length - 1 ? 0 : current + 1);
  });

  show(0);
})();
