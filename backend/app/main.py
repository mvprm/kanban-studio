import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.auth import hash_password, verify_password
from app.models import Board

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret")

# Demo account, created on startup so the original sign in keeps working
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"
FIRST_BOARD_NAME = "My first board"


def ensure_demo_user():
    user = db.get_user_by_username(DEMO_USERNAME)
    if user is None:
        user_id = db.create_user(DEMO_USERNAME, hash_password(DEMO_PASSWORD))
        db.create_board(user_id, FIRST_BOARD_NAME, db.default_board())
    elif not user["password_hash"]:  # migrated from the MVP, which had no passwords
        db.set_password_hash(user["id"], hash_password(DEMO_PASSWORD))


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    ensure_demo_user()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

Username = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9._-]{3,32}$")]
Password = Annotated[str, Field(min_length=8)]
BoardName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class Credentials(BaseModel):
    username: str
    password: str


class Registration(BaseModel):
    username: Username
    password: Password


class PasswordChange(BaseModel):
    current_password: str = Field(alias="currentPassword")
    new_password: Password = Field(alias="newPassword")


class PasswordConfirmation(BaseModel):
    password: str


class BoardNameRequest(BaseModel):
    name: BoardName


class ChatRequest(BaseModel):
    message: str
    history: list[ai.Message] = []


def current_user(request: Request) -> dict:
    user_id = request.session.get("user_id")
    user = db.get_user(user_id) if user_id else None
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not signed in")
    return user


def owned_board(board_id: int, user: dict = Depends(current_user)) -> dict:
    """The board, if the signed-in user owns it; 404 otherwise, so ids of others' boards don't leak."""
    board = db.get_board(user["id"], board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def check_password(user: dict, password: str):
    if not verify_password(password, db.get_password_hash(user["id"])):
        raise HTTPException(status_code=403, detail="Wrong password")


def summary(board: dict) -> dict:
    return {key: board[key] for key in ("id", "name", "createdAt", "updatedAt")}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Accounts


@app.post("/api/register", status_code=201)
def register(registration: Registration, request: Request):
    try:
        user_id = db.create_user(registration.username, hash_password(registration.password))
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="That username is taken")
    db.create_board(user_id, FIRST_BOARD_NAME, db.default_board())
    request.session["user_id"] = user_id
    return db.get_user(user_id)


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    user = db.get_user_by_username(credentials.username)
    if user is None or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["user_id"] = user["id"]
    return db.get_user(user["id"])


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return user


@app.put("/api/me/password")
def change_password(change: PasswordChange, user: dict = Depends(current_user)):
    check_password(user, change.current_password)
    db.set_password_hash(user["id"], hash_password(change.new_password))
    return {"status": "ok"}


@app.delete("/api/me", status_code=204)
def delete_account(confirmation: PasswordConfirmation, request: Request, user: dict = Depends(current_user)):
    check_password(user, confirmation.password)
    db.delete_user(user["id"])
    request.session.clear()
    return Response(status_code=204)


# Boards


@app.get("/api/boards")
def list_boards(user: dict = Depends(current_user)):
    return db.list_boards(user["id"])


@app.post("/api/boards", status_code=201)
def create_board(request: BoardNameRequest, user: dict = Depends(current_user)):
    board_id = db.create_board(user["id"], request.name, db.empty_board())
    return db.get_board(user["id"], board_id)


@app.get("/api/boards/{board_id}")
def read_board(board: dict = Depends(owned_board)):
    return board


@app.patch("/api/boards/{board_id}")
def rename_board(request: BoardNameRequest, board: dict = Depends(owned_board), user: dict = Depends(current_user)):
    db.rename_board(board["id"], request.name)
    return summary(db.get_board(user["id"], board["id"]))


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board(board: dict = Depends(owned_board)):
    db.delete_board(board["id"])
    return Response(status_code=204)


def save_data(board: dict, data: Board) -> dict:
    """Save the board's data unless its column ids differ from the stored ones."""
    if [column.id for column in data.columns] != [column["id"] for column in board["data"]["columns"]]:
        raise HTTPException(status_code=422, detail="Column ids cannot change")
    dumped = data.model_dump(by_alias=True)
    db.save_board_data(board["id"], dumped)
    return dumped


@app.put("/api/boards/{board_id}/data", response_model=Board)
def update_board_data(data: Board, board: dict = Depends(owned_board)):
    return save_data(board, data)


@app.post("/api/boards/{board_id}/chat")
def chat(request: ChatRequest, board: dict = Depends(owned_board), user: dict = Depends(current_user)):
    result = ai.chat(board["data"], request.history, request.message)
    if result.board is None:
        return {"reply": result.reply, "board": None}
    try:
        data = Board(
            columns=result.board.columns,
            cards={card.id: card for card in result.board.cards},
        )
    except ValidationError as error:
        raise HTTPException(status_code=502, detail=f"AI returned an invalid board: {error}")
    # The AI call takes seconds; don't overwrite edits the user saved meanwhile
    if db.get_board(user["id"], board["id"])["data"] != board["data"]:
        raise HTTPException(status_code=409, detail="The board changed while the AI was working")
    return {"reply": result.reply, "board": save_data(board, data)}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
