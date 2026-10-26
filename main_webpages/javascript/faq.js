/* =========================================================
   FAQ page script — accordion and search
   ========================================================= */
(function () {
  "use strict";
  const items = Array.from(document.querySelectorAll(".faq-item"));
  const search = document.getElementById("faq-search");
  const empty = document.getElementById("faq-empty");
  const toggleAll = document.getElementById("faq-toggle-all");

  function setOpen(item, open) {
    item.classList.toggle("is-open", open);
    item.querySelector("button").setAttribute("aria-expanded", String(open));
  }

  items.forEach(function (item) {
    item.querySelector("button").addEventListener("click", function () {
      setOpen(item, !item.classList.contains("is-open"));
      syncToggleLabel();
    });
  });

  function visibleItems() { return items.filter(function (i) { return !i.hidden; }); }

  function syncToggleLabel() {
    const allOpen = visibleItems().every(function (i) { return i.classList.contains("is-open"); });
    toggleAll.textContent = allOpen && visibleItems().length ? "Collapse all" : "Expand all";
  }

  toggleAll.addEventListener("click", function () {
    const open = toggleAll.textContent === "Expand all";
    visibleItems().forEach(function (i) { setOpen(i, open); });
    syncToggleLabel();
  });

  search.addEventListener("input", function () {
    const term = search.value.trim().toLowerCase();
    let shown = 0;
    items.forEach(function (item) {
      const match = !term || item.textContent.toLowerCase().includes(term);
      item.hidden = !match;
      if (match) shown++;
    });
    empty.hidden = shown !== 0;
    syncToggleLabel();
  });

  // Open the first question so visitors see how it works
  setOpen(items[0], true);
})();
