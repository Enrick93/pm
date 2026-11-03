# Project Plan

Each part is completed and verified before moving to the next. Check off substeps as they are done.

## Key decisions

- One Docker image, multi-stage: Node stage runs `next build` with `output: "export"`; Python stage (uv) runs FastAPI with uvicorn on port 8000 and serves the exported `out/` at `/` via `StaticFiles(html=True)`. API routes live under `/api`.
- Backend layout: `backend/pyproject.toml`, `backend/app/` (main, db, auth, ai modules), `backend/tests/` (pytest).
- SQLite file at `/app/data/pm.db`, persisted with a Docker named volume. Created with tables and seed data on startup if missing.
- Auth: hardcoded `user` / `password`. `POST /api/login` sets a signed session cookie (Starlette `SessionMiddleware`); `POST /api/logout` clears it; `GET /api/me` returns the user or 401. Board and AI routes require the session.
- The frontend stays a static client app: on load it calls `/api/me` and shows either the login form or the board.
- Board API is whole-board read/write (`GET /api/board`, `PUT /api/board`) using the existing `BoardData` JSON shape. The AI returns the same shape, so one validation model (Pydantic) covers both.
- AI: `openai` Python SDK pointed at `https://openrouter.ai/api/v1`, model `openai/gpt-oss-120b`, key from `OPENROUTER_API_KEY` (passed with `--env-file .env`). Conversation history is held in the frontend and sent with each request.
- Scripts: `scripts/start.sh` / `scripts/stop.sh` (Mac and Linux), `scripts/start.ps1` / `scripts/stop.ps1` (Windows). They build the image and run/stop a named container.
- E2E tests run against the running container at `http://127.0.0.1:8000` from Part 3 onward.

## Part 1: Plan

- [x] Enrich this document with substeps, tests and success criteria
- [x] Create `frontend/AGENTS.md` describing the existing frontend
- [x] User reviews and approves the plan

Success: user approval.

## Part 2: Scaffolding

- [x] `backend/pyproject.toml` with fastapi, uvicorn; dev deps pytest, httpx
- [x] `backend/app/main.py`: `GET /api/health` returns `{"status": "ok"}`; serves a placeholder `static/index.html` at `/` that calls `/api/health` and displays the result
- [x] `Dockerfile` at project root using uv (`uv sync --frozen`), runs uvicorn on 8000
- [x] `.dockerignore` (node_modules, .next, out, .venv, .env, data)
- [x] Start/stop scripts for Mac/Linux and Windows
- [x] pytest for `/api/health` and `/`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`

Tests: `uv run pytest` in `backend/`.
Success: `scripts/start.sh` builds and runs the container; `http://localhost:8000` shows hello world and the API response; `scripts/stop.sh` stops it.

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`
- [x] Dockerfile: Node build stage, copy `out/` into the Python image; FastAPI serves it at `/` (replacing the placeholder)
- [x] Point Playwright `baseURL` at `http://127.0.0.1:8000` (overridable by env) and drop the dev `webServer`
- [x] Extend unit tests to cover the board components; add e2e tests for rename column and remove card

Tests: `npm run test:unit`, `npm run lint`, `npm run test:e2e` against the container, backend pytest still green.
Success: the demo Kanban board renders at `http://localhost:8000` from the container and all tests pass.

## Part 4: Fake user sign in

- [x] Backend: `SessionMiddleware`, `/api/login`, `/api/logout`, `/api/me`; session secret from env with a dev default
- [x] Frontend: `LoginForm` component; `page.tsx` checks `/api/me` and renders login or board; logout button in the board header
- [x] Backend tests: valid login, invalid login (401), `/api/me` with and without session, logout clears session
- [x] Unit tests: login form submit, error on bad credentials, logout (fetch mocked)
- [x] E2E: board hidden until login; bad credentials show error; login shows board; logout returns to login; reload keeps session

Success: you must log in with `user` / `password` to see the board, and can log out.

## Part 5: Database modeling

- [x] Propose schema in `docs/DATABASE.md`:
  - `users (id, username unique, created_at)`
  - `boards (id, user_id unique -> users.id, data JSON text, updated_at)`
  - `data` holds the `BoardData` JSON (`columns` with ordered `cardIds`, `cards` map)
- [x] Include an example `data` JSON and explain the trade-off: whole-board JSON keeps reads/writes and AI updates trivial; multi-board or multi-user later just adds rows
- [x] User sign-off

Success: user approves `docs/DATABASE.md`.

## Part 6: Backend

- [x] `app/db.py`: stdlib `sqlite3`, create tables if missing, seed user `user` and a board with the current `initialData` on first run
- [x] Pydantic models for `Card`, `Column`, `BoardData`, with validation that every `cardIds` entry exists in `cards` and every card belongs to exactly one column
- [x] `GET /api/board` and `PUT /api/board` for the session user
- [x] Tests (temp DB per test): DB created when missing, seed board returned, PUT then GET round-trips, invalid board rejected (422), unauthenticated requests rejected (401)

Success: `uv run pytest` green; board persists across container restarts.

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts` with `getBoard` / `saveBoard`
- [x] `KanbanBoard` loads the board from the API and saves after each change (rename saves on blur, not per keystroke)
- [x] Add card editing (title and details) to meet the business requirement
- [x] Remove `initialData` from the frontend (seed lives in the backend)
- [x] Unit tests with mocked fetch: load, save on move/add/delete/rename/edit
- [x] E2E: add, edit, move, rename, delete, then reload and verify persistence; restart container and verify persistence

Success: all board changes persist across reloads and container restarts.

## Part 8: AI connectivity

- [x] `app/ai.py`: OpenAI client configured for OpenRouter
- [ ] Test-only connectivity check: a pytest marked `live` that asks "What is 2+2?" and asserts "4" in the reply; skipped when `OPENROUTER_API_KEY` is unset

Tests: `uv run --env-file ../.env pytest -m live`. Written; not yet run (no `.env` with `OPENROUTER_API_KEY`).
Success: live test passes inside the container.

## Part 9: AI with structured outputs

- [x] `POST /api/chat` with `{ message, history }`; sends system prompt + current board JSON + history + message
- [x] Structured output schema: `{ reply: string, board: BoardData | null }`
- [x] If `board` is present, validate with the Pydantic model and save it; return `{ reply, board }`
- [x] Tests with the AI call mocked: reply only (board unchanged), reply with board update (saved), invalid board from AI (rejected, board unchanged), unauthenticated (401)
- [ ] Live tests: ask to create a card, move a card; verify the saved board

Success: the AI can create, edit and move one or more cards via the API.

## Part 10: AI chat sidebar

- [x] `ChatSidebar` component: message list, input, send button (purple), loading state; collapsible
- [x] Holds history in state; calls `/api/chat`; when a board is returned, replaces board state so the UI refreshes
- [x] Unit tests with mocked fetch: send message, render reply, board refresh on update, error display
- [ ] E2E (live, against the container): ask the AI to add a card and see it appear on the board

Success: chatting in the sidebar works and AI board changes appear immediately without reload.
