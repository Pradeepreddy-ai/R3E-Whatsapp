# R3E Platform — Complete Setup Guide

---

## ⚡ Quick Fix — Errors You May See

### ❌ `git is not recognized`
Git is not installed. Download and install it:
👉 **https://git-scm.com/download/win**
- Run the installer, accept all defaults
- Close and reopen PowerShell after installing
- Then retry: `git --version`

### ❌ `Cannot find module 'dotenv'`
This is now fixed in the latest zip — no dotenv needed.
Make sure you are running the seed from the **root folder** (not the `database` folder):
```powershell
cd C:\Users\YourName\Downloads\r3e-platform\r3e-platform   # root folder
npm run seed
```

### ❌ `DATABASE_URL is not set`
You need a `.env` file — see Step 3 below.

---

## 🚀 Full Setup — Windows Step by Step

### Step 1 — Install Git (one time only)
Download: **https://git-scm.com/download/win**
Install with all defaults. Close and reopen PowerShell.

Verify:
```powershell
git --version
# should print: git version 2.x.x
```

### Step 2 — Connect your folder to GitHub

If you haven't already initialised the repo:
```powershell
cd C:\Users\Pradeep Kuppireddy\Downloads\r3e-platform\r3e-platform

git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
```

If you already have the repo connected, just commit and push:
```powershell
git add .
git commit -m "feat: PostgreSQL migration v3"
git push origin main
```

---

## 🗄️ Render Deployment (Live Site)

### Step 1 — Push to GitHub (see above)

### Step 2 — Get your PostgreSQL URL from Render
1. Render Dashboard → your **PostgreSQL** service
2. Click **Connect** → copy the **Internal Database URL**
   (looks like: `postgres://user:pass@dpg-xxx.render.com/r3e`)

### Step 3 — Add DATABASE_URL to your Web Service
1. Render Dashboard → your **Web Service** → **Environment**
2. Click **Add Environment Variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: *(paste the Internal Database URL)*
3. Click **Save Changes** — Render redeploys automatically

### Step 4 — Seed the database (one time)
1. Render Dashboard → your **Web Service** → **Shell** tab
2. Run:
```bash
npm run seed
```
Output will show all tables created and test data inserted.

### Step 5 — Open your site
Visit your Render URL, click **Get Started**, and sign in.

---

## 💻 Local Development (Optional)

### Prerequisites
- Node.js v18+ → https://nodejs.org (choose LTS)
- Git → https://git-scm.com/download/win
- A PostgreSQL database (you can use your Render DB URL locally too)

### Setup
```powershell
# 1. Navigate to the project root
cd C:\Users\Pradeep Kuppireddy\Downloads\r3e-platform\r3e-platform

# 2. Install dependencies
npm install

# 3. Create a .env file (PowerShell)
New-Item .env -ItemType File
notepad .env
```

Add this line to the `.env` file (use your actual Render database URL):
```
DATABASE_URL=postgres://user:pass@dpg-xxx.render.com/r3e?sslmode=require
```

```powershell
# 4. Seed the database (run from root folder)
npm run seed

# 5. Start the server
npm start
```

Open **http://localhost:3000**

---

## 🔑 Test Login Credentials

After seeding, use these to log in:

| Role | Email | Password |
|------|-------|----------|
| 👑 Super Admin | admin@r3e.platform | Admin@R3E2025! |
| 🛡️ Admin (London) | james.c@r3e.platform | Admin@James25 |
| 🎧 Support | tom.b@r3e.platform | Support@Tom25 |
| 🌶️ Merchant (Owner) | owner@spicepalace.test | Spice@Owner25! |
| 👨‍💼 Manager | manager@spicepalace.test | Spice@Mgr25! |

---

## 🏗️ Project Structure

```
r3e-platform/
├── server.js              ← Express API (PostgreSQL via pg)
├── package.json           ← Dependencies: express, pg, bcryptjs
├── render.yaml            ← Render auto-deploy config
├── .gitignore             ← Blocks .env and credentials
├── .env                   ← YOUR local DB URL (never commit this)
│
├── database/
│   ├── schema.sql         ← PostgreSQL table definitions
│   └── seed.js            ← Creates tables + inserts test data
│
└── public/                ← All frontend files (HTML/CSS/JS)
    ├── index.html         ← Home page
    ├── app.html           ← Dashboard (login + all roles)
    └── ...
```

---

## 🩺 Health Check

```
GET https://your-app.onrender.com/api/health
→ { "status": "ok", "db": "connected", "ts": "..." }
```

---

## ⚠️ Common Windows Issues

| Error | Fix |
|-------|-----|
| `git is not recognized` | Install Git from https://git-scm.com/download/win |
| `npm is not recognized` | Install Node.js from https://nodejs.org |
| `Cannot find module 'dotenv'` | Already fixed — update to latest zip |
| `DATABASE_URL is not set` | Create `.env` file in project root (see Step 3 above) |
| `ECONNREFUSED` on local | Your local Postgres isn't running — use Render DB URL instead |
| Running seed from wrong folder | Always run `npm run seed` from the root folder (where `server.js` is) |
