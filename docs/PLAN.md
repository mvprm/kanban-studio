# Project Plan

## Key decisions

- Single Docker image, built in stages: Node builds the Next.js static export (`output: "export"`), then a Python image with uv runs FastAPI, which serves the export at `/` and the API under `/api`.
- `docker compose` runs the container on port 8000, loads `.env`, and mounts `./data` for the SQLite file so it survives restarts.
- Sign in: `POST /api/login` checks the hardcoded `user` / `password` and sets a signed session cookie (Starlette `SessionMiddleware`). All board and chat routes need a session.
- Database: SQLite through Python's built-in `sqlite3`. A `users` table and a `boards` table; each board is stored as one JSON blob in the frontend's `BoardData` shape. The database is created on startup if it doesn't exist.
- API: `GET /api/board` and `PUT /api/board`, which replaces the whole board. The frontend saves the full board after each change.
- AI: OpenRouter through the `openai` Python SDK (with `base_url` set to OpenRouter), model `openai/gpt-oss-120b` (`inception/mercury-decide:free` is a decisions-only model that the chat endpoint rejects). Chat returns structured output `{ reply, board | null }`, where `board` is the whole updated board.
- Chat history is kept in the browser for the session only and is not saved to the database.
- Card editing (title and details) is added in Part 7.
- Tests: backend pytest; frontend Vitest + Playwright. Playwright runs against the running container. Tests that call the real OpenRouter API are marked `ai` and are left out of the default test run.

## Part 1: Plan

- [x] Review the existing frontend code
- [x] Write `frontend/AGENTS.md` describing the existing code
- [x] Expand this plan with substeps, tests and success criteria
- [x] User reviews and approves the plan

Success criteria: the user approves this document.

## Part 2: Scaffolding

- [x] `backend/`: uv project (`pyproject.toml`, `uv.lock`) with `fastapi`, `uvicorn`, and `pytest` + `httpx2` (the Starlette test client transport) as dev dependencies
- [x] `backend/app/main.py`: FastAPI app with `GET /api/health` returning `{"status": "ok"}`, serving a placeholder `static/index.html` at `/` that calls `/api/health` and shows the result
- [x] `Dockerfile` (in the project root) and `docker-compose.yml`, port 8000, `env_file: .env`, `./data` volume
- [x] `scripts/start.sh` and `scripts/stop.sh` (Mac and Linux), `scripts/start.bat` and `scripts/stop.bat` (PC), wrapping `docker compose up -d --build` and `docker compose down`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`; minimal root `README.md`

Tests:
- pytest: `/api/health` returns 200 and `{"status": "ok"}`; `/` returns the HTML page

Success criteria:
- `scripts/start` builds and starts the container; `http://localhost:8000` shows the hello world page, which displays the API response
- `scripts/stop` stops the container

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`; confirm `npm run build` writes `frontend/out`
- [x] Dockerfile: Node build stage copies `out/` into the Python image; FastAPI serves it at `/` (`StaticFiles(html=True)`), and API routes are registered first so `/api` takes precedence
- [x] Remove the placeholder HTML
- [x] Point Playwright at `http://localhost:8000` (the container) instead of starting the dev server
- [x] Add frontend unit tests for `KanbanColumn`, `KanbanCard` and `NewCardForm` behavior not covered yet (empty column, cancelling the form, an empty title is rejected)

Tests:
- pytest: `/` returns the exported `index.html`; `/api/health` still works
- Vitest: existing tests plus the new ones pass
- Playwright: existing tests pass against the container

Success criteria: the demo Kanban board appears at `http://localhost:8000` from the container, and all tests pass.

## Part 4: Fake user sign in

- [x] Backend: `SessionMiddleware` (secret from an env var, with a dev default); `POST /api/login`, `POST /api/logout`, `GET /api/me` (401 if not signed in)
- [x] Frontend: on load, call `/api/me`; show a `LoginForm` if not signed in, otherwise the board; a log out button in the board header
- [x] Show an error message for wrong credentials

Tests:
- pytest: login succeeds with the right credentials and fails with wrong ones; `/api/me` returns 401 before login and the username after; logout clears the session
- Vitest: `LoginForm` submits the credentials and shows an error on failure; the page switches between the login form and the board based on `/api/me` (with `fetch` mocked)
- Playwright: wrong login shows an error; right login shows the board; logout returns to the login form; reloading keeps the session

Success criteria: the board can't be reached without signing in; logging in and out works in the container.

