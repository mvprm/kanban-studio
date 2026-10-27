# Deployment and operations

How to run Kanban Studio for real users: configuration, a step-by-step production setup, day-to-day operations, and the security checklist. For local development see [DEVELOPMENT.md](DEVELOPMENT.md).

## Architecture

One Docker container runs everything:

- **uvicorn** (one process) serves the FastAPI app on port 8000.
- **FastAPI** serves the API under `/api` and the frontend (a static Next.js export built into the image) at `/`.
- **SQLite** stores users and boards in `/app/data/app.db`. `docker-compose.yml` mounts the project's `data/` folder there, so the data lives on the host and survives rebuilds.
- **OpenRouter** answers the AI assistant (`openai/gpt-oss-120b`). It is the only outside service the app calls.

The database is created on first start and migrated automatically when a new version changes the schema (see [DATABASE.md](DATABASE.md)).

## Configuration

Set these in `.env` in the project root. `docker compose` loads it into the container. Start from `.env.example`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes | none | OpenRouter key for the AI assistant. Without it, everything else works, but chat requests fail. |
| `SESSION_SECRET` | Yes, in production | `dev-secret` | Signs session cookies. The default is public, so with it anyone can forge a session for any user. Use a long random value; never set it to an empty string, which would be used as the key. Changing it signs everyone out. |
| `DB_PATH` | No | `/app/data/app.db` | SQLite file. Keep it inside the mounted `data/` folder, or the data is lost when the container is replaced. |
| `STATIC_DIR` | No | the built frontend | Folder served at `/`. Only needed for local development. |

Fixed values (change in code if needed): the session lasts 14 days, and the cookie is `httponly` and `SameSite=Lax`.

Generate a session secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

`docker compose config` prints the resolved configuration, including the values from `.env`. Don't paste its output into tickets or chat.

## Production setup, step by step

These steps assume a Linux server with a domain name pointing at it. The app itself serves plain HTTP, so it goes behind a reverse proxy that terminates HTTPS.

1. **Install Docker Engine and the Compose plugin** (Compose 2.24.4 or newer, for the `!override` tag used below): https://docs.docker.com/engine/install/

2. **Get the code**:

   ```bash
   git clone <repository-url> kanban-studio
   cd kanban-studio
   ```

3. **Create `.env`** with the API key and a session secret, readable only by its owner:

   ```bash
   cp .env.example .env
   # edit .env: set OPENROUTER_API_KEY, and uncomment and set SESSION_SECRET
   chmod 600 .env
   ```

4. **Add `docker-compose.override.yml`** next to `docker-compose.yml`. Compose merges it in automatically. It publishes the app on localhost only (so it is reachable through the proxy, not directly), restarts it after a crash or reboot, and adds a health check:

   ```yaml
   services:
     app:
       restart: unless-stopped
       ports: !override
         - "127.0.0.1:8000:8000"
       healthcheck:
         test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
         interval: 30s
         timeout: 5s
         retries: 3
   ```

5. **Start the app**:

   ```bash
   docker compose up -d --build
   docker compose ps          # STATUS shows "healthy" after the first check
   ```

