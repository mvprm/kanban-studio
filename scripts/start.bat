@echo off
cd /d "%~dp0.."
docker compose up -d --build || exit /b 1
echo Running at http://localhost:8000