## Part 5: Database modeling

- [x] `docs/board-schema.json`: JSON Schema for the stored board (`BoardData`)
- [x] `docs/DATABASE.md`: the tables (`users`: id, username, created_at; `boards`: id, user_id unique, data JSON text, updated_at), creating the database on startup, seeding the `user` account and the default board on first access, and the database file's location (`/app/data/app.db`, mounted from `./data`)
- [x] User reviews and approves the database approach (JSON blob kept over normalised columns/cards tables)

Success criteria: the user approves the schema and the approach.

## Part 6: Backend

- [x] `backend/app/db.py`: connect, create the tables if they're missing, `get_or_create_user`, `get_board(user_id)` (seeds the default board), `save_board(user_id, board)`
- [x] Pydantic models for `Board`, `Column`, `Card`, matching the frontend shape; check that every `cardId` refers to a card in `cards`, each card's `id` matches its key, and every card is in exactly one column
- [x] `PUT` rejects a board whose column ids differ from the stored board's (columns are fixed)
- [x] Default board (the demo data) as `backend/app/default_board.json`
- [x] `GET /api/board` and `PUT /api/board` for the signed-in user
- [x] Database path configurable through an env var so tests can use a temporary file

Tests (pytest, temporary database):
- the database file and tables are created when missing
- the first `GET` returns the default board; `PUT` then `GET` returns the saved board
- `PUT` rejects malformed boards (missing fields, unknown card ids, orphaned or duplicated cards, changed column ids) with 422, and nothing is saved
- both routes return 401 without a session
- two users' boards are kept separate (tested at the db layer)

Success criteria: all backend tests pass; the board survives a container restart.

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts`: `fetchBoard()`, `saveBoard(board)`
- [x] `KanbanBoard` loads the board from the API on mount and calls `saveBoard` after each change (move, rename, add, edit, delete)
- [x] Card editing: an Edit button on the card switches to an inline form for title and details, with Save and Cancel
- [x] Remove `initialData` from the frontend (the backend now seeds the default board)

Tests:
- Vitest (`fetch` mocked): the board renders from the API response; each change calls `PUT` with the expected board; editing a card updates its title and details; cancelling an edit keeps the original
- Playwright: reset the board through `PUT /api/board` in `beforeEach`; add, edit, move and delete a card, rename a column, then reload and check that every change persisted

Success criteria: every board change survives a page reload and a container restart.

## Part 8: AI connectivity

- [x] Add the `openai` dependency; `backend/app/ai.py` creates a client with `base_url="https://openrouter.ai/api/v1"` and `OPENROUTER_API_KEY`
- [x] A simple completion function, and a signed-in `POST /api/ai/test` route that asks "What is 2+2?"
- [x] pytest `ai` marker, left out of the default run (`addopts = -m "not ai"`); run with `uv run pytest -m ai`

Tests:
- `ai`: a real call to "What is 2+2?" returns text that contains "4"

Success criteria: the real OpenRouter call succeeds from inside the container.

## Part 9: AI with board context and structured outputs

- [x] `POST /api/chat` with body `{ message, history: [{role, content}] }`
- [x] Send a system prompt describing the board format and the rules (keep column ids, return the whole board when changing it, otherwise `null`), the history, and the user's message preceded by the current board JSON (placing the board next to the latest request, plus a rule that earlier requests are already applied, stopped the model from repeating them)
- [x] OpenRouter routing: `require_parameters` (only providers that honour `response_format`) and ignore CoreWeave, whose deployment returned malformed JSON on every structured request in testing
- [x] Structured output with `response_format` set to a JSON schema for `{ reply: string, board: Board | null }`; parse it with Pydantic (the AI sees and returns `cards` as a list, since strict JSON schemas can't describe a dict keyed by id; the route converts it back)
- [x] If a board is returned, validate it and save it; respond `{ reply, board }`

Tests:
- default (OpenRouter client mocked): the reply is passed through; a returned board is saved; a `null` board leaves the stored board unchanged; an invalid board is rejected and nothing is saved; the prompt includes the board and the history
- `ai` (real API): "add a card titled X to Backlog" saves a board with that card; a question with no change ("how many cards are in Done?") returns `board: null`; "move card-1 to Done" moves it; "change the title of card-2" edits it; a follow-up message with history does not repeat the earlier request

Success criteria: the real model reliably creates, edits and moves cards through `/api/chat`.

## Part 10: AI chat sidebar

- [x] `ChatSidebar` component: a collapsible panel next to the board, with the message list, an input, a send button (purple), and a loading state while waiting for a reply
- [x] History is kept in component state and sent with each request
- [x] When the response includes `board`, update the board state so the UI refreshes right away
- [x] Styled with the project color scheme

Tests:
- Vitest (`fetch` mocked): sending shows the user message and then the reply; the history is included in the request; a returned board updates the visible cards; the input is disabled while loading
- Playwright: open the sidebar, send a message with the chat API mocked through `page.route`, and see the reply and the board update
- Manual check with the real model: ask it to add and move cards and watch the board update

Success criteria: chatting with the AI in the sidebar can create, edit and move cards, and the board updates without a reload.

# Phase 2: Full project management app

Goal: grow the MVP into a multi-user project management app: real accounts, several boards per user, richer cards and columns, search, and strong unit, API and end-to-end test coverage. Decisions were made autonomously during an iterative build loop; each part lists them so they can be reviewed.

## Key decisions (Phase 2)

- Accounts live in the database: `users.password_hash` holds a salted `hashlib.scrypt` hash (standard library, no new dependency). Anyone can register; the `user` / `password` demo account is seeded on startup so the original sign in keeps working.
- The session stores `user_id`. Each request loads the user, so a deleted account is signed out at once.
- A user has many boards (`boards.user_id` is no longer unique; boards gain `name` and `created_at`). The board content stays one JSON document per board, so the frontend, API and AI keep sharing one shape.
- Schema changes are versioned with `PRAGMA user_version`; `init_db` migrates an MVP database in place, so existing boards are kept.
- Every board route checks ownership and returns 404 for a board the user does not own (no existence leak).
- New users get the demo board ("My first board"); boards created later start with the five default columns and no cards.
- The frontend keeps the open board id in the URL hash (`#board=<id>`), so reload and the browser back button work with the static export.
- E2E tests register a fresh user per test, so they are isolated from each other and from manual use.
- Coverage: `pytest-cov` for the backend and `@vitest/coverage-v8` for the frontend, both with enforced thresholds.

