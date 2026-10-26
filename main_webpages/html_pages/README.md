# Scheduler — schedule tracker website

Open `index.html` in a browser. No build step needed.

## Structure
- `*.html` — one file per page (index, about, how-it-works, support, faq, blog, login, signup)
- `css/global.css` — shared tokens, buttons, navigation, footer, forms
- `css/<page>.css` — styles for that page only
- `js/global.js` — builds the navigation and footer for every page (edit links here once)
- `js/<page>.js` — interactions for that page only
- `assets/logo.png` — the Scheduler logo

## Before going live
- Sign up runs in DEMO MODE: the 6-digit code is shown on screen and accounts are saved in the browser only.
  Connect your backend where you see `TODO` in `js/signup.js`, `js/login.js` and `js/support.js`.
- Set your X and Instagram links at the top of `js/global.js`.
- Placeholder text is marked with [Placeholder] / [History placeholder] / [Mission placeholder] etc.
- Seminar date for the countdown: `SEMINAR_DATE` in `js/home.js`.
