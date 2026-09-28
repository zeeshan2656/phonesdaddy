# 🛡️ PhonesDaddy — Zero-Risk Production Deployment Guide

This guide explains how to deploy new versions of PhonesDaddy to your live server (Hostinger, cPanel, VPS, or Docker) with **100% guarantee** that your uploaded phone images, news photos, brand logos, and database remain completely safe.

---

## ⚡ The Solution: External Persistent Media Storage

### Why images were previously disappearing:
1. In standard web setups, images were saved inside the application folder (`public_html/server/uploads` or `public_html/public/webfiles`).
2. When deploying via **GitHub (Git Pull / Git Checkout / Webhook)**, Git manages the folder contents. Any `git clean`, branch switch, or deployment action replaced or wiped untracked files.
3. When deploying via **ZIP File**, extracting a zip with empty upload folders overwrote the live folders with empty ones.

### The Architectural Fix:
All media files are stored **OUTSIDE** the application deployment directory:
- **Application Code:** `/home/username/public_html` (or `/var/www/phonesdaddy`)
- **Media Files:** `/home/username/phonesdaddy_media` (or `../phonesdaddy_media`)

Because the media folder is located **outside** the application directory:
- **Git** can NEVER touch, wipe, reset, or delete your media files.
- **ZIP File Extraction** (even using Hostinger or cPanel File Manager "Extract" button) can NEVER touch or overwrite your media files.
- You can even delete the entire `public_html` code folder and extract a new ZIP from scratch — **your media remains 100% intact**.

---

## 🚀 One-Time Server Setup (Run Once on Live Server)

Run this once on your live server via SSH / Hostinger Terminal:
```bash
bash setup-persistent-media.sh
```
*(Or run `npm run setup:media`)*

**What this does automatically:**
1. Creates the external persistent directory at `~/phonesdaddy_media/` (with all required subfolders: `phones`, `brands`, `branding`, `news`, `reviews`, `webfiles`).
2. Safely moves any existing images currently on the server into `~/phonesdaddy_media/` so nothing is lost.
3. Adds `MEDIA_DIR=/home/username/phonesdaddy_media` to your server's `.env`.

---

## 📦 METHOD 1: Deploying via ZIP File (Hostinger / cPanel)

### Step 1: Create the clean deployment ZIP (on your local machine)
In your local project terminal, run:
```bash
npm run package:deploy
```
This builds `deploy-bundle.zip` (~2–3 MB).  
**Protections applied in this ZIP:**
- Excludes `.env` (your live database credentials are never touched)
- Excludes all media folders (extracting can NEVER overwrite images)
- Excludes `node_modules/` (lightweight, rapid upload)

### Step 2: Upload & Deploy on Server
Choose either option:

#### Option A: Via Hostinger / cPanel File Manager (Simple UI)
1. Go to **File Manager** in your hosting control panel.
2. Navigate to your project root (e.g. `public_html`).
3. Upload `deploy-bundle.zip`.
4. Click **Extract**. *(Safe! It contains zero media folders).*
5. Delete `deploy-bundle.zip`.
6. Go to **Node.js App Manager** → click **Restart**.

#### Option B: Via SSH Terminal
1. Upload `deploy-bundle.zip` to your server root.
2. Run:
   ```bash
   bash safe-deploy.sh
   ```
   *(This extracts the zip, runs `npm install --omit=dev`, runs safe migrations, and restarts the app automatically).*

---

## 🐙 METHOD 2: Deploying via GitHub (Git Auto-Deploy / Git Pull)

Because your media folder is stored outside the Git repository:
1. Commit and push your code changes to GitHub:
   ```bash
   git add .
   git commit -m "Updates"
   git push origin main
   ```
2. On your live server, simply pull the latest code:
   ```bash
   bash git-deploy.sh
   ```
   *(Or if you use Hostinger Git Auto-Deploy webhook, it deploys automatically).*
3. **Result:** Git updates only application code. Your images in `~/phonesdaddy_media` are completely untouched.

---

## 🔒 Directory Layout Reference

```text
/home/yourusername/
│
├── phonesdaddy_media/                <-- 100% PERSISTENT MEDIA (OUTSIDE DEPLOYMENT)
│   ├── uploads/
│   │   ├── phones/                   <-- Admin phone photo uploads
│   │   ├── brands/                   <-- Brand logo uploads
│   │   ├── branding/                 <-- Site logo & favicon
│   │   ├── news/                     <-- Article banner images
│   │   └── reviews/                  <-- User review photo attachments
│   └── webfiles/
│       ├── phones/                   <-- Scraped & optimized WebP phone images
│       ├── brands/                   <-- Scraped & generated brand logos
│       ├── news/                     <-- Scraped news thumbnails
│       └── branding/
│
└── public_html/                      <-- DEPLOYMENT FOLDER (Git & ZIP updates code here)
    ├── server/                       <-- Express backend & API
    ├── public/                       <-- CSS, JS, and default SVGs
    ├── views/                        <-- Frontend HTML templates
    ├── database/                     <-- Schema & safe non-destructive migrations
    ├── .env                          <-- Contains MEDIA_DIR=../phonesdaddy_media
    └── package.json
```

---

## ⚙️ Environment Variables (.env) Reference

| Variable | Recommended Production Value | Description |
|---|---|---|
| `MEDIA_DIR` | `../phonesdaddy_media` or `/home/user/phonesdaddy_media` | Unified external media folder |
| `NODE_ENV` | `production` | Enables production caching & auto-fallback |
| `PORT` | `3000` | Port for Express app |
| `DB_HOST` | `localhost` | MySQL Host |
| `DB_NAME` | `phonesdaddy` | MySQL Database Name |

---

## 🗄️ Database Commands Reference

| Command | Description | Safe on Live Server? |
|---|---|---|
| `npm run db:backup` | Creates a timestamped `.sql` backup in `backups/` | ✅ 100% Safe |
| `npm run migrate` | Adds missing columns non-destructively | ✅ 100% Safe |
| `npm run setup:media` | Migrates media to persistent external folder | ✅ 100% Safe |
| `npm run package:deploy` | Creates clean `deploy-bundle.zip` for upload | ✅ Local only |
| `npm start` | Starts server with non-destructive migrations | ✅ 100% Safe |
