# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4, built as a static export (`output: "export"` writes `out/`), which the FastAPI backend serves at `/`. Users sign in or register, see their list of boards, and open one; boards are loaded from and saved to the backend API.

## Structure

- `src/app/layout.tsx` - root layout; loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) via `next/font/google`
- `src/app/page.tsx` - client component; checks `/api/me` on load (a failed check counts as signed out) and shows `AuthForm` when signed out. Signed in, it renders the page layout with `AppHeader`, then `BoardList`, or `KanbanBoard` when the URL hash is `#board=<id>` (read with `useSyncExternalStore` on `hashchange`, so reload and the back button work). Log out and account deletion clear the hash
- `src/app/globals.css` - Tailwind import and color tokens as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--surface-column`, `--stroke`, `--shadow`)
- `src/lib/api.ts` - backend calls through `request()`, which throws an `ApiError` (with `status`, and the server's `detail` as the message when it is a string) on a non-OK response. Accounts: `getMe` (null on 401), `login`, `register`, `logout`, `changePassword`, `deleteAccount`. Boards: `listBoards`, `createBoard`, `fetchBoard`, `renameBoard`, `deleteBoard`, `saveBoard(id, data)` (whole board data via `PUT /api/boards/{id}/data`; saves are queued so they reach the server in order), `sendChat(boardId, ...)` (waits for pending saves first so the AI sees the latest board). Types `User`, `BoardSummary`, `Board` (summary plus `data`), `ChatMessage`
- `src/lib/kanban.ts` - data types (`Card`, `Column`, `BoardData`), `moveCard` (pure reorder/move logic for drag and drop), `createId`
- `src/components/AuthForm.tsx` - sign in form that switches to "Create account" (registration, with the username pattern and 8-character password minimum as input constraints); shows the server's error message
- `src/components/AppHeader.tsx` - title, and Boards (back to the list), account (the username; opens `AccountDialog`) and Log out buttons
- `src/components/AccountDialog.tsx` - modal for changing the password and deleting the account (after `window.confirm`). Rendered through a portal into `document.body`, because the header's `backdrop-filter` would otherwise become the containing block of its `fixed` overlay
- `src/components/BoardList.tsx` - the user's boards as tiles (open, rename inline, delete after `window.confirm`), a create form (opens the new board), an empty state, and errors as an alert
- `src/components/KanbanBoard.tsx` - takes `boardId` (the page keys it by id, so switching boards remounts it); fetches the board on mount (shows the error, such as "Board not found", if that fails), and every change (drag, column rename, add, edit, delete) updates state and saves the whole board data; dnd-kit `DndContext`, `closestCorners`, `PointerSensor` with a 6px activation distance; renders the board name and card count, then the columns plus `DragOverlay`. The page fills the viewport (`h-dvh`): columns share the full width (`auto-cols-[minmax(240px,1fr)]`) and scroll sideways once they reach that minimum, and each column's card list scrolls on its own
- `src/components/ChatSidebar.tsx` - AI chat panel for the open board that floats over it (`fixed`, so the board keeps its width; full screen on mobile), with a floating "AI chat" button when closed; keeps the chat history in state and sends it with each message; disables the input while waiting; when the reply includes a board, passes it to `onBoardChange` (already saved by the backend, so not saved again). On failure the unanswered message is removed from the history and put back in the input; a 409 gets its own message (the board changed while the AI was working)
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

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. `src/test/api.ts` has `mockApi({ signedIn, boards, chat })`, an in-memory fake of every backend route stubbed into `fetch` (accounts `{ user: "password" }`; `chat` may return a `Response` to fake an error status), plus `testBoard`, `boardRecord(id, name, data?)`, `requests(fetchMock, method, url)` (parsed bodies of matching calls) and `savedBoards()`. `src/test/setup.ts` raises the Testing Library async timeout to 5s, because parallel runs with coverage can exceed the 1s default. Run `npm run test:unit`, or `npm run test:coverage` (fails below 90% statements, branches, functions or lines).
- E2E (Playwright, Chromium): `tests/*.spec.ts`, helpers in `tests/helpers.ts`. Runs against the Docker container at http://localhost:8000, so start it first with `scripts/start`. Each test registers a fresh user through the API (`registerUser`), so tests are isolated and start from the demo board. Run `npm run test:e2e`.
- Testing gotchas: wrap components using dnd-kit in a `DndContext` with the same `PointerSensor` activation distance as the board, or clicks are swallowed as drags; the card `<article>` has `role="button"`, so match its inner buttons with `exact: true`; Next renders a hidden `role="alert"` route announcer, so find alerts by text in E2E; Playwright matches role names and labels as substrings ("My first board" also matches "Rename My first board"), so pass `exact: true` when names overlap.

## Conventions

- Components are named exports, arrow functions, typed props
- `@/` alias maps to `src/`
- Styling uses Tailwind utility classes with the CSS variables above; `data-testid` on columns (`column-<id>`) and cards (`card-<id>`)
