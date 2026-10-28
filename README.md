# Scheduler — schedule tracker

## Folder structure
```
schedule_tracker_api.py   FastAPI app: page routes (top) + user app API (bottom section)
main_webpages/            public website: home, about, how it works, support, faq, blog, log in, sign up
  html_pages/  css/  javascript/  images/  database/
user_webpages/            logged-in app: dashboard, schedules, tasks, reminders, notifications, trash, settings, support
  html_pages/  css/  javascript/  images/  database/user_schema.sql
```
Each page has its own CSS and JavaScript file. Shared code: `main_webpages/javascript/global.js`
(public site) and `user_webpages/javascript/app.js` + `store.js` (user app).

## Run it
1. Create the database connector: `python main_webpages/database/db_create.py --host 127.0.0.1 --user root --password <pw> --database schedule_tracker_db`
2. Create the tables (once): `mysql -u root -p schedule_tracker_db < user_webpages/database/user_schema.sql`
3. Install: `pip install fastapi uvicorn jinja2 itsdangerous mysql-connector-python openpyxl reportlab`
4. While testing without an email server: set `SCHEDULER_DEV_MODE=1` (the password reset code is shown on the page).
5. Start, from this folder: `uvicorn schedule_tracker_api:app --reload`
6. Open http://127.0.0.1:8000 (redirects to /home).

## Before going live
- Set `SCHEDULER_SECRET_KEY` to a long random string and remove `SCHEDULER_DEV_MODE`.
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` so password reset codes and deadline emails are sent.

## Pages
| URL | Page |
|---|---|
| `/home`, `/about`, `/how%20it%20works`, `/support/v1`, `/faq`, `/blog` | public site |
| `/log%20in`, `/sign%20up` | log in / sign up (connected to `/api/auth/...`) |
| `/user/dashboard` … `/user/support` | user app (after logging in) |

See CHANGES.md for the list of fixes.
