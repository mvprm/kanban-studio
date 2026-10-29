# Scripts

Start and stop the app container with Docker Compose. Each script changes to the project root first, so it can be run from anywhere.

- `start.sh` / `stop.sh` - Mac and Linux
- `start.bat` / `stop.bat` - Windows

Start runs `docker compose up -d --build`; stop runs `docker compose down`. The app is at http://localhost:8000 (uvicorn takes a few seconds to accept connections after the container starts).
