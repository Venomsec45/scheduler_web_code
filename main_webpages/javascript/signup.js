/* =========================================================
   Sign up page script — account form, OTP verification
   ========================================================= */
(function () {
  "use strict";
  const S = window.Scheduler;

  const signupForm = document.getElementById("signup-form");
  const otpForm = document.getElementById("otp-form");
  const doneStep = document.getElementById("signup-done");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const strength = document.querySelector(".strength");
  const rules = document.querySelectorAll(".pw-rules li");
  const boxes = Array.from(document.querySelectorAll(".otp__box"));
  const otpWrap = document.getElementById("otp-inputs");
  const otpError = document.getElementById("otp-error");
  const resendBtn = document.getElementById("resend-btn");
  const steps = document.querySelectorAll(".signup-steps li");

  const OTP_LIFETIME = 5 * 60 * 1000;
  const RESEND_WAIT = 60;
  let otp = { code: null, expires: 0 };
  let resendInterval = null;

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

  /* ---------- Step indicator ---------- */
  function goToStep(n) {
    signupForm.hidden = n !== 1;
    otpForm.hidden = n !== 2;
    doneStep.hidden = n !== 3;
    steps.forEach(function (li) {
      const s = Number(li.dataset.step);
      li.classList.toggle("is-current", s === n);
      li.classList.toggle("is-done", s < n);
      if (s === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }

  /* ---------- Password rules ---------- */
  function checkRules(value) {
    const result = {
      length: value.length >= 8,
      number: /\d/.test(value),
      letter: /[a-z]/i.test(value)
    };
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

  function validateAccount() {
    let ok = true;
    if (!S.isEmail(email.value)) { S.setError(email, "Enter a valid email, like you@email.com."); ok = false; }
    else if (readAccounts()[email.value.trim().toLowerCase()]) { S.setError(email, "This email already has an account. Log in instead."); ok = false; }
    else S.setError(email, "");
    if (!checkRules(password.value)) { S.setError(password, "Use 8 or more characters with at least one letter and one number."); ok = false; }
    else S.setError(password, "");
    return ok;
  }
  signupForm.addEventListener("input", function (e) {
    if (e.target.classList.contains("is-invalid")) validateAccount();
  });

  /* ---------- Send code ---------- */
  function sendCode() {
    // DEMO ONLY: a real site generates and emails this code on the server.
    // Replace this block with a call such as fetch("/api/send-otp", { method: "POST", body: ... }).
    const arr = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    otp.code = String(arr[0] % 1000000).padStart(6, "0");
    otp.expires = Date.now() + OTP_LIFETIME;
    document.getElementById("otp-demo").textContent =
      "Demo mode: no email server is connected yet, so your code is " + otp.code + ".";
    startResendTimer();
  }

  function startResendTimer() {
    let left = RESEND_WAIT;
    resendBtn.disabled = true;
    resendBtn.innerHTML = 'Resend code in <span id="resend-timer">' + left + "</span>s";
    clearInterval(resendInterval);
    resendInterval = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(resendInterval);
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend code";
      } else {
        document.getElementById("resend-timer").textContent = left;
      }
    }, 1000);
  }

  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateAccount()) { signupForm.querySelector(".is-invalid").focus(); return; }
    document.getElementById("otp-email").textContent = email.value.trim();
    sendCode();
    clearBoxes();
    goToStep(2);
    S.toast("Code sent to " + email.value.trim() + ".", "success");
    boxes[0].focus();
  });

  /* ---------- OTP inputs ---------- */
  function clearBoxes() {
    boxes.forEach(function (b) { b.value = ""; b.classList.remove("is-filled"); });
    otpWrap.classList.remove("is-invalid");
    otpError.textContent = "";
  }
  function fillFrom(index, digits) {
    digits.split("").forEach(function (d, i) {
      const box = boxes[index + i];
      if (box) { box.value = d; box.classList.add("is-filled"); }
    });
    const next = boxes[Math.min(index + digits.length, boxes.length - 1)];
    next.focus();
    if (boxes.every(function (b) { return b.value; })) otpForm.requestSubmit ? otpForm.requestSubmit() : otpForm.dispatchEvent(new Event("submit", { cancelable: true }));
  }

  boxes.forEach(function (box, i) {
    box.addEventListener("input", function () {
      const digits = box.value.replace(/\D/g, "");
      box.value = "";
      box.classList.remove("is-filled");
      otpWrap.classList.remove("is-invalid");
      otpError.textContent = "";
      if (digits) fillFrom(i, digits.slice(0, boxes.length - i));
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !box.value && i > 0) {
        boxes[i - 1].value = "";
        boxes[i - 1].classList.remove("is-filled");
        boxes[i - 1].focus();
        e.preventDefault();
      }
      if (e.key === "ArrowLeft" && i > 0) boxes[i - 1].focus();
      if (e.key === "ArrowRight" && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener("paste", function (e) {
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (!text) return;
      e.preventDefault();
      fillFrom(i, text.slice(0, boxes.length - i));
    });
    box.addEventListener("focus", function () { box.select(); });
  });

  function otpFail(message) {
    otpError.textContent = message;
    otpWrap.classList.remove("is-invalid");
    void otpWrap.offsetWidth;
    otpWrap.classList.add("is-invalid");
  }

  otpForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const entered = boxes.map(function (b) { return b.value; }).join("");
    if (entered.length < boxes.length) { otpFail("Enter all 6 digits."); boxes[entered.length].focus(); return; }
    if (Date.now() > otp.expires) { otpFail("This code has expired. Select Resend code to get a new one."); return; }
    if (entered !== otp.code) { otpFail("That code does not match. Check the email and try again."); return; }

    const key = email.value.trim().toLowerCase();
    const accounts = readAccounts();
    accounts[key] = { password: await hash(password.value), created: new Date().toISOString() };
    writeAccounts(accounts);
    saveSession(key);
    clearInterval(resendInterval);
    goToStep(3);
    S.toast("Email verified. Your account is ready.", "success");
  });

  resendBtn.addEventListener("click", function () {
    clearBoxes();
    sendCode();
    S.toast("New code sent to " + email.value.trim() + ".", "success");
    boxes[0].focus();
  });

  document.getElementById("change-email").addEventListener("click", function () {
    clearInterval(resendInterval);
    goToStep(1);
    email.focus();
  });

  goToStep(1);
})();
