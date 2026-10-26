# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4, built as a static export (`output: "export"` writes `out/`), which the FastAPI backend serves at `/`. The board is loaded from and saved to the backend API.

## Structure

- `src/app/layout.tsx` - root layout; loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) via `next/font/google`
- `src/app/page.tsx` - client component; checks `/api/me` on load, shows `LoginForm` when signed out or `KanbanBoard` when signed in; handles log out
- `src/app/globals.css` - Tailwind import and color tokens as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--surface-column`, `--stroke`, `--shadow`)
- `src/lib/api.ts` - backend calls: `getMe`, `login`, `logout`, `fetchBoard`, `saveBoard` (whole board via `PUT /api/board`; saves are queued so they reach the server in order), `sendChat` (`POST /api/chat`; waits for pending saves first so the AI sees the latest board)
- `src/lib/kanban.ts` - data types (`Card`, `Column`, `BoardData`), `moveCard` (pure reorder/move logic for drag and drop), `createId`
- `src/components/LoginForm.tsx` - username/password form; shows an error on failed login
- `src/components/KanbanBoard.tsx` - client component; fetches the board on mount, and every change (drag, column rename, add, edit, delete) updates state and saves the whole board; dnd-kit `DndContext`, `closestCorners`, `PointerSensor` with a 6px activation distance; renders a compact header (with Log out button) and the columns plus `DragOverlay`. The board fills the viewport (`h-dvh`): columns share the full width (`auto-cols-[minmax(240px,1fr)]`) and scroll sideways once they reach that minimum, and each column's card list scrolls on its own
- `src/components/ChatSidebar.tsx` - AI chat panel that floats over the board (`fixed`, so the board keeps its width; full screen on mobile), with a floating "AI chat" button when closed; keeps the chat history in state and sends it with each message; disables the input while waiting; when the reply includes a board, passes it to `onBoardChange` (already saved by the backend, so not saved again)
- `src/components/KanbanColumn.tsx` - droppable column; title is an inline `<input>` (rename on change) with a card count; lists sortable cards in a scrollable list; empty-state drop target; `NewCardForm` right after the cards
- `src/components/KanbanCard.tsx` - sortable card (title, details, and Edit/Delete icon buttons that appear on hover or focus with a mouse and always show on touch screens); Edit switches to an inline title/details form, and the card is not draggable while editing
- `src/components/KanbanCardPreview.tsx` - card rendered inside the drag overlay
- `src/components/NewCardForm.tsx` - toggleable form for title + details
- Icons come from `lucide-react`; icon-only buttons have an `aria-label` (tests find them by it)

## Data model

```ts
BoardData = { columns: Column[]; cards: Record<string, Card> }
Column = { id: string; title: string; cardIds: string[] }
Card = { id: string; title: string; details: string }
```

Column order is the array order; card order is the `cardIds` order.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. `src/test/api.ts` has `mockApi()` (an in-memory fake of the backend routes, stubbed into `fetch`; pass `chat` to control `/api/chat` replies), `testBoard` and `savedBoards()`. Run `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. Runs against the Docker container at http://localhost:8000, so start it first with `scripts/start`. Board and chat tests reset the board to `backend/app/default_board.json` before each test. Run `npm run test:e2e`.
- Testing gotchas: wrap components using dnd-kit in a `DndContext` with the same `PointerSensor` activation distance as the board, or clicks are swallowed as drags; the card `<article>` has `role="button"`, so match its inner buttons with `exact: true`; Next renders a hidden `role="alert"` route announcer, so find alerts by text in E2E.

## Conventions

- Components are named exports, arrow functions, typed props
- `@/` alias maps to `src/`
- Styling uses Tailwind utility classes with the CSS variables above; `data-testid` on columns (`column-<id>`) and cards (`card-<id>`)
