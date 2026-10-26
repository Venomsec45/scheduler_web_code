/* =========================================================
   Support page script — form validation
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;
  const form = document.getElementById("support-form");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const message = document.getElementById("message");
  const counter = document.getElementById("counter");

  message.addEventListener("input", function () {
    counter.textContent = message.value.length + " / 1000";
  });

  function validate() {
    let ok = true;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.replace(/[\s\-()]/g, "");
    const msg = message.value.trim();

    if (name.length < 2) { S.setError(nameInput, "Enter your name."); ok = false; } else S.setError(nameInput, "");
    if (!S.isEmail(email)) { S.setError(emailInput, "Enter a valid email, like you@email.com."); ok = false; } else S.setError(emailInput, "");
    if (!/^\+?\d{7,15}$/.test(phone)) { S.setError(phoneInput, "Enter a contact number with 7 to 15 digits."); ok = false; } else S.setError(phoneInput, "");
    if (msg.length < 10) { S.setError(message, "Write at least 10 characters so we can help."); ok = false; } else S.setError(message, "");
    return ok;
  }

  form.addEventListener("input", function (e) {
    if (e.target.classList.contains("is-invalid")) validate();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      const firstBad = form.querySelector(".is-invalid");
      if (firstBad) firstBad.focus();
      S.toast("Check the highlighted fields.", "error");
      return;
    }
    // TODO: connect to your backend or email service here.
    const name = nameInput.value.trim().split(" ")[0];
    const email = emailInput.value.trim();
    const topic = form.querySelector("input[name=topic]:checked").value;
    form.classList.add("is-sent");
    form.innerHTML =
      '<div class="sent">' +
        '<div class="sent__icon" aria-hidden="true">✓</div>' +
        "<h2>Message sent</h2>" +
        "<p>Thanks, " + escapeHtml(name) + ". We received your " + topic + " and will reply to <strong>" + escapeHtml(email) + "</strong> within 24 hours.</p>" +
        '<a class="btn btn--yellow" href="support.html">Send another message</a>' +
      "</div>";
    S.toast("Message sent.", "success");
  });

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
