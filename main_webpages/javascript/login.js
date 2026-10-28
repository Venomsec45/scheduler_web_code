/* =========================================================
   Log in page script — connected to the FastAPI backend
   * POST /api/auth/login            email + password
   * POST /api/auth/forgot-password  emails a reset code
   * POST /api/auth/reset-password   code + new password
   A successful login goes straight to the user dashboard.
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;
  const DASHBOARD = "/user/dashboard";
  const SIGNUP = "/sign%20up";

  const form = document.getElementById("login-form");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const remember = document.getElementById("remember");
  const submitBtn = form.querySelector('[type="submit"]');

  /* Already logged in? Skip the form. */
  fetch("/api/user/me", { credentials: "same-origin" })
    .then(function (r) { if (r.ok) location.replace(DASHBOARD); })
    .catch(function () { /* server not reachable: stay on the page */ });

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
  function busy(btn, on, text) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || "Please wait…"; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
  function goDashboard(msg) {
    S.toast(msg || "Logged in. Taking you to your dashboard.", "success");
    setTimeout(function () { location.href = DASHBOARD; }, 900);
  }
  function passwordOk(v) { return v.length >= 8 && /\d/.test(v) && /[a-z]/i.test(v); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* Fix the sign-up link for the FastAPI route */
  const signupLink = form.querySelector(".auth__switch a");
  if (signupLink) signupLink.href = SIGNUP;

  /* ---------- show / hide password ---------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".password__toggle");
    if (!btn) return;
    const input = btn.previousElementSibling;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  /* ---------- log in ---------- */
  function validate() {
    let ok = true;
    if (!S.isEmail(email.value)) { S.setError(email, "Enter a valid email, like you@email.com."); ok = false; } else S.setError(email, "");
    if (!password.value) { S.setError(password, "Enter your password."); ok = false; } else S.setError(password, "");
    return ok;
  }
  form.addEventListener("input", function (e) { if (e.target.classList.contains("is-invalid")) validate(); });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) { form.querySelector(".is-invalid").focus(); return; }
    busy(submitBtn, true, "Logging in…");
    const r = await api("/api/auth/login", { email: email.value.trim(), password: password.value, remember: remember.checked });
    busy(submitBtn, false);
    if (r.ok) { goDashboard(); return; }
    if (r.status === 401) { S.setError(password, r.message || "Email or password is not correct."); password.focus(); return; }
    S.toast(r.message || "Could not log in. Please try again.", "error");
  });

  /* ---------- password reset panels ---------- */
  let panel = null;
  function showPanel(el) {
    if (panel) panel.remove();
    panel = el;
    form.hidden = true;
    form.insertAdjacentElement("afterend", el);
    const first = el.querySelector("input");
    if (first) first.focus();
  }
  function backToLogin() {
    if (panel) panel.remove();
    panel = null;
    form.hidden = false;
    password.value = "";
    password.focus();
  }
  function demoNote(data) {
    return data && data.dev_code ? '<p class="notice-dev" role="note">Testing mode: no email server is set up, so your code is <strong>' + esc(data.dev_code) + "</strong>.</p>" : "";
  }
  function resendButton(panelEl, emailValue) {
    const btn = panelEl.querySelector("[data-resend]");
    let left = 60, timer;
    function tick() {
      if (left <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = "Resend code"; return; }
      btn.disabled = true; btn.textContent = "Resend code in " + left + "s"; left--;
    }
    tick(); timer = setInterval(tick, 1000);
    btn.addEventListener("click", async function () {
      const r = await api("/api/auth/resend-otp", { email: emailValue });
      if (!r.ok) { S.toast(r.message || "Could not send a new code.", "error"); return; }
      S.toast("A new code was sent to " + emailValue + ".", "success");
      const note = panelEl.querySelector(".notice-dev");
      if (note && r.data.dev_code) note.querySelector("strong").textContent = r.data.dev_code;
      left = 60; tick(); clearInterval(timer); timer = setInterval(tick, 1000);
    });
  }

  /* Forgot my password: email → code + new password */
  function resetPanel() {
    const el = document.createElement("form");
    el.className = "auth-card";
    el.noValidate = true;
    el.innerHTML =
      "<h2>Reset your password</h2>" +
      "<p>Enter your account email. We'll send you a 6-digit code to set a new password.</p>" +
      '<div class="field"><label class="label" for="reset-email">Email</label>' +
      '<input class="input" id="reset-email" type="email" autocomplete="email" placeholder="you@email.com" value="' + esc(email.value.trim()) + '">' +
      '<span class="field__error"></span></div>' +
      '<button class="btn btn--yellow btn--block auth__submit" type="submit">Send reset code</button>' +
      '<p class="auth__switch"><button type="button" class="auth__link-btn" data-back>Back to log in</button></p>';
    const resetEmail = el.querySelector("#reset-email");
    el.querySelector("[data-back]").addEventListener("click", backToLogin);
    el.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!S.isEmail(resetEmail.value)) { S.setError(resetEmail, "Enter a valid email, like you@email.com."); resetEmail.focus(); return; }
      const btn = el.querySelector('[type="submit"]');
      busy(btn, true, "Sending…");
      const r = await api("/api/auth/forgot-password", { email: resetEmail.value.trim() });
      busy(btn, false);
      if (!r.ok) { S.setError(resetEmail, r.message || "Could not send a code."); return; }
      showPanel(newPasswordPanel(resetEmail.value.trim(), r.data));
    });
    return el;
  }

  function newPasswordPanel(emailValue, data) {
    const el = document.createElement("form");
    el.className = "auth-card";
    el.noValidate = true;
    const eye = form.querySelector(".password__toggle").innerHTML;
    el.innerHTML =
      "<h2>Set a new password</h2>" +
      "<p>If <strong>" + esc(emailValue) + "</strong> has an account, we sent it a 6-digit code. It expires in 5 minutes.</p>" + demoNote(data) +
      '<div class="field"><label class="label" for="reset-code">Code</label>' +
      '<input class="input code-input" id="reset-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' +
      '<span class="field__error"></span></div>' +
      '<div class="field"><label class="label" for="reset-pw">New password</label>' +
      '<div class="password"><input class="input" id="reset-pw" type="password" autocomplete="new-password" placeholder="At least 8 characters">' +
      '<button class="password__toggle" type="button" aria-label="Show password" aria-pressed="false">' + eye + "</button></div>" +
      '<span class="field__error"></span></div>' +
      '<div class="field"><label class="label" for="reset-pw2">Confirm new password</label>' +
      '<input class="input" id="reset-pw2" type="password" autocomplete="new-password">' +
      '<span class="field__error"></span></div>' +
      '<button class="btn btn--yellow btn--block auth__submit" type="submit">Save password and log in</button>' +
      '<p class="auth__switch"><button type="button" class="auth__link-btn" data-resend></button> · <button type="button" class="auth__link-btn" data-back>Back to log in</button></p>';
    const code = el.querySelector("#reset-code"), pw = el.querySelector("#reset-pw"), pw2 = el.querySelector("#reset-pw2");
    code.addEventListener("input", function () { code.value = code.value.replace(/\D/g, "").slice(0, 6); });
    el.querySelector("[data-back]").addEventListener("click", backToLogin);
    resendButton(el, emailValue);
    el.addEventListener("submit", async function (e) {
      e.preventDefault();
      let ok = true;
      if (code.value.length !== 6) { S.setError(code, "Enter all 6 digits."); ok = false; } else S.setError(code, "");
      if (!passwordOk(pw.value)) { S.setError(pw, "Use 8 or more characters with a letter and a number."); ok = false; } else S.setError(pw, "");
      if (pw2.value !== pw.value) { S.setError(pw2, "The passwords do not match."); ok = false; } else S.setError(pw2, "");
      if (!ok) { el.querySelector(".is-invalid").focus(); return; }
      const btn = el.querySelector('[type="submit"]');
      busy(btn, true, "Saving…");
      const r = await api("/api/auth/reset-password", { email: emailValue, code: code.value, new_password: pw.value });
      busy(btn, false);
      if (r.ok) { goDashboard("Password changed. Taking you to your dashboard."); return; }
      if (r.status === 422) { S.setError(pw, r.message); pw.focus(); return; }
      S.setError(code, r.message || "That code does not match.");
      code.focus();
    });
    return el;
  }

  document.getElementById("forgot-link").addEventListener("click", function (e) {
    e.preventDefault();
    showPanel(resetPanel());
  });
})();
