# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4, built as a static export (`output: "export"` writes `out/`), which the FastAPI backend serves at `/`. Board state still lives in React state and resets on reload.

## Structure

- `src/app/layout.tsx` - root layout; loads Space Grotesk (`--font-display`) and Manrope (`--font-body`) via `next/font/google`
- `src/app/page.tsx` - client component; checks `/api/me` on load, shows `LoginForm` when signed out or `KanbanBoard` when signed in; handles log out
- `src/app/globals.css` - Tailwind import and color tokens as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--stroke`, `--shadow`)
- `src/lib/api.ts` - backend calls: `getMe`, `login`, `logout`
- `src/lib/kanban.ts` - data types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards), `moveCard` (pure reorder/move logic for drag and drop), `createId`
- `src/components/LoginForm.tsx` - username/password form; shows an error on failed login
- `src/components/KanbanBoard.tsx` - client component holding the board state; handles drag start/end (dnd-kit `DndContext`, `closestCorners`, `PointerSensor` with a 6px activation distance), column rename, add card, delete card; renders header (with Log out button) and 5-column grid plus `DragOverlay`
- `src/components/KanbanColumn.tsx` - droppable column; title is an inline `<input>` (rename on change); lists sortable cards; empty-state drop target; `NewCardForm` at the bottom
- `src/components/KanbanCard.tsx` - sortable card (title, details, Remove button)
- `src/components/KanbanCardPreview.tsx` - card rendered inside the drag overlay
- `src/components/NewCardForm.tsx` - toggleable form for title + details

## Data model

```ts
BoardData = { columns: Column[]; cards: Record<string, Card> }
Column = { id: string; title: string; cardIds: string[] }
Card = { id: string; title: string; details: string }
```

Column order is the array order; card order is the `cardIds` order.

## Not yet implemented

- Editing an existing card's title/details
- Persistence, AI chat

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.ts(x)`. Stub `fetch` with `vi.stubGlobal`. Run `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. Runs against the Docker container at http://localhost:8000, so start it first with `scripts/start`. Run `npm run test:e2e`.
- Testing gotchas: wrap components using dnd-kit in a `DndContext` with the same `PointerSensor` activation distance as the board, or clicks are swallowed as drags; the card `<article>` has `role="button"`, so match its inner buttons with `exact: true`; Next renders a hidden `role="alert"` route announcer, so find alerts by text in E2E.

## Conventions

- Components are named exports, arrow functions, typed props
- `@/` alias maps to `src/`
- Styling uses Tailwind utility classes with the CSS variables above; `data-testid` on columns (`column-<id>`) and cards (`card-<id>`)
