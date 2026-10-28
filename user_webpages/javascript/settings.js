/* =========================================================
   Settings page
   Profile · Customization (theme + accessibility) · Security
   Notifications · Privacy · Help center · Log out
   ========================================================= */
(function () {
  "use strict";
  const S = window.SchedulerStore, U = S.util, A = window.App;
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const TABS = ["profile", "customization", "security", "notifications", "privacy", "help"];
  const COUNTRIES = ["PH", "US", "GB", "CA", "AU", "NZ", "SG", "MY", "ID", "TH", "VN", "JP", "KR", "CN", "HK", "TW", "IN", "PK", "BD", "AE", "SA", "QA", "KW", "EG", "ZA", "NG", "KE", "DE", "FR", "ES", "IT", "NL", "BE", "SE", "NO", "DK", "FI", "IE", "PT", "PL", "CH", "AT", "BR", "MX", "AR", "CL", "CO", "PE"];
  let tab = "profile";

  A.ready(function () {
    tab = TABS.indexOf(location.hash.slice(1)) !== -1 ? location.hash.slice(1) : "profile";
    document.querySelectorAll("[data-tab]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); show(a.dataset.tab, true); history.replaceState(null, "", "#" + a.dataset.tab); });
      a.addEventListener("keydown", function (e) {
        const i = TABS.indexOf(a.dataset.tab);
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); const n = document.querySelector('[data-tab="' + TABS[(i + 1) % TABS.length] + '"]'); n.focus(); n.click(); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); const n = document.querySelector('[data-tab="' + TABS[(i - 1 + TABS.length) % TABS.length] + '"]'); n.focus(); n.click(); }
      });
    });
    window.addEventListener("hashchange", function () { if (TABS.indexOf(location.hash.slice(1)) !== -1) show(location.hash.slice(1)); });
    $("#settings-logout").addEventListener("click", A.logout);
    show(tab);
  });

  function show(name, focus) {
    tab = name;
    document.querySelectorAll("[data-tab]").forEach(function (a) {
      const on = a.dataset.tab === name;
      a.setAttribute("aria-selected", String(on));
      a.tabIndex = on ? 0 : -1;
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    const box = $("#settings-panels");
    box.innerHTML = '<section class="card spanel" role="tabpanel" id="panel-' + name + '" tabindex="-1">' + PANELS[name]() + "</section>";
    WIRE[name] && WIRE[name]($("#panel-" + name));
    if (focus) $("#panel-" + name).focus({ preventScroll: true });
  }

  /* ---------- small builders ---------- */
  function sw(id, title, sub, checked) {
    return '<label class="switch" for="' + id + '"><span class="switch__text"><strong>' + title + "</strong>" + (sub ? "<small>" + sub + "</small>" : "") + "</span>" +
      '<input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + '><span class="switch__track" aria-hidden="true"></span></label>';
  }
  function a11y() { return S.state.settings.a11y; }
  function saveA11y(patch) { return S.saveSettings({ a11y: patch }); }

  const PANELS = {
    profile: function () {
      const p = S.state.profile;
      let names;
      try { names = new Intl.DisplayNames(undefined, { type: "region" }); } catch (e) { names = { of: function (c) { return c; } }; }
      const countries = COUNTRIES.map(function (c) { return { c: c, n: names.of(c) }; }).sort(function (a, b) { return a.n < b.n ? -1 : 1; });
      let zones = [];
      try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) { zones = ["UTC", "Asia/Manila", "America/New_York", "Europe/London", "Asia/Tokyo"]; }
      const tz = S.state.settings.timezone;
      return '<h2>Profile</h2><p class="card__sub">This information is used for greetings and emails.</p>' +
        '<div class="profile-hero"><span class="profile-hero__avatar" aria-hidden="true">' + A.esc(((p.name || p.email || "?").trim()[0] || "?").toUpperCase()) + '</span><div><strong>' + A.esc(p.name || "Your name") + '</strong><span class="muted">' + A.esc(p.email || "No email yet") + "</span>" +
        '<span class="badge ' + (S.state.mode === "server" ? "badge--finished" : "badge--pending") + '">' + (S.state.mode === "server" ? "Synced with your account" : "Saved in this browser") + "</span></div></div>" +
        '<form id="profile-form" novalidate><div class="row">' +
          '<div class="field"><label class="label" for="pf-name">Full name</label><input class="input" id="pf-name" autocomplete="name" value="' + A.esc(p.name) + '"><span class="field__error"></span></div>' +
          '<div class="field"><label class="label" for="pf-email">Email</label><input class="input" id="pf-email" type="email" autocomplete="email" value="' + A.esc(p.email) + '"' + (S.state.mode === "server" ? " readonly aria-describedby=\"pf-email-hint\"" : "") + '><span class="hint" id="pf-email-hint">' + (S.state.mode === "server" ? "Contact support to change the email on your account." : "") + '</span><span class="field__error"></span></div>' +
        "</div><div class=\"row\">" +
          '<div class="field"><label class="label" for="pf-phone">Contact number</label><input class="input" id="pf-phone" type="tel" autocomplete="tel" value="' + A.esc(p.phone) + '"><span class="field__error"></span></div>' +
          '<div class="field"><label class="label" for="pf-country">Country</label><select class="select" id="pf-country"><option value="">Choose a country</option>' + countries.map(function (c) { return '<option value="' + c.c + '"' + (p.country === c.c ? " selected" : "") + ">" + A.esc(c.n) + "</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<div class="field"><label class="label" for="pf-tz">Time zone</label><select class="select" id="pf-tz" aria-describedby="pf-tz-hint"><option value="auto"' + (tz === "auto" ? " selected" : "") + ">Automatic (" + A.esc(Intl.DateTimeFormat().resolvedOptions().timeZone) + ")</option>" +
          zones.map(function (z) { return '<option value="' + z + '"' + (tz === z ? " selected" : "") + ">" + z.replace(/_/g, " ") + "</option>"; }).join("") + '</select><span class="hint" id="pf-tz-hint">Used for your good morning / afternoon / evening greeting and for deadline emails.</span></div>' +
        '<button type="submit" class="btn btn--yellow">Save profile</button></form>';
    },

    customization: function () {
      const st = S.state.settings, a = a11y();
      const themes = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
      return '<h2>Customization</h2><p class="card__sub">Changes apply right away.</p>' +
        '<h3 class="sgroup">Theme</h3><div class="theme-cards" role="radiogroup" aria-label="Theme">' + themes.map(function (t) {
          return '<label class="theme-card theme-card--' + t[0] + '"><input type="radio" name="theme" value="' + t[0] + '"' + (st.theme === t[0] ? " checked" : "") + '><span class="theme-card__prev" aria-hidden="true"><i></i><i></i><i></i></span><span class="theme-card__name">' + t[1] + "</span></label>";
        }).join("") + "</div>" +
        '<div class="row"><div class="field"><label class="label" for="cz-week">Week starts on</label><select class="select" id="cz-week"><option value="1"' + (st.weekStart === 1 ? " selected" : "") + '>Monday</option><option value="0"' + (st.weekStart === 0 ? " selected" : "") + ">Sunday</option></select></div>" +
        '<div class="field"><label class="label" for="cz-busy">A day is "too busy" after</label><select class="select" id="cz-busy" aria-describedby="cz-busy-hint">' + [4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (h) { return '<option value="' + h + '"' + (st.busyThresholdHours === h ? " selected" : "") + ">" + h + " hours booked</option>"; }).join("") + '</select><span class="hint" id="cz-busy-hint">Used for schedule-moving suggestions.</span></div></div>' +

        '<h3 class="sgroup">Accessibility · Vision</h3>' +
        '<div class="field"><label class="label" for="cz-cb">Color-blind friendly colors</label><select class="select" id="cz-cb">' +
          [["none", "Off (standard colors)"], ["deuteranopia", "Deuteranopia (green-weak)"], ["protanopia", "Protanopia (red-weak)"], ["tritanopia", "Tritanopia (blue-weak)"], ["achromatopsia", "Achromatopsia (no color, grayscale)"]].map(function (o) {
            return '<option value="' + o[0] + '"' + (a.colorblind === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
          }).join("") + "</select>" +
          '<div class="cb-preview" aria-label="Status color preview"><span class="badge badge--finished">Finished</span><span class="badge badge--pending">Pending</span><span class="badge badge--cancelled">Cancelled</span><span class="badge badge--overtime">Overtime</span></div></div>' +
        sw("cz-patterns", "Patterns on charts", "Adds stripes and dots to pie slices so they can be told apart without color. Always on in color-blind modes.", a.chartPatterns) +
        sw("cz-contrast", "High contrast", "Stronger borders and pure black / white surfaces for low vision.", a.highContrast) +
        '<div class="field range-field"><label class="label" for="cz-size">Text size <output id="cz-size-out">' + a.fontScale + '%</output></label><input type="range" id="cz-size" min="90" max="160" step="10" value="' + a.fontScale + '"></div>' +
        sw("cz-bold", "Bold text", "Makes body text heavier and easier to read.", a.bold) +
        sw("cz-underline", "Underline links", "Shows every link with an underline.", a.underlineLinks) +

        '<h3 class="sgroup">Accessibility · Hearing</h3>' +
        '<p class="hint">Scheduler never relies on sound. Every alert is also shown as text.</p>' +
        sw("cz-visual", "Visual alerts", "Flashes the screen border (and vibrates on phones) when a notification arrives.", a.visualAlerts) +
        sw("cz-text", "Pop-up text for every notification", "Shows the full notification text at the top of the screen.", a.textAlerts !== false) +

        '<h3 class="sgroup">Accessibility · Motion &amp; reading</h3>' +
        sw("cz-motion", "Reduce motion", "Turns off animations and sliding effects.", a.reduceMotion) +
        sw("cz-dyslexia", "Reading-friendly spacing", "Wider letter, word and line spacing (helpful for dyslexia).", a.dyslexia) +
        '<button type="button" class="btn btn--ghost" id="cz-reset">Reset accessibility settings</button>';
    },

    security: function () {
      return '<h2>Security</h2><p class="card__sub">Keep your account safe.</p>' +
        '<h3 class="sgroup">Change password</h3>' +
        (S.state.mode !== "server" ? '<p class="notice notice--info">' + A.icon("warning") + "<span>Log in to your account to change your password.</span></p>" : "") +
        '<form id="pw-form" novalidate>' +
          '<div class="field"><label class="label" for="pw-current">Current password</label><input class="input" id="pw-current" type="password" autocomplete="current-password"><span class="field__error"></span></div>' +
          '<div class="row"><div class="field"><label class="label" for="pw-new">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password" aria-describedby="pw-hint"><span class="hint" id="pw-hint">8 or more characters with a letter and a number.</span><span class="field__error"></span></div>' +
          '<div class="field"><label class="label" for="pw-confirm">Confirm new password</label><input class="input" id="pw-confirm" type="password" autocomplete="new-password"><span class="field__error"></span></div></div>' +
          '<button type="submit" class="btn btn--yellow"' + (S.state.mode !== "server" ? " disabled" : "") + ">Update password</button></form>" +
        '<h3 class="sgroup">Sign-in</h3>' +
        '<div class="sec-row"><div><strong>This device</strong><span class="muted">' + A.esc(navigator.platform || "Browser") + " · active now</span></div><button type=\"button\" class=\"btn btn--sm btn--danger\" id=\"sc-logout\">" + A.icon("logout") + "Log out</button></div>";
    },

    notifications: function () {
      const ns = S.state.settings.notifications;
      const kinds = [["near", "Task or reminder due soon", "Before a task's end time or a reminder's deadline."], ["overdue", "Task not finished in time", "When a task passes its end time without being finished."], ["early", "Task finished before the deadline", "A small win when you finish early."], ["reminder", "Reminders", "When a reminder is about to be due or is overdue."], ["recommendation", "Schedule suggestions", "When a day becomes too busy and we suggest moving something."]];
      return '<h2>Notifications</h2><p class="card__sub">Choose how and when Scheduler contacts you.</p>' +
        '<h3 class="sgroup">Delivery</h3>' +
        sw("nt-inapp", "In-app notifications", "Show notifications inside Scheduler.", ns.inApp) +
        sw("nt-email", "Email notifications", "Send the same alerts to " + A.esc(S.state.profile.email || "your email") + ".", ns.email) +
        '<div class="field"><label class="label" for="nt-lead">Warn me before a deadline</label><select class="select" id="nt-lead">' + [10, 15, 30, 60, 120].map(function (m) { return '<option value="' + m + '"' + (+ns.leadMinutes === m ? " selected" : "") + ">" + (m < 60 ? m + " minutes" : m / 60 + " hour" + (m > 60 ? "s" : "")) + " before</option>"; }).join("") + "</select></div>" +
        '<h3 class="sgroup">What to notify me about</h3>' +
        kinds.map(function (k) { return sw("nt-k-" + k[0], k[1], k[2], ns.kinds[k[0]] !== false); }).join("") +
        '<div class="sec-row"><div><strong>Test your email</strong><span class="muted">Sends a sample notification to your inbox.</span></div><button type="button" class="btn btn--sm" id="nt-test">Send test email</button></div>';
    },

    privacy: function () {
      const pv = S.state.settings.privacy || {};
      return '<h2>Privacy</h2><p class="card__sub">Your schedules belong to you.</p>' +
        sw("pv-analytics", "Share anonymous usage data", "Helps us improve Scheduler. Never includes your schedules or tasks.", pv.analytics) +
        '<div class="sec-row"><div><strong>Download your data</strong><span class="muted">All schedules, tasks, reminders and settings as a JSON file.</span></div><button type="button" class="btn btn--sm" id="pv-export">' + A.icon("download") + "Download</button></div>" +
        '<div class="danger-zone"><h3>Delete account</h3><p>This permanently deletes your account, schedules, reminders and notifications. This cannot be undone.</p>' +
        '<div class="field"><label class="label" for="pv-confirm">Type DELETE to confirm</label><input class="input" id="pv-confirm" autocomplete="off"></div>' +
        '<button type="button" class="btn btn--danger" id="pv-delete" disabled>Delete my account</button></div>';
    },

    help: function () {
      const faq = [
        ["How do I create a schedule?", "Press Create in the sidebar, choose Create a schedule, pick a day, add a label and colors, then add tasks to the timetable and press Save schedule."],
        ["What happens when two tasks overlap?", "Scheduler warns you before saving. You can move the new task to the next free time, overwrite the old one, or cancel."],
        ["Where do removed schedules go?", "To the Trash. You can recover them for 5 days. After that they are deleted automatically."],
        ["What does Overtime mean?", "A task that passed its end time without being marked as done. You'll also get an email if email notifications are on."],
        ["How do I make Scheduler easier to see or read?", "Open Settings › Customization. You can turn on color-blind friendly colors, chart patterns, high contrast, larger text, visual alerts and reduced motion."],
        ["Can I download a schedule?", "Yes. Open a schedule, press the three dots in its top right, then Download and choose PDF, Excel, JSON or CSV."]
      ];
      return '<h2>Help center</h2><p class="card__sub">Quick answers to common questions.</p>' +
        '<div class="faq">' + faq.map(function (f) { return "<details><summary>" + A.esc(f[0]) + "</summary><p>" + A.esc(f[1]) + "</p></details>"; }).join("") + "</div>" +
        '<div class="help-actions"><a class="btn btn--yellow" href="' + A.url("support") + '">' + A.icon("help") + 'Contact support</a><a class="btn" href="/faq">Read the full FAQ</a></div>';
    }
  };

  const WIRE = {
    profile: function (root) {
      $("#profile-form", root).addEventListener("submit", async function (e) {
        e.preventDefault();
        const name = $("#pf-name", root), email = $("#pf-email", root), phone = $("#pf-phone", root);
        let ok = true;
        const err = function (el, msg) { el.classList.toggle("is-invalid", !!msg); el.closest(".field").querySelector(".field__error").textContent = msg || ""; if (msg) ok = false; };
        err(name, name.value.trim().length < 2 ? "Enter your name." : "");
        err(email, email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) ? "Enter a valid email." : "");
        err(phone, phone.value && !/^\+?[\d\s()-]{7,20}$/.test(phone.value.trim()) ? "Enter a valid contact number." : "");
        if (!ok) { root.querySelector(".is-invalid").focus(); return; }
        try {
          await S.saveProfile({ name: name.value.trim(), email: email.value.trim(), phone: phone.value.trim(), country: $("#pf-country", root).value });
          await S.saveSettings({ timezone: $("#pf-tz", root).value });
          A.toast("Profile saved.", { type: "success" });
          show("profile");
        } catch (e2) { A.toast(e2.message, { type: "error" }); }
      });
    },
    customization: function (root) {
      root.querySelectorAll('input[name="theme"]').forEach(function (r) { r.addEventListener("change", function () { S.saveSettings({ theme: r.value }); }); });
      $("#cz-week", root).addEventListener("change", function (e) { S.saveSettings({ weekStart: +e.target.value }); });
      $("#cz-busy", root).addEventListener("change", function (e) { S.saveSettings({ busyThresholdHours: +e.target.value }); });
      $("#cz-cb", root).addEventListener("change", function (e) { saveA11y({ colorblind: e.target.value }); });
      const map = { "cz-patterns": "chartPatterns", "cz-contrast": "highContrast", "cz-bold": "bold", "cz-underline": "underlineLinks", "cz-visual": "visualAlerts", "cz-text": "textAlerts", "cz-motion": "reduceMotion", "cz-dyslexia": "dyslexia" };
      Object.keys(map).forEach(function (id) {
        $("#" + id, root).addEventListener("change", function (e) {
          const p = {}; p[map[id]] = e.target.checked; saveA11y(p);
          if (id === "cz-visual" && e.target.checked) { A.toast("Visual alerts are on. This is how a new notification looks."); document.body.insertAdjacentHTML("beforeend", '<div class="visual-alert" aria-hidden="true"></div>'); setTimeout(function () { const v = document.querySelector(".visual-alert"); if (v) v.remove(); }, 2600); }
        });
      });
      const size = $("#cz-size", root), out = $("#cz-size-out", root);
      size.addEventListener("input", function () { out.textContent = size.value + "%"; document.documentElement.style.setProperty("--font-scale", size.value / 100); });
      size.addEventListener("change", function () { saveA11y({ fontScale: +size.value }); });
      $("#cz-reset", root).addEventListener("click", async function () {
        await S.saveSettings({ a11y: { colorblind: "none", highContrast: false, fontScale: 100, bold: false, underlineLinks: false, reduceMotion: false, dyslexia: false, chartPatterns: false, visualAlerts: false, textAlerts: true } });
        A.toast("Accessibility settings reset.");
        show("customization");
      });
    },
    security: function (root) {
      $("#pw-form", root).addEventListener("submit", async function (e) {
        e.preventDefault();
        const cur = $("#pw-current", root), nw = $("#pw-new", root), cf = $("#pw-confirm", root);
        let ok = true;
        const err = function (el, msg) { el.classList.toggle("is-invalid", !!msg); el.closest(".field").querySelector(".field__error").textContent = msg || ""; if (msg) ok = false; };
        err(cur, cur.value ? "" : "Enter your current password.");
        err(nw, nw.value.length >= 8 && /\d/.test(nw.value) && /[a-z]/i.test(nw.value) ? "" : "Use 8 or more characters with a letter and a number.");
        err(cf, cf.value === nw.value ? "" : "The passwords do not match.");
        if (!ok) { root.querySelector(".is-invalid").focus(); return; }
        try { await S.changePassword(cur.value, nw.value); A.toast("Password updated.", { type: "success" }); e.target.reset(); }
        catch (e2) { A.toast(e2.message, { type: "error" }); }
      });
      $("#sc-logout", root).addEventListener("click", A.logout);
    },
    notifications: function (root) {
      const ns = function () { return JSON.parse(JSON.stringify(S.state.settings.notifications)); };
      $("#nt-inapp", root).addEventListener("change", function (e) { const n = ns(); n.inApp = e.target.checked; S.saveSettings({ notifications: n }); });
      $("#nt-email", root).addEventListener("change", function (e) { const n = ns(); n.email = e.target.checked; S.saveSettings({ notifications: n }); A.toast(e.target.checked ? "Emails are on." : "Emails are off. You'll only see notifications here."); });
      $("#nt-lead", root).addEventListener("change", function (e) { const n = ns(); n.leadMinutes = +e.target.value; S.saveSettings({ notifications: n }); });
      root.querySelectorAll('[id^="nt-k-"]').forEach(function (cb) {
        cb.addEventListener("change", function () { const n = ns(); n.kinds[cb.id.slice(5)] = cb.checked; S.saveSettings({ notifications: n }); });
      });
      $("#nt-test", root).addEventListener("click", async function () {
        try { await S.sendTestEmail(); A.toast("Test email sent to " + S.state.profile.email + ".", { type: "success" }); }
        catch (e) { A.toast(e.message, { type: "error" }); }
      });
    },
    privacy: function (root) {
      $("#pv-analytics", root).addEventListener("change", function (e) { S.saveSettings({ privacy: { analytics: e.target.checked } }); });
      $("#pv-export", root).addEventListener("click", function () { A.download("scheduler-data-" + U.now().date + ".json", JSON.stringify(S.exportAll(), null, 2), "application/json"); });
      const conf = $("#pv-confirm", root), del = $("#pv-delete", root);
      conf.addEventListener("input", function () { del.disabled = conf.value.trim() !== "DELETE"; });
      del.addEventListener("click", async function () {
        const ok = await A.confirm({ message: "Delete your account and all of its data forever?", icon: "trash", danger: true, confirmText: "Delete forever" });
        if (!ok) return;
        try {
          await S.deleteAccount();
          A.toast("Your account was deleted.");
          setTimeout(function () { location.href = location.protocol === "file:" ? "dashboard.html" : "/home"; }, 1200);
        } catch (e) { A.toast(e.message, { type: "error" }); }
      });
    }
  };
})();
