from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from fastapi.responses import HTMLResponse, Response
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
async def support(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="support.html"
    )

@app.post("/support/v1", response_class=HTMLResponse)
async def support(supportbody: SupportBody, request: Request):
    try:
        db = connect_to_db()
        cursor = db.cursor()
        query = "INSERT INTO support (topic, name, email, contact_number, message) VALUES (%s, %s, %s, %s, %s)"
        data = (supportbody.topic, supportbody.name, supportbody.email, supportbody.contact_number, supportbody.message)
        cursor.execute(query, (data,))
        return main_web_templates.TemplateResponse(
            request=request,
            name="support.html"
        )

    except Exception as e:
        raise

    finally:
        cursor.close()
        db.commit()
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
async def home(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="signup.html"
    )