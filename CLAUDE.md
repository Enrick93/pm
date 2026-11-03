# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project requirements, technical decisions, color scheme and coding standards live in AGENTS.md and are authoritative:

@AGENTS.md

Work is executed in phases defined in `docs/PLAN.md`. Read it before starting, and check off substeps there as they are completed. Each subdirectory (`frontend/`, `backend/`, `scripts/`) has its own `AGENTS.md` that should be kept up to date as that area is built out.

## Architecture

One Docker image: a Node stage builds the Next.js static export, and a Python stage (uv) runs FastAPI on port 8000, serving the export at `/` and the API under `/api`. SQLite lives on the `pm-data` volume. The board is stored and exchanged as one JSON document (`BoardData`: ordered `columns` with `cardIds`, plus a `cards` map) everywhere: UI, API, database and AI. The AI returns the board in a nested columns-with-cards form for structured outputs, which `backend/app/ai.py` converts. See `backend/AGENTS.md`, `frontend/AGENTS.md` and `docs/DATABASE.md` for details.

## Run

```bash
scripts/start.sh      # build image and run container on :8000 (needs .env with OPENROUTER_API_KEY for AI)
scripts/stop.sh
```

## Backend commands (run in `backend/`)

```bash
uv run pytest                                   # AI calls mocked; live tests excluded by default
uv run pytest tests/test_chat.py -k invalid     # single test
uv run --env-file ../.env pytest -m live        # real OpenRouter calls
```

## Frontend commands (run in `frontend/`)

```bash
npm install
npm run build
npm run lint
npm run test:unit                   # vitest (jsdom), src/**/*.test.ts(x)
npx vitest run src/lib/kanban.test.ts           # single unit test file
npx vitest run -t "test name"                   # single test by name
npm run test:e2e                    # playwright against the running container on :8000
npx playwright test tests/kanban.spec.ts -g "name"  # single e2e test
```
