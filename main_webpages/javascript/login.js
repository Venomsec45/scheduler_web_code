/* =========================================================
   Log in page script
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;
  const form = document.getElementById("login-form");
  const email = document.getElementById("email");
  const password = document.getElementById("password");

  /* Show / hide password */
  document.querySelectorAll(".password__toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = btn.previousElementSibling;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  /* Demo account storage (replace with real API calls when the backend is ready) */
  function readAccounts() {
    try { return JSON.parse(localStorage.getItem("scheduler-accounts") || "{}"); } catch (e) { return {}; }
  }
  function writeAccounts(accounts) {
    try { localStorage.setItem("scheduler-accounts", JSON.stringify(accounts)); } catch (e) { /* ignore */ }
  }
  async function hash(text) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    return "plain:" + text;
  }
  function saveSession(email) {
    try { localStorage.setItem("scheduler-user", JSON.stringify({ email: email })); } catch (e) { /* ignore */ }
  }

  function validate() {
    let ok = true;
    if (!S.isEmail(email.value)) { S.setError(email, "Enter a valid email, like you@email.com."); ok = false; } else S.setError(email, "");
    if (!password.value) { S.setError(password, "Enter your password."); ok = false; } else S.setError(password, "");
    return ok;
  }

  form.addEventListener("input", function (e) {
    if (e.target.classList.contains("is-invalid")) validate();
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) { form.querySelector(".is-invalid").focus(); return; }

    const key = email.value.trim().toLowerCase();
    const account = readAccounts()[key];
    if (!account) {
      S.setError(email, "No account uses this email. Check it, or sign up first.");
      email.focus();
      return;
    }
    if (account.password !== await hash(password.value)) {
      S.setError(password, "That password is not correct. Try again or reset it.");
      password.focus();
      return;
    }
    saveSession(key);
    S.toast("Logged in. Taking you to your home page.", "success");
    setTimeout(function () { location.href = "index.html"; }, 1200);
  });

  /* Forgot password */
  document.getElementById("forgot-link").addEventListener("click", function (e) {
    e.preventDefault();
    if (!S.isEmail(email.value)) {
      S.setError(email, "Enter your email first, then select Forgot my password.");
      email.focus();
      return;
    }
    S.setError(email, "");
    // TODO: call your password-reset endpoint here.
    S.toast("If an account exists for " + email.value.trim() + ", a reset link is on its way.", "success");
  });
})();
