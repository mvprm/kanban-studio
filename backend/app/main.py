import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.models import Board

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret")

# MVP: a single hardcoded account
USERNAME = "user"
PASSWORD = "password"

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)


class Credentials(BaseModel):
    username: str
    password: str


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


def current_user_id(username: str = Depends(current_user)) -> int:
    return db.get_or_create_user(username)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


@app.get("/api/board", response_model=Board)
def read_board(user_id: int = Depends(current_user_id)):
    return db.get_board(user_id)


@app.put("/api/board", response_model=Board)
def update_board(board: Board, user_id: int = Depends(current_user_id)):
    stored_ids = [column["id"] for column in db.get_board(user_id)["columns"]]
    if [column.id for column in board.columns] != stored_ids:
        raise HTTPException(status_code=422, detail="Column ids cannot change")
    data = board.model_dump(by_alias=True)
    db.save_board(user_id, data)
    return data


@app.post("/api/ai/test")
def ai_test(username: str = Depends(current_user)):
    return {"reply": ai.complete("What is 2+2?")}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
