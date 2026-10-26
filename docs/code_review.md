# Code Review

Reviewed: everything tracked in git (backend, frontend, Docker, scripts, tests, docs) against `docs/PLAN.md` and the requirements in `AGENTS.md`.

## Summary

The project is in good shape. It does what the plan says, the code is consistently simple and idiomatic, and the tricky parts of this MVP (whole-board saves, AI returning the whole board, race between user edits and the AI) are handled with deliberate, documented mechanics rather than defensive boilerplate. All test suites pass.

## Verification

- Backend: `uv run pytest` - 44 passed, 7 deselected (`ai` marker). Full pass.
  (Note: on this machine pytest's default temp base dir was unreadable, so it was run with `--basetemp`; the first run's 33 "PermissionError" setup errors were an environment artifact, not a code issue.)
- Frontend: `npm run test:unit` - 32 passed. Full pass.
- Docker/scripts/Dockerfile/docker-compose reviewed statically (container not rebuilt during this review).

## Strengths

- **Validation is genuinely solid.** `models.py` uses `extra="forbid"` everywhere and a `model_validator` that enforces the real invariants (card id matches its key, no unknown/duplicated/orphaned cards). The chat route re-validates AI output, and the test suite covers all of these cases.
- **Race handling is coherent across the stack.** Whole-board `PUT` for every change, saves queued in order in `api.ts`, `sendChat` waits for pending saves, and the backend returns 409 if the user saved while the AI was thinking. Each link of that chain is tested (`test_board_edited_during_ai_call_is_not_overwritten`).
- **AI prompt design shows real iteration.** Board placed with the latest request so earlier requests are not repeated, `require_parameters` plus the CoreWeave ignore rule with a recorded reason, strict structured output converting the list-form `cards` back to a dict.
- **Docs match the code.** `AGENTS.md` files, `DATABASE.md`, `PLAN.md` and `README.md` are small, accurate, and up to date with what is actually written.
- **Docker setup is clean**: two-stage build, deps via `uv sync --locked --no-dev`, `.env` excluded from the image, SQLite on a mounted volume, and `.env` never committed to git.
- **Security posture is appropriate for the scope**: signed httponly session cookie, all board/chat routes sit behind `current_user`, login failures return 401 without leaking which field was wrong, chat text renders as text (no HTML injection), foreign keys enabled in SQLite.

## Findings

### Medium

1. **`fetchBoard()` failures leave the UI on "Loading board..." forever.**
   `api.ts` `fetchBoard` does not check `response.ok`, and `KanbanBoard.tsx` renders a loader indefinitely until a (possibly failing) `fetchBoard().then(setBoard)` resolves. The two realistic failures are a dead container and an expired/invalid session; in both the user gets a silent stuck loader instead of the login form or an error. Cheapest fix: have `page.tsx` treat a failed `getMe`/`fetchBoard` result (e.g. a thrown error or `null`) as "not signed in". This is the only place in the app where a failure produces no feedback at all.

2. **TOCTOU window in the chat 409 check.**
   `main.py` re-reads the board, compares it with `stored`, then calls `save_board` as a separate operation. A save could land between the check and the write (routes run in the FastAPI threadpool, so two requests genuinely do interleave). The window is milliseconds and the MVP is single-user, so this is acceptable - but if it is ever revisited, the fix is one conditional write (`UPDATE ... WHERE data = :stored`) rather than more checks.

### Low

3. **Board saved on every keystroke of a column title.**
   `KanbanColumn` renames via `onChange`, so each character triggers a full-board `PUT` and a SQLite write (queued, DB is small, so nothing breaks - but it is a lot of writes for typing a 12-character name). A short debounce, or saving on blur/Enter, would halve the churn without touching the save mechanics. Same applies in principle to card editing, but that path only fires on Save.

4. **First-board seeding is not idempotent under concurrency.**
   `db.get_board` does `SELECT` then `INSERT`. Two concurrent first requests (e.g. the app shell plus an immediate chat call) would both see no row, and the second `INSERT` would raise `IntegrityError` uncaught, producing a 500. `INSERT OR IGNORE`-style handling would make it airtight; practically unlikely today.

5. **`ai.py` reads `OPENROUTER_API_KEY` at request time and `message.parsed` is assumed non-null.**
   `os.environ[...]` raises an unhandled `KeyError` (500) if the key is missing, and `chat(...)` would return `None`-parsed results as `None` and crash in `main.py` on `result.reply` (a 500 instead of the intended 502). Both are edge cases the `ai` tests and `require_parameters` mostly prevent; the clean version is a small `except`/guards in the route mapping these to 502 with a clear detail.

6. **Local default `SESSION_SECRET = "dev-secret"`.**
   Fine for a local MVP and documented, but anything run beyond localhost should require the env var (e.g. fail at startup when `SESSION_SECRET` is unset) rather than silently falling back.

### Nits

7. `main.py` password check could use `secrets.compare_digest` for constant-time comparison; purely theoretical for a hardcoded credential.
8. `complete()` types `str` but `message.content` is `Optional[str]`; only used by the `/api/ai/test` debug route.
9. Chat messages are keyed by array index in `ChatSidebar`; harmless since the list only appends.
10. A compose `healthcheck` (against `/api/health`) would make "the container is up" measurable in the start scripts instead of a fixed wait.

## Test coverage observations

Coverage is unusually strong for an MVP: auth failure modes, every invalid-board variant (parametrized), 409 race, prompt contents, persistence across restarts, save-failure UI, chat history, and `ai`-marked real-API tests for create/edit/move/no-change/follow-up. Gaps worth a line if the suite grows further:

- No test for the stuck-loader path from finding 1 (the missing feedback is exactly why it survives).
- The E2E suite needs a running container (documented); nothing lighter runs the frontend against the API shape end-to-end. The Vitest `mockApi` fake covers this role of the API shape, so this is minor.

## Recommendation

Ship as-is for the MVP scope. If you pick up fixes, do findings 1 and 4; both are small and change user-visible behavior (1) or remove a class of 500s (4). Findings 2, 3, 5 are acceptable to defer with the current single-user/local constraints noted in the docs.
