# Backend

FastAPI app managed with uv (Python 3.13). Serves the API under `/api` and the static Next.js export at `/` (from `STATIC_DIR`, default `backend/static`; the Docker build copies `frontend/out` there).

## Modules (`app/`)

- `main.py` - app, session middleware, routes:
  - `GET /api/health`
  - `POST /api/login`, `POST /api/logout`, `GET /api/me` - hardcoded `user` / `password`, signed session cookie (`SESSION_SECRET`, dev default)
  - `GET /api/board`, `PUT /api/board` - whole-board read/write for the session user; column ids cannot change (422)
  - `POST /api/chat` - `{ message, history }` -> `{ reply, board | null }`; an AI board update is validated and saved, invalid ones return 502 and leave the board unchanged
- `models.py` - Pydantic `Card`, `Column`, `Board` (same shape as frontend `BoardData`); validates every card is in exactly one column.
- `db.py` - stdlib `sqlite3`; `DB_PATH` (default `data/pm.db`). Tables created on startup; a user's board is seeded from `seed_board.json` on first read. See `docs/DATABASE.md`.
- `ai.py` - OpenAI SDK against OpenRouter, model `openai/gpt-oss-120b`. `chat()` uses structured outputs (`AIResponse`: `reply` plus optional full board as columns with nested cards, since strict schemas cannot use dict keys); `to_board()` converts it to `Board`.

## Tests

```bash
uv run pytest                                    # all non-live tests (AI mocked)
uv run pytest tests/test_board.py::test_put_then_get_round_trips
uv run --env-file ../.env pytest -m live         # real OpenRouter calls
```

Fixtures in `tests/conftest.py`: `client` (fresh temp DB per test), `auth_client` (signed in).
