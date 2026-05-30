@echo off
echo.
echo ╔════════════════════════════════════════╗
echo ║       R3E Platform — Local Startup      ║
echo ╚════════════════════════════════════════╝
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌  Node.js not found.
  echo     Download from https://nodejs.org  ^(LTS version, v18+^)
  pause & exit /b 1
)
echo ✅  Node.js found.
if not exist "node_modules" (
  echo 📦  Installing dependencies...
  npm install
  if %errorlevel% neq 0 ( echo ❌  npm install failed. & pause & exit /b 1 )
)
if not exist "database\r3e.db" (
  echo 🗄️   Creating SQLite database and seeding test data...
  node database\seed.js
  if %errorlevel% neq 0 ( echo ❌  Seed failed. & pause & exit /b 1 )
)
echo.
echo 🚀  Starting R3E Platform...
echo 🌐  Site       →  http://localhost:3000
echo 📊  Dashboard  →  http://localhost:3000/app.html
echo 📋  Logins     →  database\CREDENTIALS.md
echo.
node server.js
pause
