/* =========================================================
   About us page script
   ========================================================= */
(function () {
  "use strict";

  const timeline = document.getElementById("timeline");
  const items = timeline.querySelectorAll(".tl-item");

  /* Slide each history entry in when it enters the screen */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -60px 0px" });
    items.forEach(function (item) { io.observe(item); });
  } else {
    items.forEach(function (item) { item.classList.add("is-visible"); });
  }

  /* Fill the center line as the visitor reads down the history */
  function updateProgress() {
    const rect = timeline.getBoundingClientRect();
    const viewMid = window.innerHeight * 0.6;
    const pct = Math.min(Math.max((viewMid - rect.top) / rect.height, 0), 1);
    timeline.style.setProperty("--progress", (pct * 100).toFixed(1) + "%");
  }
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
})();