## Part 11: User accounts

- [x] Schema v1: `users (id, username unique, password_hash, created_at)`; migration from the MVP schema
- [x] `app/auth.py`: `hash_password`, `verify_password` (scrypt, constant-time compare)
- [x] `POST /api/register` (username 3-32 chars of letters, digits, `._-`; password 8+ chars; 409 if taken; signs in and seeds the demo board)
- [x] `POST /api/login` checks the database; `GET /api/me`; `POST /api/logout`
- [x] `PUT /api/me/password` (current password required); `DELETE /api/me` (password required; deletes the user's boards)
- [x] Frontend: sign in / create account toggle on the auth form; account dialog with change password and delete account

Tests: pytest for hashing, registration rules, login, password change, account deletion, migration of an MVP database; Vitest for the auth form and account dialog; Playwright for register, sign in, change password, delete account.

## Part 12: Multiple boards

- [x] Schema v1: `boards (id, user_id, name, data, created_at, updated_at)`
- [x] `GET /api/boards`, `POST /api/boards`, `GET /api/boards/{id}`, `PATCH /api/boards/{id}` (rename), `DELETE /api/boards/{id}`, `PUT /api/boards/{id}/data`, `POST /api/boards/{id}/chat`; remove `/api/board` and the Part 8 `/api/ai/test` route
- [x] Frontend: board list (create, rename, delete, open), board view with a back link, board id in the URL hash

Tests: pytest for each route, ownership (404 on another user's board), validation; Vitest for the board list and navigation; Playwright for creating, renaming, opening and deleting boards, and that boards are kept separate.

## Part 13: Editable columns and richer cards

- [ ] Columns can be added, deleted (with their cards, after confirmation) and reordered; the fixed-column-id rule is dropped
- [ ] Cards gain optional `priority` (low, medium, high), `dueDate` (ISO date) and `labels` (list of short strings); shown on the card and editable in the card form; overdue cards are highlighted
- [ ] The AI prompt and schema cover the new fields and column changes

## Part 14: Search, filters and board overview

- [ ] Search box and priority / label filters on the board (client side)
- [ ] Board list shows per-board stats (cards, done, overdue)

## Part 15: Hardening and coverage

- [ ] Coverage thresholds enforced; fill gaps found by the reports
- [ ] Code review pass over Phase 2; fix findings
