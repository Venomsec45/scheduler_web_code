from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from fastapi.responses import HTMLResponse, Response, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from main_webpages.database.db_connector import connect_to_db

app = FastAPI()

main_web_templates = Jinja2Templates(directory="main_webpages/html_pages")

app.mount("/main_webpages/css", StaticFiles(directory="main_webpages/css"), name="css")
app.mount("/main_webpages/javascript", StaticFiles(directory="main_webpages/javascript"), name="javascript")
app.mount("/main_webpages/images", StaticFiles(directory="main_webpages/images"), name="images")

class SupportBody(BaseModel):
    topic: str
    name: str
    email: str
    contact_number: str
    message: str

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/home")

@app.get("/home", response_class=HTMLResponse)
async def home(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.get("/about", response_class=HTMLResponse)
async def about(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="about.html"
    )

@app.get("/how it works", response_class=HTMLResponse)
async def how_it_works(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="how-it-works.html"
    )

@app.get("/support/v1", response_class=HTMLResponse)
async def support_page(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="support.html"
    )

@app.post("/support/v1")
def support_submit(supportbody: SupportBody):
    """Saves a message from the support form into the `support` table."""
    db = connect_to_db()
    cursor = db.cursor()
    try:
        query = "INSERT INTO support (topic, name, email, contact_number, message) VALUES (%s, %s, %s, %s, %s)"
        data = (supportbody.topic, supportbody.name, supportbody.email, supportbody.contact_number, supportbody.message)
        cursor.execute(query, data)
        db.commit()
        return JSONResponse({"status": "sent"})
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()

@app.get("/faq", response_class=HTMLResponse)
async def faq(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="faq.html"
    )

@app.get("/blog", response_class=HTMLResponse)
async def blog(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="blog.html"
    )

@app.get("/log in", response_class=HTMLResponse)
async def log_in(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="login.html"
    )

@app.get("/sign up", response_class=HTMLResponse)
async def sign_up(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="signup.html"
    )


# =====================================================================
# ADDED: user webpages + JSON API for the Scheduler user app
# ---------------------------------------------------------------------
# Everything below was appended. Nothing above this line was changed.
#
# Environment variables (all optional except SCHEDULER_SECRET_KEY in production):
#   SCHEDULER_SECRET_KEY   secret used to sign the login session cookie
#   SCHEDULER_HTTPS        "1" to send the session cookie over HTTPS only
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_SSL
#                          mail server used for password reset codes and deadline emails
#   SCHEDULER_DEV_MODE     "1" to return the password reset code in the API response
#                          when no SMTP server is configured (testing only)
#   SCHEDULER_APP_URL      public URL used in email links, e.g. https://scheduler.app
#
# Database tables: see user_webpages/database/user_schema.sql
# Extra packages: itsdangerous (sessions), openpyxl (Excel export),
#                 reportlab (PDF export)
# =====================================================================
import asyncio
import csv
import datetime as _dt
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from starlette.middleware.sessions import SessionMiddleware

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9
    ZoneInfo = None

log = logging.getLogger("scheduler")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SCHEDULER_SECRET_KEY", "change-this-secret-key"),
    session_cookie="scheduler_session",
    max_age=60 * 60 * 24 * 14,
    same_site="lax",
    https_only=os.environ.get("SCHEDULER_HTTPS", "0") == "1",
)

user_web_templates = Jinja2Templates(directory="user_webpages/html_pages")
app.mount("/user_webpages/css", StaticFiles(directory="user_webpages/css"), name="user_css")
app.mount("/user_webpages/javascript", StaticFiles(directory="user_webpages/javascript"), name="user_javascript")
app.mount("/user_webpages/images", StaticFiles(directory="user_webpages/images"), name="user_images")

TRASH_DAYS = 5
URGENCY_LEVELS = ("optional", "normal", "medium", "high", "urgent")
TASK_STATUSES = ("pending", "finished", "cancelled")
TIME_RE = re.compile(r"^([01]\d|2[0-4]):([0-5]\d)$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

DEFAULT_USER_SETTINGS: Dict[str, Any] = {
    "theme": "system",
    "timezone": "auto",
    "weekStart": 1,
    "busyThresholdHours": 8,
    "a11y": {
        "colorblind": "none", "highContrast": False, "fontScale": 100, "bold": False,
        "underlineLinks": False, "reduceMotion": False, "dyslexia": False,
        "chartPatterns": False, "visualAlerts": False, "textAlerts": True,
    },
    "notifications": {
        "inApp": True, "email": True, "leadMinutes": 30,
        "kinds": {"near": True, "overdue": True, "early": True, "reminder": True, "recommendation": True},
    },
    "dashboard": {"charts": {"status": True, "days": True, "weeks": True, "hours": False}},
    "privacy": {"analytics": False, "showProfileToTeam": False},
    "dismissedRecs": [],
}


# ---------------------------------------------------------------------
# Database helpers (work with mysql-connector and PyMySQL style drivers)
# ---------------------------------------------------------------------
def _row_to_dict(cursor, row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return {col[0]: value for col, value in zip(cursor.description, row)}


class _Tx:
    """Opens a connection with connect_to_db(), commits on success, rolls back on error."""

    def __enter__(self):
        self.db = connect_to_db()
        self.cur = self.db.cursor()
        return self

    def one(self, sql, params=()):
        self.cur.execute(sql, params)
        return _row_to_dict(self.cur, self.cur.fetchone())

    def all(self, sql, params=()):
        self.cur.execute(sql, params)
        return [_row_to_dict(self.cur, r) for r in self.cur.fetchall()]

    def run(self, sql, params=()):
        self.cur.execute(sql, params)
        return self.cur.lastrowid

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                self.db.commit()
            else:
                self.db.rollback()
        finally:
            try:
                self.cur.close()
            finally:
                self.db.close()
        return False


def _utcnow():
    return _dt.datetime.utcnow().replace(microsecond=0)


def _iso(value):
    if value is None:
        return None
    if isinstance(value, (_dt.datetime, _dt.date)):
        return value.isoformat()
    return str(value)


def _json_load(text, default):
    if not text:
        return default
    if isinstance(text, (dict, list)):
        return text
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return default


def _merge(base, extra):
    out = json.loads(json.dumps(base))
    if not isinstance(extra, dict):
        return out
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def _model_dump(model):
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def _to_min(t):
    h, m = str(t)[:5].split(":")
    return int(h) * 60 + int(m)


def _fmt_time(t):
    minutes = _to_min(t)
    h, m = divmod(minutes, 60)
    suffix = "PM" if 12 <= h < 24 else "AM"
    h = h % 12 or 12
    return f"{h}:{m:02d} {suffix}" if m else f"{h} {suffix}"


# ---------------------------------------------------------------------
# Passwords, sessions, one-time codes
# ---------------------------------------------------------------------
def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 260000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def _check_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        test = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(test, digest)
    except (ValueError, AttributeError):
        return False


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _password_ok(password: str) -> bool:
    return len(password) >= 8 and re.search(r"\d", password) and re.search(r"[A-Za-z]", password)


def current_user_id(request: Request) -> int:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    # "Keep me logged in" unchecked: the session ends 12 hours after login
    expires = request.session.get("expires_at")
    if expires and _dt.datetime.utcnow().timestamp() > expires:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Your session has ended. Please log in again.")
    return int(user_id)


def _login_session(request: Request, user_id: int, remember: bool = True) -> None:
    request.session.clear()
    request.session["user_id"] = int(user_id)
    if not remember:
        request.session["expires_at"] = _dt.datetime.utcnow().timestamp() + 12 * 3600


# ---------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------
def _send_email(to_address: str, subject: str, text: str, html: Optional[str] = None) -> bool:
    host = os.environ.get("SMTP_HOST")
    if not host or not to_address:
        log.warning("Email not sent (SMTP_HOST is not set): %s -> %s", subject, to_address)
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "no-reply@scheduler.app"))
    msg["To"] = to_address
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    port = int(os.environ.get("SMTP_PORT", "587"))
    try:
        if os.environ.get("SMTP_USE_SSL", "0") == "1":
            server = smtplib.SMTP_SSL(host, port, timeout=20)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            server.starttls()
        with server:
            if os.environ.get("SMTP_USER"):
                server.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
            server.send_message(msg)
        return True
    except Exception:  # never let email problems break a request
        log.exception("Could not send email to %s", to_address)
        return False