6. **Put HTTPS in front of it.** With [Caddy](https://caddyserver.com/docs/install), which gets and renews certificates by itself, `/etc/caddy/Caddyfile` is:

   ```
   kanban.example.com {
       reverse_proxy 127.0.0.1:8000
   }
   ```

   Then `sudo systemctl reload caddy`. Any proxy works (nginx, Traefik, a cloud load balancer) as long as it forwards to `127.0.0.1:8000`. Open only ports 80 and 443 in the firewall.

7. **Secure the demo account.** Every install has `user` / `password`. Sign in with it, open the account dialog (the username button in the header) and change the password to a strong one. Don't delete it: if the account is missing at startup, the app recreates it with the default password.

8. **Check it**:

   ```bash
   curl https://kanban.example.com/api/health    # {"status":"ok"}
   ```

   Then register an account in the browser, create a board, and send a message in the AI chat.

## Operations

### Logs

```bash
docker compose logs -f --tail 100
```

uvicorn logs each request and any errors with a stack trace. Docker's default log driver keeps logs until the container is removed; configure log rotation in Docker if the server runs for months.

### Health

`GET /api/health` returns `{"status": "ok"}` with status 200 while the app is up. Use it for the Compose health check above and for external uptime monitoring.

### Backups

All data is in `data/app.db`. Back it up while the app runs with SQLite's online backup, which gives a consistent copy even during writes:

```bash
mkdir -p backups
docker compose exec -T app python -c "import sqlite3; d = sqlite3.connect('/app/data/backup.db'); sqlite3.connect('/app/data/app.db').backup(d); d.close()"
mv data/backup.db "backups/app-$(date +%F).db"
```

Check a backup with `sqlite3 backups/app-<date>.db "PRAGMA integrity_check"` (prints `ok`).

Run it daily, for example from cron (`crontab -e`, one line; cron needs `%` escaped as `\%`):

```
0 3 * * * cd /path/to/kanban-studio && docker compose exec -T app python -c "import sqlite3; d = sqlite3.connect('/app/data/backup.db'); sqlite3.connect('/app/data/app.db').backup(d); d.close()" && mv data/backup.db backups/app-$(date +\%F).db
```

Keep copies off the server too, and delete old ones. Back up `.env` separately and securely: it holds the secrets.

### Restore

```bash
docker compose down
cp backups/app-2026-10-26.db data/app.db
docker compose up -d
```

### Upgrades

```bash
# back up first (see above)
git pull
docker compose up -d --build
docker compose logs --tail 20      # check it started
```

Schema migrations run automatically at startup. There are no downgrade migrations: to roll back, restore the backup taken before the upgrade and check out the previous version.

### Rotating the session secret

Change `SESSION_SECRET` in `.env` and run `docker compose up -d`. Everyone is signed out. Do this if the secret may have leaked.

### Costs

Each chat message is one OpenRouter request that includes the whole board, so cost grows with board size and chat length. There is no per-user limit in the app. Set a credit limit on the key in the OpenRouter dashboard.

## Capacity

One uvicorn process with SQLite suits a small team. Each board save writes the whole board as one small JSON document, and each AI message takes several seconds while it waits for OpenRouter. No load testing has been done yet, so measure before relying on it for a large group. Running more than one instance is not supported: the app expects a single process with the database file on local disk.

## Security checklist

Done by the app:

- Passwords are stored as salted scrypt hashes and compared in constant time.
- Sessions are signed, `httponly`, `SameSite=Lax` cookies holding the user id. A deleted account is signed out everywhere at once, and ids are never reused.
- Every board route checks ownership and answers 404 for other users' boards.
- All board data is validated before it is saved, including the AI's changes.
- SQL uses parameters throughout.

Your job when deploying:

- [ ] `SESSION_SECRET` set to a long random value
- [ ] `.env` readable only by its owner, and not in version control (it is in `.gitignore`)
- [ ] Served only over HTTPS, through a reverse proxy; port 8000 not reachable from outside
- [ ] Demo account password changed
- [ ] Daily backups, stored off the server and tested by restoring one
- [ ] OpenRouter credit limit set
- [ ] Uptime monitoring on `/api/health`

### Known gaps

The app does not do these yet. Each needs a code change. Consider them before exposing the app to the public internet:

- **No `Secure` flag on the session cookie** (`https_only` is off, so it also works over plain HTTP locally). Behind HTTPS, set `https_only=True` on `SessionMiddleware` in `backend/app/main.py`.
- **No rate limiting** on sign in or registration, so passwords can be guessed by brute force. Add limits in the reverse proxy (for example, nginx `limit_req` on `/api/login` and `/api/register`) or in the app.
- **Open registration.** Anyone who can reach the site can create an account. There is no invite or admin approval.
- **The demo account is always present** and recreated on startup if deleted.
- **No password reset.** The app stores no email address; a forgotten password can only be reset by an operator updating the database.
- **The API docs are public** at `/docs`, `/redoc` and `/openapi.json`. They reveal nothing secret, but can be turned off with `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)`.
- **The container runs as root.** Add a non-root `USER` to the `Dockerfile`, owning `/app/data`.
- **No security headers** (Content-Security-Policy, HSTS). Add them in the reverse proxy.
- **No per-user AI quota.** See Costs.
