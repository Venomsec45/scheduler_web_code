/* =========================================================
   Blog page script — topic filters and story reader
   ========================================================= */
(function () {
  "use strict";
  const filters = document.querySelectorAll(".filter");
  const posts = document.querySelectorAll(".post");

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const value = btn.dataset.filter;
      filters.forEach(function (f) {
        const active = f === btn;
        f.classList.toggle("is-active", active);
        f.setAttribute("aria-pressed", String(active));
      });
      posts.forEach(function (post) {
        const show = value === "all" || post.dataset.category === value;
        post.hidden = !show;
        post.classList.remove("is-entering");
        if (show) { void post.offsetWidth; post.classList.add("is-entering"); }
      });
    });
  });

  /* ---------- Story reader ---------- */
  const reader = document.getElementById("reader");
  const title = document.getElementById("reader-title");
  const tag = document.getElementById("reader-tag");
  const author = document.getElementById("reader-author");
  const content = document.getElementById("reader-content");
  let lastTrigger = null;

  document.getElementById("posts").addEventListener("click", function (e) {
    const btn = e.target.closest(".post__read");
    if (!btn) return;
    const post = btn.closest(".post");
    lastTrigger = btn;
    title.textContent = post.querySelector(".post__title").textContent;
    tag.textContent = post.querySelector(".post__tag").textContent;
    author.innerHTML = post.querySelector(".post__author").outerHTML;
    author.querySelector(".post__avatar").style.background = getComputedStyle(post).getPropertyValue("--accent");
    content.innerHTML = post.querySelector(".post__full").innerHTML;
    if (typeof reader.showModal === "function") reader.showModal();
    else reader.setAttribute("open", "");
  });

  function closeReader() {
    if (typeof reader.close === "function") reader.close();
    else reader.removeAttribute("open");
  }
  document.getElementById("reader-close").addEventListener("click", closeReader);
  reader.addEventListener("click", function (e) { if (e.target === reader) closeReader(); });
  reader.addEventListener("close", function () { if (lastTrigger) lastTrigger.focus(); });
})();
