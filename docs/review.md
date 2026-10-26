# Code Review

Scope: the whole repository on `feature/mvp` (backend, frontend, Docker, scripts, tests), including the uncommitted working-tree changes (save-error banner, chat 409 check). Checked against `AGENTS.md` and `docs/PLAN.md`.

## Verification

- Backend `uv run pytest`: 44 passed, 7 deselected (`ai` marker).
- Frontend `vitest run`: 32 passed.
- Frontend `eslint`: clean.
- Frontend `next build`: succeeds (static export).
- Frontend `tsc --noEmit`: 1 error (finding 6).
- Docker image and Playwright suite not run.

## Summary

The MVP meets every business requirement in `AGENTS.md`: sign in, one persisted board per user, renamable fixed columns, drag and drop, card editing, and an AI sidebar that can create, edit and move several cards at once. The code is small, consistent and easy to follow. Board validation (`models.py`) is strict and well tested. Saves are queued in order, and the chat route refuses to overwrite edits made while the AI was working. No blocking issues. The findings below are mostly error paths that give the user no feedback, plus a few small races.

The uncommitted changes are correct and tested: `saveBoard` now rejects on a non-OK response, the board shows an alert and clears it after the next successful save, and `/api/chat` returns 409 if the board changed during the AI call. Commit them.

## Findings

### Medium

1. **A failed start-up request leaves a blank page or crashes the app.**
   `page.tsx:13`: if `getMe()` rejects (for example, the container is down), `username` stays `undefined` and the page renders `null` forever.
   `api.ts:28-31`: `fetchBoard` does not check `response.ok`. A 500 response has a plain-text body, so `response.json()` rejects and the page stays on "Loading board..." forever. A 401 response parses to `{detail: ...}`, and `KanbanBoard.tsx:169` then throws on `board.columns.map`. With no error boundary, the whole page unmounts.
   Fix: make `fetchBoard` throw on a non-OK response, and have `page.tsx` and `KanbanBoard` treat a rejected promise as signed out (show the login form). There is no test for this path.

2. **A 409 from chat looks like a generic failure, and the user is not told what happened.**
   `ChatSidebar.tsx:42-43` shows "Something went wrong. Please try again." for every error. A 409 happens whenever the user edits the board while the AI is thinking, which the UI allows (only the chat input is disabled). The AI's work is discarded and the user cannot tell why. Fix: have `sendChat` surface the status and show "The board changed while the AI was working. Please send your request again." for 409.

### Low

3. **The client and server can disagree after an AI change in a narrow window.**
   The 409 check (`main.py:113`) and the save (`main.py:115`) are separate steps, and the client applies the AI board without merging (`KanbanBoard.tsx:209`, `onBoardChange={setBoard}`). Suppose the user makes an edit after the server saves the AI board but before the response reaches the browser. The user's `PUT` (built from the pre-AI board) overwrites the AI board on the server, then the browser replaces its state with the AI board. The server now holds the user's edit, and the screen shows the AI's change. The next edit saves the screen state and silently drops the user's earlier edit. The window is milliseconds on localhost, so this is acceptable for the MVP. If it is ever fixed, a version number on the board, checked by `PUT` and by chat, closes this race and the TOCTOU between lines 113 and 115 at once.

4. **First-board seeding is not atomic.**
   `db.get_board` (`db.py:51-60`) does `SELECT` then `INSERT`. Two concurrent first requests both see no row, and the second `INSERT` raises `IntegrityError` (500). `INSERT OR IGNORE` followed by the `SELECT` (the same pattern `get_or_create_user` already uses) fixes it in two lines.

5. **AI client errors become 500s.**
   `ai.chat` returns `message.parsed`, which is `None` on a refusal, so `main.py:103` raises `AttributeError`. The SDK raises `LengthFinishReasonError` if a long board is cut off at the token limit. OpenRouter/network errors and a missing `OPENROUTER_API_KEY` (`ai.py:51`) also go unhandled. All of these return 500 instead of the 502 the route uses for a bad AI board. The user sees the same generic message either way, so the impact is limited to server logs and status codes.

6. **`tsc --noEmit` fails on the Playwright spec.**
   `tests/chat.spec.ts:15`: `board.cards["card-ai"] = ...` does not type-check, because the imported JSON gives `cards` a fixed set of keys. `next build` does not check this file, so nothing catches it today. Fix: `const board: BoardData = structuredClone(defaultBoard);`.

7. **Column rename saves on every keystroke.**
   `KanbanColumn.tsx:46` calls `onRename` from `onChange`, so typing a 12-character title sends 12 full-board `PUT`s. It works because saves are queued. Saving on blur or Enter, with local input state, would remove the extra writes. An empty title is also accepted and saved, which leaves the column with no visible heading.

8. **Cards cannot be moved with the keyboard.**
   `KanbanBoard.tsx:29-33` registers only `PointerSensor`. Adding dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates` makes cards movable from the keyboard with no other changes.

9. **Stale edit form after an AI change.**
   `KanbanCard` copies the card into `draft` when editing starts. If the AI edits that card while the form is open, Save writes the old draft over the AI's change. This is a rare overlap.

### Nits

10. `handleAddCard` (`KanbanBoard.tsx:89`) stores the placeholder "No details yet." as real card data, while edited cards and AI-created cards use `""`. Render the placeholder at display time instead.
11. A failed chat message stays in `messages` with no reply, so it is sent as history on the next request. Chat history is also unbounded, so every request costs more tokens as the conversation grows.
12. `current_user_id` runs an `INSERT OR IGNORE` (a write transaction) on every authenticated request. The id could be stored in the session at login.
13. `/api/ai/test` and `ai.complete` were the Part 8 connectivity check. They are still exposed and spend API credit. Remove them now that `/api/chat` covers connectivity, or keep them behind the `ai` tests only.
14. `frontend/test-results/.last-run.json` is committed. Add `test-results/` and `playwright-report/` to `frontend/.gitignore` and untrack the file.
15. `SESSION_SECRET` falls back to `"dev-secret"` (`main.py:14`). This is fine locally, but it should be required anywhere beyond localhost.

## Recommendation

Commit the working-tree changes, then fix 1, 2, 4 and 6. Each is a few lines and either removes a dead-end screen or a class of 500s. Findings 3, 5 and 7-9 can wait until after the MVP.
