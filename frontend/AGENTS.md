# Frontend

Next.js 16 (App Router), React 19, Tailwind v4, `@dnd-kit` for drag and drop. Built as a static export (`output: "export"`) and served by the FastAPI backend; all data comes from `/api`. There is no standalone dev mode: run the app with `scripts/start.sh`.

## Structure

- `src/app/layout.tsx` - root layout, loads fonts (Space Grotesk as `--font-display`, Manrope as `--font-body`).
- `src/app/page.tsx` - client page: checks `/api/me`, renders `LoginForm` or `KanbanBoard`.
- `src/app/globals.css` - color tokens as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow). Components use them via `bg-[var(--...)]`.
- `src/lib/kanban.ts` - data model and pure logic:
  - `BoardData = { columns: Column[]; cards: Record<string, Card> }`. Columns are ordered and each holds ordered `cardIds`; card content lives in the `cards` map.
  - `moveCard(columns, activeId, overId)` - reorders within a column or moves across columns. `overId` may be a card id (insert at that card's position) or a column id (append to end).
  - `createId(prefix)` - random id generator.
- `src/lib/api.ts` - fetch wrappers for login/logout/me, board get/save, chat.
- `src/components/KanbanBoard.tsx` - loads the board from the API, owns board state and the `DndContext`. Every change is saved with a whole-board PUT; column renames save on blur. Renders `ChatSidebar`, which replaces the board state when the AI returns an update.
- `src/components/LoginForm.tsx` - sign in form.
- `src/components/ChatSidebar.tsx` - collapsible AI chat; keeps the conversation history in state and sends it with each message.
- `src/components/KanbanColumn.tsx` - droppable column with inline-editable title input and a `SortableContext` of cards.
- `src/components/KanbanCard.tsx` - sortable card with inline Edit and Remove. While editing, the sortable attributes/listeners are not applied (dnd-kit's `aria-disabled` would disable the inputs).
- `src/components/KanbanCardPreview.tsx` - card rendering used in the `DragOverlay`.
- `src/components/NewCardForm.tsx` - collapsible add-card form.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`, with `fetch` stubbed. `src/test/board.ts` provides a small test board and a mocked board API.
- E2E (Playwright, chromium, `workers: 1`): `tests/*.spec.ts` against the running container at `http://127.0.0.1:8000` (`BASE_URL` overrides). Tests share the single user's board, so `signInToBoard` resets it to `backend/app/seed_board.json` first. The live AI test runs only with `LIVE_AI=1`.

Test selectors rely on `data-testid="column-<id>"` and `data-testid="card-<id>"`.

## Commands

```bash
npm run build
npm run lint
npm run test:unit
npm run test:e2e
```
