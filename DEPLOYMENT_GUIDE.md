# 🛡️ PhonesDaddy - Safe Production Deployment Guide

This guide explains how changes made on your local computer can be safely deployed to your live production server (Hostinger, cPanel, or VPS) **WITHOUT disturbing, overwriting, or losing any existing server data** (such as live articles, phones, specs, uploaded images, reviews, or settings).

---

## 🔒 The 4 Safeguards Built Into Your Project

### 1. Zero Data Loss Auto-Migrations (`database/migrate.js`)
* **Never runs `DROP TABLE` or `TRUNCATE`**: All queries use `CREATE TABLE IF NOT EXISTS`.
* **Safe Column Expansion**: If you add new columns to your database locally, the migrator checks `information_schema.COLUMNS` and only executes `ALTER TABLE ADD COLUMN` if the column doesn't exist yet. Existing rows are never touched.
* **Runs Automatically on Boot**: Every time your Node.js server restarts on the server, it automatically runs migrations in milliseconds before handling requests.

### 2. Live Media & Image Protection
* **Uploaded Photos Are Never Overwritten**: When visitors or admins upload photos for phones, news articles, or branding logos, they are stored in `server/uploads/` and `public/webfiles/`.
* Both `.gitignore` and our packaging script strictly **exclude** local uploads from being deployed over the server's live files.
* Only empty folder structures with `.gitkeep` are kept so the directory hierarchy always exists.

### 3. Production Environment Isolation (`.env`)
* Production database credentials (DB host, user, password, database name) and secret keys are stored in the server's `.env` file.
* Deploy packages and Git pushes **never include** your local `.env`. Your production credentials and domain settings remain 100% untouched.

### 4. Instant 1-Click Database Backups (`npm run db:backup`)
* Before doing any major maintenance, you can run a pure Node.js backup script that dumps the entire database into a timestamped `.sql` file in the `backups/` folder.
* No external `mysqldump` CLI required.

---

## 🚀 How to Deploy Changes (Step-by-Step)

### Method 1: The 1-Command Safe Zip Package (Recommended)

This is the easiest, safest method. It produces a lightweight **~2 MB** ZIP file containing only code, routes, views, styles, and migrations.

#### Step 1: Create the Safe Deploy Bundle (on your computer)
In your local project terminal, run:
```bash
npm run package:deploy
```
This script will:
* Verify all required code and assets are present.
* Exclude `.env`, `node_modules`, `server/uploads/*`, `public/webfiles/*`, and local database dumps.
* Create a clean `deploy-bundle.zip` in your project root.

#### Step 2: Upload to Your Server
1. Log into your hosting control panel (e.g. **Hostinger File Manager**, **cPanel File Manager**, or SFTP).
2. Navigate to your website's root folder (e.g. `public_html` or `/var/www/phonesdaddy`).
3. Upload `deploy-bundle.zip`.
4. Right-click `deploy-bundle.zip` and select **Extract** (Overwrite existing files).

#### Step 3: Install Dependencies & Restart
In your hosting terminal (or SSH / Node.js panel):
```bash
npm install --omit=dev
```
Then restart your Node.js application (via PM2, Hostinger Node.js App Manager, or cPanel Node.js App).

**That's it!** On startup, the server automatically checks the database schema, adds any new columns if required, and serves your new updates while preserving all existing phones, news articles, and photos.

---

### Method 2: Deploying via Git (GitHub / GitLab / Bitbucket)

If your server pulls directly from a Git repository:

1. **Commit and Push Locally**:
   ```bash
   git add .
   git commit -m "Update website features"
   git push origin main
   ```
   *(Notice: `.gitignore` already protects `.env`, `uploads`, and `webfiles` from being committed).*

2. **Pull and Restart on Server**:
   ```bash
   git pull origin main
   npm install --omit=dev
   pm2 restart phonesdaddy
   ```

---

## 🗄️ Database Commands Reference

| Command | Description | Safe on Live Server? |
| :--- | :--- | :--- |
| `npm run db:backup` | Creates an instant timestamped `.sql` backup in `backups/`. | ✅ 100% Safe (Read-only) |
| `npm run migrate` | Runs schema updates / adds missing columns non-destructively. | ✅ 100% Safe (Non-destructive) |
| `npm run package:deploy` | Creates a clean, safe `deploy-bundle.zip` for server upload. | ✅ 100% Safe (Local only) |
| `npm start` | Starts production server with auto-migrations on boot. | ✅ 100% Safe |

---

## ⚠️ Things to NEVER Do on Production

1. ❌ **NEVER import `schema.sql` directly into phpMyAdmin** without checking if it contains `DROP TABLE` or `TRUNCATE`. (Always let `npm run migrate` or `server.js` handle updates).
2. ❌ **NEVER upload your local `.env`** to the server. Keep your server's `.env` configured with production database credentials.
3. ❌ **NEVER replace the entire `server/uploads` or `public/webfiles` directory** with local folders.
