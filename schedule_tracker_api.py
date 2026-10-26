from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from fastapi.responses import HTMLResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

app = FastAPI()

main_web_templates = Jinja2Templates(directory="main_webpages/html_pages")

app.mount("/main_webpages/css", StaticFiles(directory="main_webpages/css"), name="css")
app.mount("/main_webpages/javascript", StaticFiles(directory="main_webpages/javascript"), name="javascript")
app.mount("/main_webpages/images", StaticFiles(directory="main_webpages/images"), name="images")


@app.get("/home", response_class=HTMLResponse)
def home(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.get("/about", response_class=HTMLResponse)
def about(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="about.html"
    )

@app.get("/how it works", response_class=HTMLResponse)
def how_it_works(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="how-it-works.html"
    )

@app.get("/support", response_class=HTMLResponse)
def support(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="support.html"
    )

@app.get("/faq", response_class=HTMLResponse)
def faq(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="faq.html"
    )

@app.get("/blog", response_class=HTMLResponse)
def blog(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="blog.html"
    )

@app.get("/log in", response_class=HTMLResponse)
def log_in(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="login.html"
    )

@app.get("/sign up", response_class=HTMLResponse)
def home(request: Request):
    return main_web_templates.TemplateResponse(
        request=request,
        name="signup.html"
    )