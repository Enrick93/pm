import os
from contextlib import asynccontextmanager
from pathlib import Path

import openai
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.models import Board

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    SessionMiddleware, secret_key=os.environ.get("SESSION_SECRET", "dev-secret")
)


class Credentials(BaseModel):
    username: str
    password: str


class ChatRequest(BaseModel):
    message: str
    history: list[ai.Message] = []


class ChatResponse(BaseModel):
    reply: str
    board: Board | None


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username != "user" or credentials.password != "password":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


def update_board(username: str, board: Board) -> Board:
    current = db.get_board(username)
    if [c.id for c in board.columns] != [c.id for c in current.columns]:
        raise HTTPException(status_code=422, detail="Columns are fixed")
    db.save_board(username, board)
    return board


@app.get("/api/board")
def read_board(username: str = Depends(current_user)) -> Board:
    return db.get_board(username)


@app.put("/api/board")
def write_board(board: Board, username: str = Depends(current_user)) -> Board:
    return update_board(username, board)


@app.post("/api/chat")
def chat(request: ChatRequest, username: str = Depends(current_user)) -> ChatResponse:
    board = db.get_board(username)
    try:
        result = ai.chat(board, request.history, request.message)
    except openai.OpenAIError:
        raise HTTPException(status_code=502, detail="The AI request failed")
    if result is None:
        raise HTTPException(status_code=502, detail="The AI returned no response")
    if result.columns is None:
        return ChatResponse(reply=result.reply, board=None)
    if db.get_board(username) != board:
        raise HTTPException(status_code=409, detail="The board changed during the request")
    try:
        new_board = update_board(username, ai.to_board(result.columns))
    except (ValidationError, HTTPException):
        raise HTTPException(status_code=502, detail="The AI returned an invalid board")
    return ChatResponse(reply=result.reply, board=new_board)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
