# What was fixed

## The "Not Found" error after logging in
`main_webpages/javascript/login.js` and `signup.js` were still the old browser-only demo.
They never contacted the server, and after a "successful" login they redirected to
`dashboard.html`, a page the server does not have, so FastAPI answered
`{"detail": "Not Found"}`. Both files are replaced with the versions that use the API:

| Action | Endpoint | Result |
|---|---|---|
| Sign up | `POST /api/auth/signup` | account created, logged in, sent to `/user/dashboard` |
| Log in | `POST /api/auth/login` | sent to `/user/dashboard` |
| Forgot my password | `POST /api/auth/forgot-password` then `POST /api/auth/reset-password` | new password, sent to `/user/dashboard` |
| Log out (user app) | `POST /api/auth/logout` | back to `/log in` |

`main_webpages/css/login.css`: styles added at the end for the code and password-reset screens.

## schedule_tracker_api.py
- `POST /support/v1` crashed with error 500: `cursor.execute(query, (data,))` passed the values
  wrapped in an extra tuple. Now `cursor.execute(query, data)`, commits only on success, and
  returns `{"status": "sent"}`.
- Two functions were named `home` and two named `support`. Renamed to `sign_up`,
  `support_page` and `support_submit` (routes unchanged).
- Added `GET /` → redirects to `/home`.
- The section added for the user app was an older copy without the password-reset endpoints;
  it is replaced with the current version.

## Broken links (12) and image (1)
- `main_webpages/javascript/global.js`: links were hard-coded to `http://127.0.0.1:8000/...`
  (breaks on any other address or port) and the footer linked to `/support`, which does not
  exist. Now relative links (`/about`, `/how%20it%20works`, `/support/v1`, `/log%20in`,
  `/sign%20up`). The footer logo path was missing its leading `/`. The menu now highlights
  the current page.
- `index.html`, `how-it-works.html`, `faq.html`: links to `signup.html`, `how-it-works.html`,
  `support.html` → `/sign%20up`, `/how%20it%20works`, `/support/v1`.
- `support.html`, `support.js`: hard-coded `127.0.0.1:8000` removed.

## Main support form
`main_webpages/javascript/support.js` only pretended to send. It now sends the message to
`POST /support/v1`, which stores it in the `support` table.

## Improved logo on the main website
- `main_webpages/images/`: `logo.png` replaced by `logo.svg` (full color), `logo-white.svg`
  (for the blue header before scrolling) and `logo-mark.svg` (icon only, browser tab).
- `main_webpages/javascript/global.js`: header shows the white logo, then the full-color logo
  after scrolling; footer uses the full-color logo.
- `main_webpages/css/global.css`: the old filter that turned the logo white is replaced by
  showing the right logo file (the filter would melt the new logo into a white shape).
- Every main page: browser tab icon now uses `logo-mark.svg`.

## One-time codes removed from sign up and log in
- `POST /api/auth/signup` now creates the account and logs the user in immediately.
- `POST /api/auth/verify-otp` and the two-step verification login were removed.
- `signup.html` / `signup.js` / `signup.css`: the "Enter your code" step is gone; the page is
  one form. `login.js`: the two-step code screen is gone.
- User app Settings › Security: the "Two-step verification" switch is removed.
- FAQ and How it works text updated.
- Still uses an emailed code: **Forgot my password** (`/api/auth/forgot-password`,
  `/api/auth/reset-password`), so nobody can reset someone else's password. The
  `email_otps` table is now only used for this.

## Clean-up
Removed `.DS_Store`, `__MACOSX` and `__pycache__` files; added them to `.gitignore`.
