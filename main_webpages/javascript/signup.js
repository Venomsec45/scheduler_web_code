/* =========================================================
   Sign up page script — connected to the FastAPI backend
   POST /api/auth/signup  email + password → account created,
                          user is logged in → user dashboard
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;
  const DASHBOARD = "/user/dashboard";
  const LOGIN = "/log%20in";

  const signupForm = document.getElementById("signup-form");
  const doneStep = document.getElementById("signup-done");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const strength = document.querySelector(".strength");
  const rules = document.querySelectorAll(".pw-rules li");
  const submitBtn = signupForm.querySelector('[type="submit"]');

  /* Already logged in? Go to the dashboard. */
  fetch("/api/user/me", { credentials: "same-origin" })
    .then(function (r) { if (r.ok) location.replace(DASHBOARD); })
    .catch(function () { /* server not reachable */ });

  /* ---------- helpers ---------- */
  async function api(path, body) {
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      let data = {};
      try { data = await res.json(); } catch (e) { data = {}; }
      const d = data.detail;
      const message = typeof d === "string" ? d : (d && d.message) || (Array.isArray(d) ? "Please check the form." : "");
      return { ok: res.ok, status: res.status, data: data, message: message };
    } catch (err) {
      return { ok: false, status: 0, data: {}, message: "Can't reach the server. Check your connection and try again." };
    }
  }
  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }

  /* ---------- show / hide password ---------- */
  document.querySelectorAll(".password__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = btn.previousElementSibling;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  /* ---------- password rules + strength meter ---------- */
  function checkRules(value) {
    const result = { length: value.length >= 8, number: /\d/.test(value), letter: /[a-z]/i.test(value) };
    rules.forEach(function (li) { li.classList.toggle("is-met", result[li.dataset.rule]); });
    let level = 0;
    if (value.length) level = 1;
    if (result.length) level++;
    if (result.length && result.number && result.letter) level++;
    if (level === 3 && (value.length >= 12 || /[^a-z0-9]/i.test(value))) level++;
    strength.dataset.level = String(level);
    return result.length && result.number && result.letter;
  }
  password.addEventListener("input", function () { checkRules(password.value); });

  function validate() {
    let ok = true;
    if (!S.isEmail(email.value)) { S.setError(email, "Enter a valid email, like you@email.com."); ok = false; } else S.setError(email, "");
    if (!checkRules(password.value)) { S.setError(password, "Use 8 or more characters with at least one letter and one number."); ok = false; } else S.setError(password, "");
    return ok;
  }
  signupForm.addEventListener("input", function (e) { if (e.target.classList.contains("is-invalid")) validate(); });

  /* ---------- create the account ---------- */
  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) { signupForm.querySelector(".is-invalid").focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";
    const r = await api("/api/auth/signup", {
      email: email.value.trim(),
      password: password.value,
      name: email.value.trim().split("@")[0],
      timezone: timezone()
    });
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign up";

    if (r.ok) {
      signupForm.hidden = true;
      doneStep.hidden = false;
      S.toast("Account created. Opening your dashboard…", "success");
      setTimeout(function () { location.href = DASHBOARD; }, 1200);
      return;
    }
    if (r.status === 409) {
      S.setError(email, "This email already has an account.");
      email.closest(".field").querySelector(".field__error")
        .insertAdjacentHTML("beforeend", ' <a href="' + LOGIN + '">Log in instead</a>');
      email.focus();
      return;
    }
    if (r.status === 422) {
      S.setError(password, r.message || "Please check the form.");
      password.focus();
      return;
    }
    S.toast(r.message || "Could not create your account. Please try again.", "error");
  });
})();
