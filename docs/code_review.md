# Code Review

Date: 2026-11-03. Scope: the whole repository at commit `6de88d1` (backend, frontend, Docker, scripts, docs, tests).

## Summary

The codebase is small, readable and close to the plan. The single `BoardData` shape across UI, API, DB and AI keeps things simple, and the validation in `backend/app/models.py` plus the fixed-column check in `main.py` are the right guard rails. Most problems are in failure paths: errors are either ignored (frontend saves) or turned into unhandled 500s (AI calls). There is one confirmed resource leak in the DB layer and one lost-update bug between the chat and manual edits.

Checks run during this review:

| Check | Result |
| --- | --- |
| `uv run pytest` (backend) | 19 passed, 3 live deselected |
| `uv run pytest -W error::ResourceWarning` | passes, but 47 `ResourceWarning: unclosed database` warnings |
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run test:unit` | 15 passed |
| E2E / live AI tests | not run (need the container and an API key) |

## Remediation status (2026-11-03)

Items 1-10 (all P1 and P2) are fixed. P3 items 11-17 are open, except the AI error and save/load tests from item 17, which were added.

| Item | Fix |
| --- | --- |
| 1 | `db.connect()` is a context manager that commits and closes. `filterwarnings` turns `ResourceWarning` into a test failure. |
| 2, 3 | `api.ts` throws `ApiError` on non-2xx. `KanbanBoard` shows an alert on load/save failure and calls `onLogout` on 401. |
| 4 | `/api/chat` returns 409 and does not save if the board changed while the AI was working. The sidebar explains this. |
| 5 | `openai.OpenAIError` (including a missing key) and an empty parse return 502. |
| 6 | Saves are chained on a ref so they run one at a time. |
| 7 | `start.ps1` drops `ErrorActionPreference = "Stop"` and checks `$LASTEXITCODE`. Not run on Windows. |
| 8 | `SESSION_SECRET` documented in the README. |
| 9 | A failed chat message is removed from history and put back in the input. |
| 10 | `dev`, `start` and `test` npm scripts removed. |

Verification: backend pytest 23 passed (4 new); frontend unit 21 passed (7 new); every new test fails against the pre-fix code. Lint and `tsc` are clean. E2E: 10 passed, 1 skipped (live AI, no API key). In the container, chat without a key returns 502 and the board persists across a restart.

## Findings and actions

Priority: **P1** fix now (bug or data loss), **P2** fix soon (robustness, misleading behavior), **P3** cleanup.

### P1

**1. SQLite connections are never closed** - `backend/app/db.py:25-56`

`with sqlite3.connect(...) as conn` only commits or rolls back; it does not close the connection. Python 3.13 reports this: running the tests with `-W error::ResourceWarning` prints 47 `unclosed database` warnings, and a direct `init_db(); get_board()` call emits two. Connections are only released by garbage collection.

Action: close explicitly, e.g. `with contextlib.closing(sqlite3.connect(DB_PATH)) as conn, conn:` inside `connect()` as a context manager, or `conn.close()` after each block. Add `-W error::ResourceWarning` to `addopts` in `pyproject.toml` so it cannot regress.

**2. Board saves fail silently** - `frontend/src/lib/api.ts:29-35`, `frontend/src/components/KanbanBoard.tsx:42-45`

`saveBoard` ignores the response status and `commit` does not await it. If the session has expired (401), the server rejects the board (422), or the container is down, the UI shows the change as saved and it is lost on reload with no indication.

Action: have `saveBoard` throw on `!response.ok` and show a small inline error in `KanbanBoard` (same pattern as `ChatSidebar`). On 401, return to the login form.

**3. Board load crashes on a non-200 response** - `frontend/src/lib/api.ts:24-27`, `frontend/src/components/KanbanBoard.tsx:34-36`

`getBoard` returns whatever JSON comes back. If `/api/board` returns 401 (expired session after `/api/me` succeeded, or cookie cleared), the board state becomes `{"detail": "Not signed in"}` and `board.columns.map` throws, leaving a blank page. Verified that the 401 body is `{'detail': 'Not signed in'}`.

Action: check `response.ok` in `getBoard` and route a 401 back to the login form (shared with action 2).

**4. Chat overwrites edits made while the AI is thinking** - `backend/app/main.py:94-104`, `frontend/src/components/KanbanBoard.tsx:191`

`/api/chat` reads the board at the start of the request, waits several seconds for the model, then saves the AI board. Any card the user added, moved or edited in that window is overwritten on the server, and `onBoardUpdate={setBoard}` then removes it from the UI too.

Action (simplest): block board edits while a chat request is in flight (e.g. pass `isLoading` up and render the board with `pointer-events-none opacity-60`). Alternative: an `updated_at` check in `update_board` that returns 409 if the board changed since it was read, surfaced as "board changed, please retry".

### P2

**5. AI failures return unhandled 500s** - `backend/app/ai.py:42-71`, `backend/app/main.py:97`

Verified with a probe: a missing `OPENROUTER_API_KEY` (`KeyError`) returns 500, and `message.parsed` being `None` (model refusal) returns 500 via `AttributeError`. Network/API errors from the `openai` SDK (`openai.APIError`) and `LengthFinishReasonError` also surface as 500 with a stack trace in the logs.

Action: in the `chat` route, catch `openai.OpenAIError` and a `None` parse result and return the same 502 used for invalid boards. Read the key once at startup or fail with a clear message.

**6. Out-of-order saves can persist an older board** - `frontend/src/components/KanbanBoard.tsx:42-45`

Each change fires an independent whole-board PUT. Two quick changes (e.g. drag then delete) can be sent on separate connections and handled by different threadpool workers, so the older board can be written last.

Action: serialize saves by chaining them on a ref'd promise (`saving.current = saving.current.then(() => saveBoard(next))`). Three lines, no new dependency.

**7. `start.ps1` likely aborts on first run under Windows PowerShell 5.1** - `scripts/start.ps1:1,4`

With `$ErrorActionPreference = "Stop"`, redirecting a native command's stderr (`docker rm -f pm-app 2>$null`) turns the "No such container" message into a terminating error in Windows PowerShell 5.1. PowerShell 7 is not affected. Not verified on Windows.

Action: verify on PowerShell 5.1; if it reproduces, use `docker rm -f pm-app *> $null; $global:LASTEXITCODE = 0` or drop `ErrorActionPreference` and check `$LASTEXITCODE` after `docker build`.

**8. Default session secret** - `backend/app/main.py:25`, `scripts/start.sh`, `scripts/start.ps1`

`SESSION_SECRET` falls back to `"dev-secret"` and nothing sets it, so anyone who knows the default can forge a session cookie. Acceptable for a local MVP, but it is the one thing to change before the app is reachable by anyone else.

Action: document `SESSION_SECRET` next to `OPENROUTER_API_KEY` in the README `.env` instructions. No code change needed for the MVP.

**9. Failed chat leaves a dangling user message in history** - `frontend/src/components/ChatSidebar.tsx:30-41`

On error the user message stays in `messages` with no assistant reply, so the next request sends two consecutive user turns, and the failed request text is silently re-sent as context.

Action: on error, drop the last message (`setMessages(messages)`) and put the text back in the input so the user can retry.

**10. Unused or broken npm scripts** - `frontend/package.json:6-10`

`next start` does not work with `output: "export"`, and `next dev` cannot reach `/api` (frontend `AGENTS.md` says there is no standalone dev mode). `test` duplicates `test:unit`.

Action: remove `dev`, `start` and `test`.

### P3

**11. Committed test artifact** - `frontend/test-results/.last-run.json`

Tracked in git although `frontend/test-results/` is in `.gitignore`.

Action: `git rm --cached frontend/test-results/.last-run.json`.

**12. Unused default assets** - `frontend/public/{file,globe,next,vercel,window}.svg`

Leftovers from `create-next-app`; nothing references them.

Action: delete them.

**13. Dependencies behind latest** (coding standard 1)

`npm outdated`: `next`/`eslint-config-next` 16.1.6 -> 16.4.5, `react`/`react-dom` 19.2.3 -> 19.3.1, `vitest` 3 -> 4, `@vitejs/plugin-react` 5 -> 6, `jsdom` 27 -> 29, `@playwright/test` 1.58 -> 1.64, `tailwindcss` 4.1 -> 4.3, `@types/node` 20 -> 26 (the image uses Node 24, so `^24` matches the runtime). TypeScript 7 and ESLint 10 are major jumps; take them separately. Backend: only `openai` 3.43 -> 3.44.

Action: bump the minor versions now and run lint/unit/e2e; do the vitest 4 major upgrade as its own change.

**14. Docker runtime goes through `uv run`** - `Dockerfile:16`

`uv run` checks and may re-sync the environment on every container start. The image also runs as root.

Action: `ENV PATH="/app/.venv/bin:$PATH"` and `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`. Running as a non-root user is optional for a local MVP (the `pm-data` volume would need matching ownership).

**15. Inconsistent empty-details handling** - `frontend/src/components/KanbanBoard.tsx:79`, `KanbanCard.tsx:41`

Adding a card with no details stores `"No details yet."` as real data (it is then sent to the AI and persisted), while editing a card to empty details stores `""`.

Action: store `""` in both cases and render the placeholder text only in the UI, or drop the placeholder.

#### 16. Minor simplifications

- `handleDeleteCard(columnId, cardId)` (`KanbanBoard.tsx:96`): the column id is unnecessary; filter `cardId` out of every column and drop the extra prop threading through `KanbanColumn`.
- `createId` (`frontend/src/lib/kanban.ts:108`): `crypto.randomUUID()` is the idiomatic replacement.
- `ai.client()` (`backend/app/ai.py:42`) builds a new HTTP client per request; a module-level client created on first use is enough.
- Stray double blank lines in `backend/app/main.py:15-16,74-75`. Running `uvx ruff format` and `uvx ruff check` occasionally keeps Python style consistent without adding config.
- `NewCardForm` inputs rely on placeholders only; add `aria-label`s, matching `KanbanCard`.
- An empty column title is accepted (`KanbanColumn.tsx:47`); either ignore blank renames on blur or leave it.

#### 17. Test gaps

- No backend test for AI client errors or a `None` parse (covers action 5).
- No frontend test for save/load failures (covers actions 2 and 3).
- E2E `renames a column` (`frontend/tests/kanban.spec.ts:17`) only checks the input value, which is true before any save; blur and reload to make it meaningful (persistence is covered elsewhere, so this test could also be removed).
- Plan items still open: Part 8 live connectivity test, Part 9 live tests, Part 10 live e2e (`docs/PLAN.md`). These need `.env` with `OPENROUTER_API_KEY`.

## What is in good shape

- One data shape end to end, with server-side validation on every write (UI and AI), and the nested-columns AI schema converted in one small function (`ai.to_board`).
- Tests are focused and fast: temp DB per test, AI mocked, live tests opt-in by marker and env var.
- Auth is minimal and correct for the MVP: signed cookie, `current_user` dependency on every board/chat route, 401 tests in place.
- Scripts are short and idempotent; data persists on the `pm-data` volume.
- Docs (`AGENTS.md` files, `DATABASE.md`) match the code.

## Suggested order

1. Actions 1-4 (leak, silent save failures, load crash, chat lost update), with tests from action 17.
2. Actions 5, 6, 9 (AI error handling, save ordering, chat retry).
3. Actions 10-12 and 14-16 as one cleanup commit.
4. Action 13 dependency bumps, then the live tests in `docs/PLAN.md`.
