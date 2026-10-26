/* =========================================================
   Scheduler — global script (shared by every page)
   Builds the navigation + footer once, so links are edited in one place.
   ========================================================= */
(function () {
  "use strict";

  const NAV_LINKS = [
    { href: "about.html", label: "About us" },
    { href: "how-it-works.html", label: "How it works" },
    { href: "support.html", label: "Support" },
    { href: "faq.html", label: "FAQ" },
    { href: "blog.html", label: "Blog" }
  ];

  const SOCIAL = {
    x: "https://x.com/",            // TODO: replace with your X account URL
    instagram: "https://instagram.com/" // TODO: replace with your Instagram account URL
  };

  const currentPage = location.pathname.split("/").pop() || "index.html";

  /* ---------- Navigation ---------- */
  function buildNav() {
    const header = document.getElementById("site-header");
    if (!header) return null;

    const links = NAV_LINKS.map(function (l) {
      const current = l.href === currentPage ? ' aria-current="page"' : "";
      return '<li><a href="' + l.href + '"' + current + ">" + l.label + "</a></li>";
    }).join("");

    header.className = "nav";
    header.innerHTML =
      '<div class="container">' +
        '<div class="nav__bar">' +
          '<a class="nav__logo" href="/main_webpages/html_pages/index.html" aria-label="Scheduler home">' +
            '<img src="main_webpages/images/logo.png" alt="Scheduler" width="847" height="317">' +
          "</a>" +
          '<div class="nav__menu" id="nav-menu">' +
            '<div class="nav__menu-inner">' +
              '<nav class="nav__panel" aria-label="Main">' +
                '<ul class="nav__links">' + links + "</ul>" +
                '<div class="nav__auth">' +
                  '<a class="btn btn--ghost" href="login.html">Log in</a>' +
                  '<a class="btn btn--yellow" href="signup.html">Sign up</a>' +
                "</div>" +
              "</nav>" +
            "</div>" +
          "</div>" +
          '<button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu">' +
            "<span></span><span></span><span></span>" +
          "</button>" +
        "</div>" +
      "</div>";

    const toggle = header.querySelector(".nav__toggle");
    const menu = header.querySelector(".nav__menu-inner");
    // The hamburger is only used at 960px wide and below (matches global.css)
    const mobile = window.matchMedia("(max-width: 960px)");

    function setOpen(open) {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      // Hidden (collapsed) menu links should not receive keyboard focus
      setMenuFocusable(menu, open || !mobile.matches);
    }
    setOpen(false);

    function onBreakpointChange() { setOpen(false); }
    if (mobile.addEventListener) mobile.addEventListener("change", onBreakpointChange);
    else mobile.addListener(onBreakpointChange);

    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-open"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("is-open") && !header.contains(e.target)) setOpen(false);
    });

    /* Transparent over the banner, solid once the user scrolls */
    function onScroll() {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return header;
  }

  function setMenuFocusable(menu, on) {
    menu.querySelectorAll("a, button").forEach(function (el) {
      if (on) el.removeAttribute("tabindex");
      else el.setAttribute("tabindex", "-1");
    });
  }

  /* ---------- Footer ---------- */
  function buildFooter() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const year = new Date().getFullYear();
    footer.className = "footer";
    footer.innerHTML =
      '<div class="container">' +
        '<div class="footer__top">' +
          '<div class="footer__brand">' +
            '<a href="index.html"><img src="assets/logo.png" alt="Scheduler" width="847" height="317"></a>' +
            "<small>&copy; " + year + " Scheduler. All rights reserved.</small>" +
          "</div>" +
          '<div class="footer__cols">' +
            "<div><h4>Product</h4><ul>" +
              '<li><a href="how-it-works.html">How it works</a></li>' +
              '<li><a href="blog.html">Blog</a></li>' +
              '<li><a href="signup.html">Create an account</a></li>' +
            "</ul></div>" +
            "<div><h4>Help</h4><ul>" +
              '<li><a href="support.html">Contact support</a></li>' +
              '<li><a href="faq.html">FAQ</a></li>' +
              '<li><a href="mailto:hello@scheduler.app">hello@scheduler.app</a></li>' +
            "</ul></div>" +
          "</div>" +
          '<div class="footer__social">' +
            "<span>Follow us</span>" +
            '<div class="footer__icons">' +
              '<a href="' + SOCIAL.x + '" target="_blank" rel="noopener" aria-label="Scheduler on X">' +
                '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5Z"/></svg>' +
              "</a>" +
              '<a href="' + SOCIAL.instagram + '" target="_blank" rel="noopener" aria-label="Scheduler on Instagram">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>' +
              "</a>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="footer__bottom">' +
          "<span>Made for students, teams and busy people who want calmer weeks.</span>" +
          "<span>Privacy policy &nbsp;|&nbsp; Terms of use &nbsp;|&nbsp; Version 1.0</span>" +
        "</div>" +
      "</div>";
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Toast (used by forms) ---------- */
  let toastTimer;
  function toast(message, type) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.className = "toast" + (type ? " toast--" + type : "");
    el.textContent = message;
    requestAnimationFrame(function () { el.classList.add("is-visible"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 4200);
  }

  /* ---------- Shared validation helpers ---------- */
  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }
  function setError(input, message) {
    const field = input.closest(".field");
    const slot = field && field.querySelector(".field__error");
    input.classList.toggle("is-invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (slot) slot.textContent = message || "";
  }

  window.Scheduler = { toast: toast, isEmail: isEmail, setError: setError };

  buildNav();
  buildFooter();
  initReveal();
})();
