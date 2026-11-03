# Kanban Studio

Project management MVP: a Kanban board with an AI assistant that can create, edit and move cards.

## Run

Put `OPENROUTER_API_KEY=...` in `.env` at the project root, then:

```bash
scripts/start.sh     # Windows: scripts/start.ps1
scripts/stop.sh      # Windows: scripts/stop.ps1
```

Open http://localhost:8000 and sign in with `user` / `password`.

## Tests

```bash
cd backend && uv run pytest
cd frontend && npm run test:unit
cd frontend && npm run test:e2e      # needs the app running
```