def _email_html(title: str, body: str, button_text: str = "Open Scheduler", path: str = "/user/dashboard") -> str:
    url = os.environ.get("SCHEDULER_APP_URL", "").rstrip("/") + path
    safe = lambda s: (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    return f"""<div style="background:#FFF9EC;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:auto;background:#fff;border:3px solid #000;border-radius:16px;box-shadow:6px 6px 0 #000">
    <div style="background:#FFDE59;border-bottom:3px solid #000;border-radius:13px 13px 0 0;padding:14px 20px;font-weight:900;font-size:18px">Scheduler</div>
    <div style="padding:20px">
      <h1 style="margin:0 0 10px;font-size:22px">{safe(title)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">{safe(body)}</p>
      <a href="{safe(url)}" style="display:inline-block;background:#FF8159;color:#000;text-decoration:none;font-weight:800;padding:10px 22px;border:3px solid #000;border-radius:999px;box-shadow:3px 3px 0 #000">{safe(button_text)}</a>
    </div>
  </div>
  <p style="text-align:center;color:#555;font-size:12px">You can change which emails you get in Settings › Notifications.</p>
</div>"""


def _send_otp(email: str, code: str, purpose: str) -> bool:
    """Emails a password reset code (the only place codes are still used)."""
    title = "Your Scheduler password reset code"
    body = f"Your password reset code is {code}. It expires in 5 minutes. If you did not ask to reset your password, you can ignore this email."
    return _send_email(email, title, body, _email_html(title, body, "Go to Scheduler", "/home"))


# ---------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------
def _user_settings(tx: _Tx, user_id: int) -> Dict[str, Any]:
    row = tx.one("SELECT settings_json FROM user_settings WHERE user_id = %s", (user_id,))
    return _merge(DEFAULT_USER_SETTINGS, _json_load(row["settings_json"] if row else None, {}))


def _profile(user: Dict[str, Any]) -> Dict[str, Any]:
    return {"name": user.get("name") or "", "email": user.get("email") or "", "phone": user.get("phone") or "", "country": user.get("country") or ""}


def _task_out(t: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(t["id"]), "start": str(t["start_time"])[:5], "end": str(t["end_time"])[:5],
        "label": t["label"], "description": t.get("description") or "", "urgency": t["urgency"],
        "status": t["status"], "completed_at": _iso(t.get("completed_at")),
        "notified_near": bool(t.get("notified_near")), "notified_over": bool(t.get("notified_over")),
    }


def _schedule_out(s: Dict[str, Any], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "id": str(s["id"]), "label": s["label"], "description": s.get("description") or "",
        "date": _iso(s["schedule_date"])[:10], "color": s.get("color") or "#FFDE59",
        "background": _json_load(s.get("background_json"), {"type": "none", "value": ""}),
        "pinned": bool(s.get("pinned")), "deleted_at": _iso(s.get("deleted_at")),
        "created_at": _iso(s.get("created_at")), "updated_at": _iso(s.get("updated_at")),
        "activity": _json_load(s.get("activity_json"), []),
        "tasks": sorted([_task_out(t) for t in tasks], key=lambda t: _to_min(t["start"])),
    }


def _load_schedule(tx: _Tx, user_id: int, schedule_id) -> Dict[str, Any]:
    s = tx.one("SELECT * FROM schedules WHERE id = %s AND user_id = %s", (schedule_id, user_id))
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    tasks = tx.all("SELECT * FROM tasks WHERE schedule_id = %s", (s["id"],))
    return _schedule_out(s, tasks)


def _all_schedules(tx: _Tx, user_id: int) -> List[Dict[str, Any]]:
    rows = tx.all("SELECT * FROM schedules WHERE user_id = %s ORDER BY schedule_date", (user_id,))
    tasks = tx.all("SELECT * FROM tasks WHERE user_id = %s", (user_id,))
    by_schedule: Dict[Any, List] = {}
    for t in tasks:
        by_schedule.setdefault(t["schedule_id"], []).append(t)
    return [_schedule_out(s, by_schedule.get(s["id"], [])) for s in rows]


def _reminder_out(r: Dict[str, Any]) -> Dict[str, Any]:
    deadline = r["deadline"]
    deadline = deadline.strftime("%Y-%m-%dT%H:%M") if isinstance(deadline, _dt.datetime) else str(deadline)[:16].replace(" ", "T")
    return {
        "id": str(r["id"]), "label": r["label"], "description": r.get("description") or "",
        "deadline": deadline, "done": bool(r.get("done")), "deleted_at": _iso(r.get("deleted_at")),
        "created_at": _iso(r.get("created_at")), "notified_near": bool(r.get("notified_near")),
        "notified_over": bool(r.get("notified_over")),
    }


def _notification_out(n: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(n["id"]), "kind": n["kind"], "title": n["title"], "body": n["body"],
        "ref": {"type": n["ref_type"], "id": str(n["ref_id"])} if n.get("ref_type") else None,
        "read": bool(n.get("is_read")), "emailed": bool(n.get("emailed")), "created_at": _iso(n.get("created_at")),
    }


def _stamp(tx: _Tx, schedule_id, text: str):
    row = tx.one("SELECT activity_json FROM schedules WHERE id = %s", (schedule_id,))
    activity = _json_load(row["activity_json"] if row else None, [])
    activity.insert(0, {"at": _utcnow().isoformat() + "Z", "text": text})
    tx.run("UPDATE schedules SET activity_json = %s, updated_at = %s WHERE id = %s", (json.dumps(activity[:40]), _utcnow(), schedule_id))


def _notify(tx: _Tx, user: Dict[str, Any], settings: Dict[str, Any], kind: str, title: str, body: str,
            ref_type: Optional[str] = None, ref_id=None, path: str = "/user/dashboard") -> None:
    """Saves an in-app notification and/or emails the user, following their notification settings."""
    ns = settings.get("notifications", {})
    wanted = ns.get("kinds", {}).get(kind, True)
    if not wanted:
        return
    emailed = False
    if ns.get("email", True):
        emailed = _send_email(user["email"], title, body, _email_html(title, body, path=path))
    if ns.get("inApp", True) or emailed:
        tx.run(
            "INSERT INTO notifications (user_id, kind, title, body, ref_type, ref_id, is_read, emailed, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s)",
            (user["id"], kind, title, body, ref_type, ref_id, 1 if emailed else 0, _utcnow()),
        )


def _user_tz(user: Dict[str, Any], settings: Dict[str, Any]):
    name = settings.get("timezone")
    if not name or name == "auto":
        name = user.get("timezone") or "UTC"
    if ZoneInfo is None:
        return None
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")


def _local_now(user, settings) -> _dt.datetime:
    tz = _user_tz(user, settings)
    now = _dt.datetime.now(tz) if tz else _dt.datetime.utcnow()
    return now.replace(tzinfo=None, second=0, microsecond=0)


# ---------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------
class SignupBody(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""
    timezone: Optional[str] = "UTC"


class EmailBody(BaseModel):
    email: str


class LoginBody(BaseModel):
    email: str
    password: str
    remember: bool = True


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    email: str
    code: str
    new_password: str


class TaskIn(BaseModel):
    id: Optional[str] = None
    start: str
    end: str
    label: str
    description: Optional[str] = ""
    urgency: Optional[str] = "normal"
    status: Optional[str] = "pending"
    completed_at: Optional[str] = None


class ScheduleIn(BaseModel):
    date: str
    label: str
    description: Optional[str] = ""
    color: Optional[str] = "#FFDE59"
    background: Optional[Dict[str, Any]] = None
    tasks: List[TaskIn] = []


class OverwriteIn(BaseModel):
    scheduleId: str
    taskIds: List[str] = []


class ScheduleSaveBody(BaseModel):
    schedule: ScheduleIn
    overwrites: List[OverwriteIn] = []
    confirmed: bool = False


class SchedulePatchBody(BaseModel):
    pinned: Optional[bool] = None
    color: Optional[str] = None
    background: Optional[Dict[str, Any]] = None


class TaskStatusBody(BaseModel):
    status: str


class TaskMoveBody(BaseModel):
    date: str
    start: str
    end: str


class ReminderIn(BaseModel):
    label: str
    deadline: str
    description: Optional[str] = ""


class ReminderPatchBody(BaseModel):
    done: Optional[bool] = None
    trashed: Optional[bool] = None


class ReadBody(BaseModel):
    ids: Optional[List[str]] = None


class ProfileBody(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = ""
    country: Optional[str] = ""


class PasswordBody(BaseModel):
    current_password: str
    new_password: str


class UserSupportBody(BaseModel):
    topic: Optional[str] = "question"
    name: str
    email: str
    contact_number: str
    message: str


class ConflictCheckBody(BaseModel):
    date: str
    label: Optional[str] = ""
    tasks: List[TaskIn] = []
    exclude_schedule_id: Optional[str] = None


# ---------------------------------------------------------------------
# User web pages
# ---------------------------------------------------------------------
USER_PAGES = {
    "dashboard": "dashboard.html", "schedules": "schedules.html", "tasks": "tasks.html",
    "reminders": "reminders.html", "notifications": "notifications.html", "trash": "trash.html",
    "settings": "settings.html", "support": "support.html",
}


@app.get("/user", include_in_schema=False)
async def user_root():
    return RedirectResponse(url="/user/dashboard")


@app.get("/user/{page}", response_class=HTMLResponse)
async def user_page(page: str, request: Request):
    if page not in USER_PAGES:
        raise HTTPException(status_code=404, detail="Page not found")
    return user_web_templates.TemplateResponse(request=request, name=USER_PAGES[page])


# ---------------------------------------------------------------------
# Health + authentication
# ---------------------------------------------------------------------
@app.get("/api/health")
def api_health():
    return {"status": "ok"}


def _start_otp(tx: _Tx, email: str, purpose: str, extra: Dict[str, Any]) -> Dict[str, Any]:
    code = f"{secrets.randbelow(1000000):06d}"
    tx.run("DELETE FROM email_otps WHERE email = %s AND purpose = %s", (email, purpose))
    tx.run(
        "INSERT INTO email_otps (email, purpose, code_hash, payload_json, attempts, expires_at, created_at) VALUES (%s, %s, %s, %s, 0, %s, %s)",
        (email, purpose, _hash_code(code), json.dumps(extra), _utcnow() + _dt.timedelta(minutes=5), _utcnow()),
    )
    sent = _send_otp(email, code, purpose)
    result = {"status": "otp_sent", "email_sent": sent}
    if not sent and os.environ.get("SCHEDULER_DEV_MODE") == "1":
        result["dev_code"] = code
    return result


@app.post("/api/auth/signup")
def api_signup(body: SignupBody, request: Request):
    """Creates the account and logs the user in right away."""
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email.")
    if not _password_ok(body.password):
        raise HTTPException(status_code=422, detail="Use 8 or more characters with a letter and a number.")
    timezone = body.timezone or "UTC"
    with _Tx() as tx:
        if tx.one("SELECT id FROM users WHERE email = %s", (email,)):
            raise HTTPException(status_code=409, detail="This email already has an account. Log in instead.")
        user_id = tx.run(
            "INSERT INTO users (name, email, phone, country, timezone, password_hash, created_at) VALUES (%s, %s, '', '', %s, %s, %s)",
            ((body.name or "").strip() or email.split("@")[0], email, timezone, _hash_password(body.password), _utcnow()),
        )
        tx.run("INSERT INTO user_settings (user_id, settings_json) VALUES (%s, %s)", (user_id, json.dumps({"timezone": timezone})))
    _login_session(request, user_id, True)
    return {"status": "ok", "redirect": "/user/dashboard"}


@app.post("/api/auth/resend-otp")
def api_resend_otp(body: EmailBody):
    email = body.email.strip().lower()
    with _Tx() as tx:
        row = tx.one("SELECT * FROM email_otps WHERE email = %s AND purpose = 'reset' ORDER BY created_at DESC LIMIT 1", (email,))
        if not row:
            raise HTTPException(status_code=404, detail="Start again: no code was requested for this email.")
        if (_utcnow() - row["created_at"]).total_seconds() < 60:
            raise HTTPException(status_code=429, detail="Please wait a minute before asking for a new code.")
        return _start_otp(tx, email, row["purpose"], _json_load(row["payload_json"], {}))


@app.post("/api/auth/login")
def api_login(body: LoginBody, request: Request):
    email = body.email.strip().lower()
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE email = %s", (email,))
        if not user or not _check_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Email or password is not correct.")
    _login_session(request, user["id"], body.remember)
    return {"status": "ok", "redirect": "/user/dashboard"}


@app.post("/api/auth/forgot-password")
def api_forgot_password(body: ForgotPasswordBody):
    """Emails a reset code. The answer is the same whether or not the email has an account."""
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email.")
    with _Tx() as tx:
        if tx.one("SELECT id FROM users WHERE email = %s", (email,)):
            return _start_otp(tx, email, "reset", {})
    return {"status": "otp_sent", "email_sent": True}


@app.post("/api/auth/reset-password")
def api_reset_password(body: ResetPasswordBody, request: Request):
    email = body.email.strip().lower()
    if not _password_ok(body.new_password):
        raise HTTPException(status_code=422, detail="Use 8 or more characters with a letter and a number.")
    with _Tx() as tx:
        row = tx.one("SELECT * FROM email_otps WHERE email = %s AND purpose = 'reset' ORDER BY created_at DESC LIMIT 1", (email,))
        if not row:
            raise HTTPException(status_code=400, detail="That code does not match.")
        if row["expires_at"] < _utcnow():
            raise HTTPException(status_code=410, detail="This code has expired. Ask for a new one.")
        if row["attempts"] >= 5:
            raise HTTPException(status_code=429, detail="Too many attempts. Ask for a new code.")
        matches = hmac.compare_digest(_hash_code(body.code.strip()), row["code_hash"])
        if not matches:
            tx.run("UPDATE email_otps SET attempts = attempts + 1 WHERE id = %s", (row["id"],))
    if not matches:
        raise HTTPException(status_code=400, detail="That code does not match.")
    with _Tx() as tx:
        user = tx.one("SELECT id FROM users WHERE email = %s", (email,))
        if not user:
            raise HTTPException(status_code=404, detail="Account not found.")
        tx.run("UPDATE users SET password_hash = %s WHERE id = %s", (_hash_password(body.new_password), user["id"]))
        tx.run("DELETE FROM email_otps WHERE email = %s", (email,))
    _login_session(request, user["id"], True)
    return {"status": "ok", "redirect": "/user/dashboard"}


@app.post("/api/auth/logout")
def api_logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# Profile, settings, account
# ---------------------------------------------------------------------
@app.get("/api/user/me")
def api_me(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
        if not user:
            raise HTTPException(status_code=401, detail="Not logged in")
        return _profile(user)


@app.get("/api/user/bootstrap")
def api_bootstrap(request: Request, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
        if not user:
            request.session.clear()
            raise HTTPException(status_code=401, detail="Not logged in")
        reminders = tx.all("SELECT * FROM reminders WHERE user_id = %s ORDER BY deadline", (user_id,))
        notes = tx.all("SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT 200", (user_id,))
        return {
            "profile": _profile(user),
            "settings": _user_settings(tx, user_id),
            "schedules": _all_schedules(tx, user_id),
            "reminders": [_reminder_out(r) for r in reminders],
            "notifications": [_notification_out(n) for n in notes],
        }


@app.put("/api/user/profile")
def api_profile(body: ProfileBody, user_id: int = Depends(current_user_id)):
    phone = (body.phone or "").strip()
    if phone and not re.match(r"^\+?[\d\s()-]{7,20}$", phone):
        raise HTTPException(status_code=422, detail="Enter a valid contact number.")
    with _Tx() as tx:
        tx.run("UPDATE users SET name = %s, phone = %s, country = %s WHERE id = %s",
               ((body.name or "").strip()[:120], phone, (body.country or "")[:2], user_id))
        return _profile(tx.one("SELECT * FROM users WHERE id = %s", (user_id,)))


@app.put("/api/user/settings")
def api_settings(settings: Dict[str, Any], user_id: int = Depends(current_user_id)):
    merged = _merge(DEFAULT_USER_SETTINGS, settings)
    merged["dismissedRecs"] = list(settings.get("dismissedRecs", []))[-100:]
    with _Tx() as tx:
        if tx.one("SELECT user_id FROM user_settings WHERE user_id = %s", (user_id,)):
            tx.run("UPDATE user_settings SET settings_json = %s WHERE user_id = %s", (json.dumps(merged), user_id))
        else:
            tx.run("INSERT INTO user_settings (user_id, settings_json) VALUES (%s, %s)", (user_id, json.dumps(merged)))
        tz = merged.get("timezone")
        if tz and tz != "auto":
            tx.run("UPDATE users SET timezone = %s WHERE id = %s", (tz, user_id))
    return merged


@app.post("/api/user/password")
def api_password(body: PasswordBody, user_id: int = Depends(current_user_id)):
    if not _password_ok(body.new_password):
        raise HTTPException(status_code=422, detail="Use 8 or more characters with a letter and a number.")
    with _Tx() as tx:
        user = tx.one("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        if not _check_password(body.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Your current password is not correct.")
        tx.run("UPDATE users SET password_hash = %s WHERE id = %s", (_hash_password(body.new_password), user_id))
    return {"status": "ok"}


@app.delete("/api/user/account")
def api_delete_account(request: Request, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        for table in ("tasks", "schedules", "reminders", "notifications", "user_settings"):
            tx.run(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
        email = tx.one("SELECT email FROM users WHERE id = %s", (user_id,))
        if email:
            tx.run("DELETE FROM email_otps WHERE email = %s", (email["email"],))
        tx.run("DELETE FROM users WHERE id = %s", (user_id,))
    request.session.clear()
    return {"status": "deleted"}


# ---------------------------------------------------------------------
# Schedules: conflicts, duplicates, create, update, trash
# ---------------------------------------------------------------------
def _validate_schedule(s: ScheduleIn) -> None:
    if not DATE_RE.match(s.date):
        raise HTTPException(status_code=422, detail="The date must look like YYYY-MM-DD.")
    if not s.label.strip():
        raise HTTPException(status_code=422, detail="Give your schedule a label.")
    for t in s.tasks:
        if not TIME_RE.match(t.start) or not TIME_RE.match(t.end) or _to_min(t.end) <= _to_min(t.start):
            raise HTTPException(status_code=422, detail=f"“{t.label}” needs a valid start and end time.")
        if not t.label.strip():
            raise HTTPException(status_code=422, detail="Every task needs a label.")
        if t.urgency not in URGENCY_LEVELS:
            raise HTTPException(status_code=422, detail="Urgency must be optional, normal, medium, high or urgent.")
        if t.status not in TASK_STATUSES:
            raise HTTPException(status_code=422, detail="Task status must be pending, finished or cancelled.")


def _find_conflicts(tx: _Tx, user_id: int, date: str, tasks: List[TaskIn], exclude_schedule_id=None, ignore_task_ids=()) -> List[Dict[str, Any]]:
    """Overlaps between the submitted tasks and each other, and with other active schedules on the same day."""
    conflicts = []
    rows = tx.all(
        "SELECT t.*, s.label AS schedule_label FROM tasks t JOIN schedules s ON s.id = t.schedule_id "
        "WHERE s.user_id = %s AND s.schedule_date = %s AND s.deleted_at IS NULL AND t.status <> 'cancelled'",
        (user_id, date),
    )
    ignore = {str(i) for i in ignore_task_ids}
    for i, t in enumerate(tasks):
        if t.status == "cancelled":
            continue
        a, b = _to_min(t.start), _to_min(t.end)
        for other in tasks[i + 1:]:
            if other.status != "cancelled" and a < _to_min(other.end) and _to_min(other.start) < b:
                conflicts.append({"task": t.label, "with": other.label, "schedule": "this schedule", "start": other.start, "end": other.end,
                                  "duplicate": t.label.strip().lower() == other.label.strip().lower() and t.start == other.start})
        for row in rows:
            if exclude_schedule_id and str(row["schedule_id"]) == str(exclude_schedule_id):
                continue
            if str(row["id"]) in ignore:
                continue
            s2, e2 = _to_min(row["start_time"]), _to_min(row["end_time"])
            if a < e2 and s2 < b:
                conflicts.append({"task": t.label, "with": row["label"], "with_task_id": str(row["id"]), "schedule": row["schedule_label"],
                                  "schedule_id": str(row["schedule_id"]), "start": str(row["start_time"])[:5], "end": str(row["end_time"])[:5],
                                  "duplicate": t.label.strip().lower() == row["label"].strip().lower() and t.start == str(row["start_time"])[:5]})
    return conflicts


def _find_duplicate_schedule(tx: _Tx, user_id: int, label: str, date: str, exclude_id=None):
    rows = tx.all("SELECT id, label FROM schedules WHERE user_id = %s AND schedule_date = %s AND deleted_at IS NULL", (user_id, date))
    for r in rows:
        if r["label"].strip().lower() == label.strip().lower() and str(r["id"]) != str(exclude_id or ""):
            return {"id": str(r["id"]), "label": r["label"]}
    return None


@app.post("/api/user/schedules/check")
def api_schedule_check(body: ConflictCheckBody, user_id: int = Depends(current_user_id)):
    """Schedule conflict detection + schedule duplication detection, without saving anything."""
    with _Tx() as tx:
        return {
            "conflicts": _find_conflicts(tx, user_id, body.date, body.tasks, body.exclude_schedule_id),
            "duplicate_schedule": _find_duplicate_schedule(tx, user_id, body.label or "", body.date, body.exclude_schedule_id),
        }


def _apply_overwrites(tx: _Tx, user_id: int, overwrites: List[OverwriteIn], by_label: str) -> List[str]:
    touched = []
    for o in overwrites:
        sched = tx.one("SELECT id FROM schedules WHERE id = %s AND user_id = %s", (o.scheduleId, user_id))
        if not sched:
            continue
        for task_id in o.taskIds:
            task = tx.one("SELECT label FROM tasks WHERE id = %s AND schedule_id = %s", (task_id, sched["id"]))
            if task:
                tx.run("DELETE FROM tasks WHERE id = %s", (task_id,))
                _stamp(tx, sched["id"], f"“{task['label']}” was overwritten by “{by_label}”")
        touched.append(str(sched["id"]))
    return touched


def _save_tasks(tx: _Tx, user_id: int, schedule_id, tasks: List[TaskIn]) -> None:
    existing = {str(t["id"]): t for t in tx.all("SELECT * FROM tasks WHERE schedule_id = %s", (schedule_id,))}
    keep = set()
    for t in tasks:
        completed = _utcnow() if t.status == "finished" else None
        old = existing.get(str(t.id)) if t.id else None
        if old:
            keep.add(str(old["id"]))
            same_time = str(old["start_time"])[:5] == t.start and str(old["end_time"])[:5] == t.end
            tx.run(
                "UPDATE tasks SET start_time = %s, end_time = %s, label = %s, description = %s, urgency = %s, status = %s, "
                "completed_at = %s, notified_near = %s, notified_over = %s WHERE id = %s",
                (t.start, t.end, t.label.strip()[:80], (t.description or "")[:500], t.urgency, t.status,
                 old["completed_at"] if (t.status == "finished" and old["completed_at"]) else completed,
                 old["notified_near"] if same_time else 0, old["notified_over"] if same_time else 0, old["id"]),
            )
        else:
            tx.run(
                "INSERT INTO tasks (schedule_id, user_id, start_time, end_time, label, description, urgency, status, completed_at, notified_near, notified_over, created_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, %s)",
                (schedule_id, user_id, t.start, t.end, t.label.strip()[:80], (t.description or "")[:500], t.urgency, t.status, completed, _utcnow()),
            )
    for task_id in existing:
        if task_id not in keep:
            tx.run("DELETE FROM tasks WHERE id = %s", (task_id,))


def _conflict_response(conflicts):
    return JSONResponse(status_code=409, content={"detail": {
        "message": "Another schedule has been planned. Do you want to move this or overwrite that schedule?",
        "conflicts": conflicts,
    }})


@app.post("/api/user/schedules")
def api_create_schedule(body: ScheduleSaveBody, user_id: int = Depends(current_user_id)):
    s = body.schedule
    _validate_schedule(s)
    with _Tx() as tx:
        ignore = [tid for o in body.overwrites for tid in o.taskIds]
        conflicts = _find_conflicts(tx, user_id, s.date, s.tasks, None, ignore)
        if conflicts and not body.confirmed:
            return _conflict_response(conflicts)
        touched = _apply_overwrites(tx, user_id, body.overwrites, s.label)
        now = _utcnow()
        activity = [{"at": now.isoformat() + "Z", "text": f"Schedule created with {len(s.tasks)} task{'s' if len(s.tasks) != 1 else ''}"}]
        schedule_id = tx.run(
            "INSERT INTO schedules (user_id, label, description, schedule_date, color, background_json, pinned, deleted_at, activity_json, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, 0, NULL, %s, %s, %s)",
            (user_id, s.label.strip()[:80], (s.description or "")[:1000], s.date, (s.color or "#FFDE59")[:20],
             json.dumps(s.background or {"type": "none", "value": ""}), json.dumps(activity), now, now),
        )
        _save_tasks(tx, user_id, schedule_id, s.tasks)
        return {"schedule": _load_schedule(tx, user_id, schedule_id),
                "updated": [_load_schedule(tx, user_id, sid) for sid in touched]}


@app.put("/api/user/schedules/{schedule_id}")
def api_update_schedule(schedule_id: int, body: ScheduleSaveBody, user_id: int = Depends(current_user_id)):
    s = body.schedule
    _validate_schedule(s)
    with _Tx() as tx:
        _load_schedule(tx, user_id, schedule_id)  # ownership check
        ignore = [tid for o in body.overwrites for tid in o.taskIds]
        conflicts = _find_conflicts(tx, user_id, s.date, s.tasks, schedule_id, ignore)
        if conflicts and not body.confirmed:
            return _conflict_response(conflicts)
        touched = _apply_overwrites(tx, user_id, body.overwrites, s.label)
        tx.run(
            "UPDATE schedules SET label = %s, description = %s, schedule_date = %s, color = %s, background_json = %s, updated_at = %s WHERE id = %s",
            (s.label.strip()[:80], (s.description or "")[:1000], s.date, (s.color or "#FFDE59")[:20],
             json.dumps(s.background or {"type": "none", "value": ""}), _utcnow(), schedule_id),
        )
        _save_tasks(tx, user_id, schedule_id, s.tasks)
        _stamp(tx, schedule_id, "Schedule modified")
        return {"schedule": _load_schedule(tx, user_id, schedule_id),
                "updated": [_load_schedule(tx, user_id, sid) for sid in touched if sid != str(schedule_id)]}


@app.patch("/api/user/schedules/{schedule_id}")
def api_patch_schedule(schedule_id: int, body: SchedulePatchBody, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        _load_schedule(tx, user_id, schedule_id)
        if body.pinned is not None:
            tx.run("UPDATE schedules SET pinned = %s WHERE id = %s", (1 if body.pinned else 0, schedule_id))
            _stamp(tx, schedule_id, "Pinned" if body.pinned else "Unpinned")
        if body.color is not None:
            tx.run("UPDATE schedules SET color = %s WHERE id = %s", (body.color[:20], schedule_id))
        if body.background is not None:
            tx.run("UPDATE schedules SET background_json = %s WHERE id = %s", (json.dumps(body.background), schedule_id))
        if body.color is not None or body.background is not None:
            _stamp(tx, schedule_id, "Customized")
        return _load_schedule(tx, user_id, schedule_id)


@app.post("/api/user/schedules/{schedule_id}/trash")
def api_trash_schedule(schedule_id: int, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        _load_schedule(tx, user_id, schedule_id)
        tx.run("UPDATE schedules SET deleted_at = %s, pinned = 0 WHERE id = %s", (_utcnow(), schedule_id))
        _stamp(tx, schedule_id, "Moved to trash")
        return _load_schedule(tx, user_id, schedule_id)


@app.post("/api/user/schedules/{schedule_id}/restore")
def api_restore_schedule(schedule_id: int, user_id: int = Depends(current_user_id)):
    """Recover from the trash. Schedules that replaced it (same day, overlapping tasks) are overwritten: moved to the trash."""
    with _Tx() as tx:
        restored = _load_schedule(tx, user_id, schedule_id)
        others = [o for o in _all_schedules(tx, user_id) if not o["deleted_at"] and o["date"] == restored["date"] and o["id"] != restored["id"]]
        overwritten = []
        for o in others:
            clash = any(
                _to_min(t["start"]) < _to_min(u["end"]) and _to_min(u["start"]) < _to_min(t["end"])
                for t in restored["tasks"] for u in o["tasks"] if u["status"] != "cancelled"
            )
            if clash:
                tx.run("UPDATE schedules SET deleted_at = %s, pinned = 0 WHERE id = %s", (_utcnow(), o["id"]))
                _stamp(tx, o["id"], f"Overwritten when “{restored['label']}” was recovered")
                overwritten.append(o["id"])
        tx.run("UPDATE schedules SET deleted_at = NULL WHERE id = %s", (schedule_id,))
        _stamp(tx, schedule_id, "Recovered from trash")
        return {"schedule": _load_schedule(tx, user_id, schedule_id),
                "overwritten": [_load_schedule(tx, user_id, oid) for oid in overwritten]}


@app.delete("/api/user/schedules/{schedule_id}")
def api_delete_schedule(schedule_id: int, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        s = _load_schedule(tx, user_id, schedule_id)
        if not s["deleted_at"]:
            raise HTTPException(status_code=400, detail="Move the schedule to the trash first.")
        tx.run("DELETE FROM tasks WHERE schedule_id = %s", (schedule_id,))
        tx.run("DELETE FROM schedules WHERE id = %s", (schedule_id,))
    return {"status": "deleted"}


@app.delete("/api/user/trash")
def api_empty_trash(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        for row in tx.all("SELECT id FROM schedules WHERE user_id = %s AND deleted_at IS NOT NULL", (user_id,)):
            tx.run("DELETE FROM tasks WHERE schedule_id = %s", (row["id"],))
        tx.run("DELETE FROM schedules WHERE user_id = %s AND deleted_at IS NOT NULL", (user_id,))
        tx.run("DELETE FROM reminders WHERE user_id = %s AND deleted_at IS NOT NULL", (user_id,))
    return {"status": "emptied"}


# ---------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------
@app.patch("/api/user/tasks/{task_id}")
def api_task_status(task_id: int, body: TaskStatusBody, user_id: int = Depends(current_user_id)):
    if body.status not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail="Status must be pending, finished or cancelled.")
    with _Tx() as tx:
        task = tx.one("SELECT t.*, s.schedule_date, s.id AS sid FROM tasks t JOIN schedules s ON s.id = t.schedule_id WHERE t.id = %s AND t.user_id = %s", (task_id, user_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        tx.run("UPDATE tasks SET status = %s, completed_at = %s WHERE id = %s",
               (body.status, _utcnow() if body.status == "finished" else None, task_id))
        verb = {"finished": "Finished", "cancelled": "Cancelled", "pending": "Reopened"}[body.status]
        _stamp(tx, task["sid"], f"{verb} “{task['label']}”")
        if body.status == "finished":
            user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
            settings = _user_settings(tx, user_id)
            now = _local_now(user, settings)
            end = _dt.datetime.combine(task["schedule_date"] if isinstance(task["schedule_date"], _dt.date) else _dt.date.fromisoformat(str(task["schedule_date"])[:10]),
                                       _dt.time(0)) + _dt.timedelta(minutes=_to_min(task["end_time"]))
            if now < end:
                _notify(tx, user, settings, "early", "Finished before the deadline",
                        f"Nice work! “{task['label']}” was finished before {_fmt_time(task['end_time'])}.",
                        "schedule", task["sid"], "/user/schedules?open=" + str(task["sid"]))
        return _load_schedule(tx, user_id, task["sid"])


@app.post("/api/user/tasks/{task_id}/move")
def api_task_move(task_id: int, body: TaskMoveBody, user_id: int = Depends(current_user_id)):
    """Used by the schedule-moving recommendations: moves one task to another day / time."""
    if not DATE_RE.match(body.date) or not TIME_RE.match(body.start) or not TIME_RE.match(body.end):
        raise HTTPException(status_code=422, detail="Invalid date or time.")
    with _Tx() as tx:
        task = tx.one("SELECT t.*, s.label AS slabel, s.description AS sdesc, s.color, s.background_json, s.schedule_date "
                      "FROM tasks t JOIN schedules s ON s.id = t.schedule_id WHERE t.id = %s AND t.user_id = %s", (task_id, user_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        target = tx.one("SELECT id FROM schedules WHERE user_id = %s AND schedule_date = %s AND deleted_at IS NULL AND LOWER(label) = LOWER(%s)",
                        (user_id, body.date, task["slabel"])) or \
            tx.one("SELECT id FROM schedules WHERE user_id = %s AND schedule_date = %s AND deleted_at IS NULL ORDER BY id LIMIT 1", (user_id, body.date))
        if target:
            target_id = target["id"]
        else:
            now = _utcnow()
            target_id = tx.run(
                "INSERT INTO schedules (user_id, label, description, schedule_date, color, background_json, pinned, deleted_at, activity_json, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, 0, NULL, '[]', %s, %s)",
                (user_id, task["slabel"], task["sdesc"], body.date, task["color"], task["background_json"], now, now))
        tx.run("UPDATE tasks SET schedule_id = %s, start_time = %s, end_time = %s, notified_near = 0, notified_over = 0 WHERE id = %s",
               (target_id, body.start, body.end, task_id))
        _stamp(tx, task["schedule_id"], f"Moved “{task['label']}” to {body.date}")
        _stamp(tx, target_id, f"Received “{task['label']}” from {_iso(task['schedule_date'])[:10]}")
    return {"status": "moved"}


# ---------------------------------------------------------------------
# Exports: PDF, Excel, JSON, CSV
# ---------------------------------------------------------------------
@app.get("/api/user/schedules/{schedule_id}/export")
def api_export_schedule(schedule_id: int, format: str = "json", user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        s = _load_schedule(tx, user_id, schedule_id)
    name = re.sub(r"[^a-z0-9]+", "-", s["label"].lower()).strip("-") or "schedule"
    name = f"{name}-{s['date']}"
    head = ["Schedule", "Date", "Start", "End", "Task", "Description", "Urgency", "Status"]
    rows = [[s["label"], s["date"], _fmt_time(t["start"]), _fmt_time(t["end"]), t["label"], t["description"], t["urgency"].title(), t["status"].title()] for t in s["tasks"]]
    disposition = lambda ext: {"Content-Disposition": f'attachment; filename="{name}.{ext}"'}

    if format == "json":
        if s["background"].get("type") == "image":
            s["background"]["value"] = "(image)"
        return Response(json.dumps(s, indent=2, ensure_ascii=False), media_type="application/json", headers=disposition("json"))
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(head)
        writer.writerows(rows)
        return Response("\ufeff" + buf.getvalue(), media_type="text/csv", headers=disposition("csv"))
    if format == "xlsx":
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill
        except ImportError:
            raise HTTPException(status_code=501, detail="Install openpyxl to export Excel files.")
        wb = Workbook()
        ws = wb.active
        ws.title = "Schedule"
        ws.append(head)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="FFDE59")
        for r in rows:
            ws.append(r)
        for col in ws.columns:
            ws.column_dimensions[col[0].column_letter].width = min(48, max(10, max(len(str(c.value or "")) for c in col) + 2))
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=disposition("xlsx"))
    if format == "pdf":
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError:
            raise HTTPException(status_code=501, detail="Install reportlab to export PDF files.")
        out = io.BytesIO()
        doc = SimpleDocTemplate(out, pagesize=A4, title=s["label"])
        styles = getSampleStyleSheet()
        story = [Paragraph(s["label"], styles["Title"]), Paragraph(s["date"], styles["Normal"])]
        if s["description"]:
            story += [Spacer(1, 8), Paragraph(s["description"], styles["Normal"])]
        table = Table([["Start", "End", "Task", "Urgency", "Status"]] + [[r[2], r[3], Paragraph(r[4], styles["Normal"]), r[6], r[7]] for r in rows], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FFDE59")),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story += [Spacer(1, 14), table]
        doc.build(story)
        out.seek(0)
        return StreamingResponse(out, media_type="application/pdf", headers=disposition("pdf"))
    raise HTTPException(status_code=400, detail="Format must be pdf, xlsx, json or csv.")


# ---------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------
def _parse_deadline(value: str) -> _dt.datetime:
    try:
        return _dt.datetime.strptime(value[:16], "%Y-%m-%dT%H:%M")
    except ValueError:
        raise HTTPException(status_code=422, detail="The deadline must look like YYYY-MM-DDTHH:MM.")


@app.post("/api/user/reminders")
def api_create_reminder(body: ReminderIn, user_id: int = Depends(current_user_id)):
    if not body.label.strip():
        raise HTTPException(status_code=422, detail="Give your reminder a label.")
    with _Tx() as tx:
        rid = tx.run(
            "INSERT INTO reminders (user_id, label, description, deadline, done, deleted_at, notified_near, notified_over, created_at) VALUES (%s, %s, %s, %s, 0, NULL, 0, 0, %s)",
            (user_id, body.label.strip()[:80], (body.description or "")[:500], _parse_deadline(body.deadline), _utcnow()))
        return _reminder_out(tx.one("SELECT * FROM reminders WHERE id = %s", (rid,)))


@app.put("/api/user/reminders/{reminder_id}")
def api_update_reminder(reminder_id: int, body: ReminderIn, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        old = tx.one("SELECT * FROM reminders WHERE id = %s AND user_id = %s", (reminder_id, user_id))
        if not old:
            raise HTTPException(status_code=404, detail="Reminder not found")
        deadline = _parse_deadline(body.deadline)
        reset = _reminder_out(old)["deadline"] != body.deadline[:16]
        tx.run("UPDATE reminders SET label = %s, description = %s, deadline = %s, notified_near = %s, notified_over = %s WHERE id = %s",
               (body.label.strip()[:80], (body.description or "")[:500], deadline,
                0 if reset else old["notified_near"], 0 if reset else old["notified_over"], reminder_id))
        return _reminder_out(tx.one("SELECT * FROM reminders WHERE id = %s", (reminder_id,)))


@app.patch("/api/user/reminders/{reminder_id}")
def api_patch_reminder(reminder_id: int, body: ReminderPatchBody, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        if not tx.one("SELECT id FROM reminders WHERE id = %s AND user_id = %s", (reminder_id, user_id)):
            raise HTTPException(status_code=404, detail="Reminder not found")
        if body.done is not None:
            tx.run("UPDATE reminders SET done = %s WHERE id = %s", (1 if body.done else 0, reminder_id))
        if body.trashed is not None:
            tx.run("UPDATE reminders SET deleted_at = %s WHERE id = %s", (_utcnow() if body.trashed else None, reminder_id))
        return _reminder_out(tx.one("SELECT * FROM reminders WHERE id = %s", (reminder_id,)))


@app.delete("/api/user/reminders/{reminder_id}")
def api_delete_reminder(reminder_id: int, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        tx.run("DELETE FROM reminders WHERE id = %s AND user_id = %s", (reminder_id, user_id))
    return {"status": "deleted"}


# ---------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------
@app.get("/api/user/notifications")
def api_notifications(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        return [_notification_out(n) for n in tx.all("SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT 200", (user_id,))]


@app.post("/api/user/notifications/read")
def api_notifications_read(body: ReadBody, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        if body.ids is None:
            tx.run("UPDATE notifications SET is_read = 1 WHERE user_id = %s", (user_id,))
        else:
            for nid in body.ids:
                tx.run("UPDATE notifications SET is_read = 1 WHERE id = %s AND user_id = %s", (nid, user_id))
    return {"status": "ok"}


@app.delete("/api/user/notifications/{notification_id}")
def api_notification_delete(notification_id: int, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        tx.run("DELETE FROM notifications WHERE id = %s AND user_id = %s", (notification_id, user_id))
    return {"status": "deleted"}


@app.delete("/api/user/notifications")
def api_notifications_clear(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        tx.run("DELETE FROM notifications WHERE user_id = %s", (user_id,))
    return {"status": "cleared"}


@app.post("/api/user/test-email")
def api_test_email(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
    title = "Test email from Scheduler"
    body = "Your email notifications are working. You'll get messages like this when a task is due soon, is overdue or is finished early."
    if not _send_email(user["email"], title, body, _email_html(title, body)):
        raise HTTPException(status_code=503, detail="The email could not be sent. Check the SMTP settings on the server.")
    return {"status": "sent"}


# ---------------------------------------------------------------------
# Statistics + recommendations (the dashboard also computes these in the browser)
# ---------------------------------------------------------------------
def _task_rows(tx: _Tx, user_id: int, start: Optional[str] = None, end: Optional[str] = None):
    sql = ("SELECT t.*, s.schedule_date, s.label AS schedule_label FROM tasks t JOIN schedules s ON s.id = t.schedule_id "
           "WHERE s.user_id = %s AND s.deleted_at IS NULL")
    params: List[Any] = [user_id]
    if start:
        sql += " AND s.schedule_date >= %s"
        params.append(start)
    if end:
        sql += " AND s.schedule_date <= %s"
        params.append(end)
    return tx.all(sql, tuple(params))


@app.get("/api/user/stats")
def api_stats(start: Optional[str] = None, end: Optional[str] = None, user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
        settings = _user_settings(tx, user_id)
        rows = _task_rows(tx, user_id, start, end)
    now = _local_now(user, settings)
    status = {"finished": 0, "pending": 0, "cancelled": 0, "overtime": 0}
    weekdays = {d: 0 for d in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")}
    weeks: Dict[str, int] = {}
    for r in rows:
        day = r["schedule_date"] if isinstance(r["schedule_date"], _dt.date) else _dt.date.fromisoformat(str(r["schedule_date"])[:10])
        end_at = _dt.datetime.combine(day, _dt.time(0)) + _dt.timedelta(minutes=_to_min(r["end_time"]))
        st = "overtime" if r["status"] == "pending" and end_at < now else r["status"]
        status[st] += 1
        if r["status"] == "cancelled":
            continue
        minutes = _to_min(r["end_time"]) - _to_min(r["start_time"])
        weekdays[day.strftime("%A")] += minutes
        key = f"{day.year}-{day.month:02d} week {(day.day - 1) // 7 + 1}"
        weeks[key] = weeks.get(key, 0) + minutes
    pct = lambda d: {k: (round(v / sum(d.values()) * 100, 1) if sum(d.values()) else 0) for k, v in d.items()}
    return {
        "status_counts": status, "status_percent": pct(status),
        "weekday_minutes": weekdays, "weekday_percent": pct(weekdays),
        "week_of_month_minutes": weeks, "week_of_month_percent": pct(weeks),
    }


def _recommendations_for(tx: _Tx, user, settings) -> List[Dict[str, Any]]:
    limit = int(settings.get("busyThresholdHours", 8)) * 60
    today = _local_now(user, settings).date()
    rows = _task_rows(tx, user["id"], today.isoformat(), (today + _dt.timedelta(days=21)).isoformat())
    by_day: Dict[str, List] = {}
    for r in rows:
        if r["status"] != "cancelled":
            by_day.setdefault(_iso(r["schedule_date"])[:10], []).append(r)
    load = {d: sum(_to_min(t["end_time"]) - _to_min(t["start_time"]) for t in ts) for d, ts in by_day.items()}
    order = {u: i for i, u in enumerate(URGENCY_LEVELS)}
    recs = []
    for i in range(14):
        day = (today + _dt.timedelta(days=i)).isoformat()
        if load.get(day, 0) <= limit:
            continue
        movable = sorted([t for t in by_day[day] if t["status"] == "pending" and t["urgency"] != "urgent"],
                         key=lambda t: (order[t["urgency"]], -_to_min(t["start_time"])))
        if not movable:
            continue
        task = movable[0]
        minutes = _to_min(task["end_time"]) - _to_min(task["start_time"])
        best = None
        for j in range(1, 8):
            cand = (_dt.date.fromisoformat(day) + _dt.timedelta(days=j)).isoformat()
            if load.get(cand, 0) + minutes > limit:
                continue
            clash = any(_to_min(task["start_time"]) < _to_min(o["end_time"]) and _to_min(o["start_time"]) < _to_min(task["end_time"]) for o in by_day.get(cand, []))
            if clash:
                continue
            if best is None or load.get(cand, 0) < load.get(best, 0):
                best = cand
        if best:
            recs.append({"task_id": str(task["id"]), "task": task["label"], "from_date": day, "to_date": best,
                         "start": str(task["start_time"])[:5], "end": str(task["end_time"])[:5],
                         "from_load_percent": round(load[day] / limit * 100), "to_load_percent": round((load.get(best, 0) + minutes) / limit * 100)})
    return recs


@app.get("/api/user/recommendations")
def api_recommendations(user_id: int = Depends(current_user_id)):
    with _Tx() as tx:
        user = tx.one("SELECT * FROM users WHERE id = %s", (user_id,))
        return _recommendations_for(tx, user, _user_settings(tx, user_id))


# ---------------------------------------------------------------------
# Help & support (stored in the existing `support` table)
# ---------------------------------------------------------------------
@app.post("/api/user/support")
def api_user_support(body: UserSupportBody):
    phone = re.sub(r"[\s\-()]", "", body.contact_number)
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Enter your name.")
    if not EMAIL_RE.match(body.email.strip()):
        raise HTTPException(status_code=422, detail="Enter a valid email.")
    if not re.match(r"^\+?\d{7,15}$", phone):
        raise HTTPException(status_code=422, detail="Enter a contact number with 7 to 15 digits.")
    if len(body.message.strip()) < 10:
        raise HTTPException(status_code=422, detail="Write at least 10 characters.")
    with _Tx() as tx:
        tx.run("INSERT INTO support (topic, name, email, contact_number, message) VALUES (%s, %s, %s, %s, %s)",
               ((body.topic or "question")[:30], body.name.strip()[:120], body.email.strip()[:190], body.contact_number.strip()[:30], body.message.strip()[:1000]))
    return {"status": "sent"}


# ---------------------------------------------------------------------
# Background job (runs every minute)
#   * emails + notifies when a task / reminder is close to its deadline
#   * emails + notifies when a task passed its end time unfinished
#   * notifies when a day becomes too busy (recommendation)
#   * permanently deletes items that have been in the trash for 5 days
# ---------------------------------------------------------------------
def _deadline_sweep() -> None:
    cutoff = _utcnow() - _dt.timedelta(days=TRASH_DAYS)
    with _Tx() as tx:
        for row in tx.all("SELECT id FROM schedules WHERE deleted_at IS NOT NULL AND deleted_at < %s", (cutoff,)):
            tx.run("DELETE FROM tasks WHERE schedule_id = %s", (row["id"],))
            tx.run("DELETE FROM schedules WHERE id = %s", (row["id"],))
        tx.run("DELETE FROM reminders WHERE deleted_at IS NOT NULL AND deleted_at < %s", (cutoff,))
        tx.run("DELETE FROM email_otps WHERE expires_at < %s", (_utcnow() - _dt.timedelta(days=1),))

    today = _utcnow().date()
    window = ((today - _dt.timedelta(days=2)).isoformat(), (today + _dt.timedelta(days=2)).isoformat())
    with _Tx() as tx:
        tasks = tx.all(
            "SELECT t.*, s.schedule_date, s.label AS schedule_label FROM tasks t JOIN schedules s ON s.id = t.schedule_id "
            "WHERE s.deleted_at IS NULL AND t.status = 'pending' AND (t.notified_near = 0 OR t.notified_over = 0) "
            "AND s.schedule_date BETWEEN %s AND %s", window)
        reminders = tx.all(
            "SELECT * FROM reminders WHERE deleted_at IS NULL AND done = 0 AND (notified_near = 0 OR notified_over = 0) AND deadline BETWEEN %s AND %s",
            (window[0] + " 00:00:00", window[1] + " 23:59:59"))
        users: Dict[int, Any] = {}

        def user_ctx(uid):
            if uid not in users:
                u = tx.one("SELECT * FROM users WHERE id = %s", (uid,))
                users[uid] = (u, _user_settings(tx, uid)) if u else (None, None)
            return users[uid]

        for t in tasks:
            user, settings = user_ctx(t["user_id"])
            if not user:
                continue
            now = _local_now(user, settings)
            day = t["schedule_date"] if isinstance(t["schedule_date"], _dt.date) else _dt.date.fromisoformat(str(t["schedule_date"])[:10])
            end_at = _dt.datetime.combine(day, _dt.time(0)) + _dt.timedelta(minutes=_to_min(t["end_time"]))
            left = (end_at - now).total_seconds() / 60
            lead = int(settings["notifications"].get("leadMinutes", 30))
            link = "/user/schedules?open=" + str(t["schedule_id"])
            if 0 < left <= lead and not t["notified_near"]:
                tx.run("UPDATE tasks SET notified_near = 1 WHERE id = %s", (t["id"],))
                _notify(tx, user, settings, "near", "Deadline coming up",
                        f"“{t['label']}” ({t['schedule_label']}) ends at {_fmt_time(t['end_time'])}, in {int(left)} minutes, and is not finished yet.",
                        "schedule", t["schedule_id"], link)
            elif left <= 0 and not t["notified_over"]:
                tx.run("UPDATE tasks SET notified_near = 1, notified_over = 1 WHERE id = %s", (t["id"],))
                if left > -24 * 60:  # don't email about tasks that were already old when they were added
                    _notify(tx, user, settings, "overdue", "Task not finished",
                            f"“{t['label']}” ({t['schedule_label']}) passed its end time of {_fmt_time(t['end_time'])} on {day.isoformat()} without being finished.",
                            "schedule", t["schedule_id"], link)

        for r in reminders:
            user, settings = user_ctx(r["user_id"])
            if not user:
                continue
            now = _local_now(user, settings)
            deadline = r["deadline"] if isinstance(r["deadline"], _dt.datetime) else _dt.datetime.fromisoformat(str(r["deadline"]))
            left = (deadline - now).total_seconds() / 60
            lead = int(settings["notifications"].get("leadMinutes", 30))
            if 0 < left <= lead and not r["notified_near"]:
                tx.run("UPDATE reminders SET notified_near = 1 WHERE id = %s", (r["id"],))
                _notify(tx, user, settings, "reminder", "Reminder due soon", f"“{r['label']}” is due at {deadline.strftime('%I:%M %p').lstrip('0')}.",
                        "reminder", r["id"], "/user/reminders?open=" + str(r["id"]))
            elif left <= 0 and not r["notified_over"]:
                tx.run("UPDATE reminders SET notified_near = 1, notified_over = 1 WHERE id = %s", (r["id"],))
                if left > -24 * 60:
                    _notify(tx, user, settings, "reminder", "Reminder overdue", f"“{r['label']}” passed its deadline.",
                            "reminder", r["id"], "/user/reminders?open=" + str(r["id"]))

    # Busy-day recommendations: at most one notification per overloaded day
    with _Tx() as tx:
        busy_users = tx.all("SELECT DISTINCT s.user_id FROM schedules s WHERE s.deleted_at IS NULL AND s.schedule_date BETWEEN %s AND %s",
                            (today.isoformat(), (today + _dt.timedelta(days=14)).isoformat()))
        for row in busy_users:
            user = tx.one("SELECT * FROM users WHERE id = %s", (row["user_id"],))
            if not user:
                continue
            settings = _user_settings(tx, user["id"])
            for rec in _recommendations_for(tx, user, settings):
                if tx.one("SELECT id FROM notifications WHERE user_id = %s AND kind = 'recommendation' AND ref_type = 'day' AND ref_id = %s",
                          (user["id"], rec["from_date"].replace("-", ""))):
                    continue
                _notify(tx, user, settings, "recommendation", "Your day is getting crowded",
                        f"{rec['from_date']} is {rec['from_load_percent']}% booked. Consider moving “{rec['task']}” to {rec['to_date']} at {_fmt_time(rec['start'])}. Open the dashboard to move it in one click.",
                        "day", int(rec["from_date"].replace("-", "")), "/user/dashboard")


async def _deadline_loop():
    while True:
        try:
            await asyncio.to_thread(_deadline_sweep)
        except Exception:
            log.exception("Deadline sweep failed")
        await asyncio.sleep(60)


@app.on_event("startup")
async def _start_deadline_loop():
    if os.environ.get("SCHEDULER_DISABLE_JOBS") != "1":
        asyncio.create_task(_deadline_loop())
