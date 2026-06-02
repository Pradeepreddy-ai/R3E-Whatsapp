#!/bin/bash
echo ""
echo "╔════════════════════════════════════════╗"
echo "║       R3E Platform — Local Startup      ║"
echo "╚════════════════════════════════════════╝"
echo ""

if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found."
  echo "    Download from https://nodejs.org  (LTS version, v18+)"
  exit 1
fi
echo "✅  Node.js $(node -v) detected"

if [ ! -d "node_modules" ]; then
  echo "📦  Installing dependencies..."
  npm install
  if [ $? -ne 0 ]; then echo "❌  npm install failed."; exit 1; fi
fi

if [ ! -f "database/r3e.db" ]; then
  echo "🗄️   Creating SQLite database and seeding test data..."
  node database/seed.js
  if [ $? -ne 0 ]; then echo "❌  Seed failed."; exit 1; fi
fi

echo ""
echo "🚀  Starting R3E Platform..."
echo "🌐  Site       →  http://localhost:3000"
echo "📊  Dashboard  →  http://localhost:3000/app.html"
echo "📋  Logins     →  database/CREDENTIALS.md"
echo ""
node server.js
