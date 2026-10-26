/* =========================================================
   Home page script
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;

  /* ---------- Welcome name (set after sign up / log in) ---------- */
  try {
    const user = JSON.parse(localStorage.getItem("scheduler-user") || "null");
    if (user && user.email) {
      document.getElementById("welcome-name").textContent = user.email.split("@")[0];
    }
  } catch (e) { /* storage unavailable: keep the default greeting */ }

  /* ---------- Hero light effect that follows the cursor ---------- */
  const hero = document.getElementById("hero");
  let frame = null;
  function moveLight(clientX, clientY) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function () {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--x", (clientX - r.left) + "px");
      hero.style.setProperty("--y", (clientY - r.top) + "px");
    });
  }
  hero.addEventListener("pointerenter", function (e) { hero.classList.add("is-lit"); moveLight(e.clientX, e.clientY); });
  hero.addEventListener("pointermove", function (e) { moveLight(e.clientX, e.clientY); });
  hero.addEventListener("pointerleave", function () { hero.classList.remove("is-lit"); });

  /* ---------- Seminar countdown ---------- */
  const SEMINAR_DATE = new Date("2026-11-21T14:00:00"); // change with the seminar date
  const countdown = document.getElementById("countdown");
  function renderCountdown() {
    const diff = SEMINAR_DATE - new Date();
    if (diff <= 0) { countdown.innerHTML = "<div><b>Live</b><small>now</small></div>"; return; }
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff / 36e5) % 24;
    const m = Math.floor(diff / 6e4) % 60;
    const s = Math.floor(diff / 1e3) % 60;
    countdown.innerHTML = [[d, "days"], [h, "hours"], [m, "mins"], [s, "secs"]]
      .map(function (p) { return "<div><b>" + String(p[0]).padStart(2, "0") + "</b><small>" + p[1] + "</small></div>"; })
      .join("");
  }
  renderCountdown();
  setInterval(renderCountdown, 1000);

  const reserveBtn = document.getElementById("reserve-btn");
  reserveBtn.addEventListener("click", function () {
    const reserved = reserveBtn.classList.toggle("btn--blue");
    reserveBtn.classList.toggle("btn--yellow", !reserved);
    reserveBtn.textContent = reserved ? "Seat reserved" : "Reserve a seat";
    S.toast(reserved ? "Seat reserved. We will email you the link." : "Reservation cancelled.", reserved ? "success" : "");
  });

  /* ---------- Customization demo ---------- */
  const customCard = document.getElementById("custom-card");
  const swatches = customCard.querySelectorAll(".swatch");
  swatches.forEach(function (sw) {
    sw.addEventListener("click", function () {
      swatches.forEach(function (o) { o.classList.remove("is-active"); o.setAttribute("aria-checked", "false"); });
      sw.classList.add("is-active");
      sw.setAttribute("aria-checked", "true");
      customCard.style.backgroundColor = getComputedStyle(sw).getPropertyValue("--c");
    });
  });

  /* ---------- Recommendation demo ---------- */
  const suggest = document.getElementById("suggest");
  suggest.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-suggest]");
    if (!btn) return;
    if (btn.dataset.suggest === "reset") { resetSuggest(); return; }
    const text = suggest.querySelector(".suggest__text");
    const actions = suggest.querySelector(".suggest__actions");
    if (btn.dataset.suggest === "accept") {
      text.innerHTML = "<strong>Done.</strong> \"Gym session\" moved to Thursday at 6:00 PM. Wednesday is now 71% full.";
    } else {
      text.innerHTML = "<strong>Kept.</strong> \"Gym session\" stays on Wednesday. We will remind you if it gets busier.";
    }
    suggest.classList.add("is-done");
    actions.innerHTML = '<button type="button" class="btn btn--white" data-suggest="reset">Undo</button>';
  });
  function resetSuggest() {
    suggest.classList.remove("is-done");
    suggest.querySelector(".suggest__text").innerHTML = '<strong>Wednesday is 92% full.</strong> Move "Gym session" to Thursday at 6:00 PM?';
    suggest.querySelector(".suggest__actions").innerHTML =
      '<button type="button" class="btn btn--blue" data-suggest="accept">Move it</button>' +
      '<button type="button" class="btn btn--white" data-suggest="dismiss">Keep it</button>';
  }
})();
