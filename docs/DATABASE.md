# Database

SQLite file at `data/pm.db` (`/app/data/pm.db` in the container, on the `pm-data` volume). Path can be overridden with `DB_PATH`. Tables are created on startup if missing; the `user` account is seeded, and a user's board is seeded from `backend/app/seed_board.json` the first time it is read.

## Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Board JSON (`boards.data`)

Same shape as the frontend `BoardData` type:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] },
    { "id": "col-done", "title": "Done", "cardIds": [] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes." }
  }
}
```

Rules enforced by the backend (Pydantic) on every write:

- Every id in `cardIds` exists in `cards`, and every card appears in exactly one column.
- Each `cards` key equals that card's `id`.
- Column ids cannot change (columns are fixed; only titles can be renamed).

## Why whole-board JSON

The board is always read and written as a unit (by the UI and by the AI), so one JSON column keeps the API and AI updates trivial with no ORM or joins. Multiple users already work (one row per user); multiple boards per user later means dropping the `UNIQUE` on `boards.user_id` and adding a name.
