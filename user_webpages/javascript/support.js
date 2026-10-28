/* =========================================================
   Help & support page — sends name, email, contact number
   and message to the backend (/api/user/support), which
   stores it in your existing `support` table.
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, A = window.App;
  const $ = function (sel) { return document.querySelector(sel); };

  A.ready(function () {
    const p = S.state.profile;
    if (p.name) $("#sp-name").value = p.name;
    if (p.email) $("#sp-email").value = p.email;
    if (p.phone) $("#sp-phone").value = p.phone;
    $("#a11y-link").href = A.url("settings") + "#customization";

    const form = $("#support-form");
    form.addEventListener("input", function (e) { if (e.target.classList.contains("is-invalid")) validate(); });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validate()) { form.querySelector(".is-invalid").focus(); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await S.sendSupport({
          topic: form.querySelector('input[name="topic"]:checked').value,
          name: $("#sp-name").value.trim(),
          email: $("#sp-email").value.trim(),
          contact_number: $("#sp-phone").value.trim(),
          message: $("#sp-message").value.trim()
        });
        form.innerHTML = '<div class="sent"><div class="sent__icon" aria-hidden="true">' + A.icon("check") + "</div><h2>Message sent</h2><p>Thanks! We'll reply to <strong>" + A.esc($("#sp-email").value.trim()) + "</strong> soon.</p>" +
          '<a class="btn btn--yellow" href="' + A.url("support") + '">Send another message</a></div>';
        A.toast("Message sent.", { type: "success" });
      } catch (err) {
        A.toast(err.message, { type: "error", duration: 6000 });
      } finally { btn.disabled = false; }
    });
  });

  function validate() {
    let ok = true;
    const check = function (id, bad, msg) {
      const el = $(id);
      el.classList.toggle("is-invalid", bad);
      el.setAttribute("aria-invalid", String(bad));
      el.closest(".field").querySelector(".field__error").textContent = bad ? msg : "";
      if (bad) ok = false;
    };
    check("#sp-name", $("#sp-name").value.trim().length < 2, "Enter your name.");
    check("#sp-email", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("#sp-email").value.trim()), "Enter a valid email, like you@email.com.");
    check("#sp-phone", !/^\+?\d{7,15}$/.test($("#sp-phone").value.replace(/[\s\-()]/g, "")), "Enter a contact number with 7 to 15 digits.");
    check("#sp-message", $("#sp-message").value.trim().length < 10, "Write at least 10 characters so we can help.");
    return ok;
  }
})();
