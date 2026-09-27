# 🛡️ PhonesDaddy — Safe Production Deployment Guide

> **CRITICAL**: Never use Hostinger's "Extract" button directly on `deploy-bundle.zip`.  
> Always use `bash safe-deploy.sh` on the server instead. This is the only method that protects your images.

---

## ⚡ Why Images Were Getting Deleted

When you upload `deploy-bundle.zip` and click **Extract** in Hostinger's File Manager, it:
1. Extracts the ZIP contents, **overwriting** every matching file and folder
2. The ZIP contains an **empty** `server/uploads/` folder (with only `.gitkeep`)
3. That empty folder **replaces** the live `server/uploads/` — wiping all your phone images, news images, brand logos, etc.

The solution is to run `safe-deploy.sh` on the server, which **backs up your images first**, then extracts, then **restores them back**.

---

## 🚀 How to Deploy (Step-by-Step — Image-Safe)

### Step 1: Package the new code (on your local computer)
```bash
npm run package:deploy
```
This creates `deploy-bundle.zip` (≈2–3 MB). It includes `safe-deploy.sh` and excludes uploads, .env, and node_modules.

---

### Step 2: Upload the ZIP to your server

**Option A — Hostinger File Manager:**
1. Login to Hostinger hPanel
2. Go to **Files → File Manager**
3. Navigate to your project root (e.g. `domains/yourdomain.com/public_html` or the Node.js app folder)
4. Click **Upload** and select `deploy-bundle.zip`
5. ⚠️ **DO NOT click Extract yet!**

**Option B — SFTP / FTP:**
Upload `deploy-bundle.zip` to your project root using FileZilla or WinSCP.

---

### Step 3: Run the safe deploy script on the server

**Option A — Hostinger SSH Terminal:**
1. In hPanel go to **Advanced → SSH Access** or open the Terminal
2. Navigate to your project root:
   ```bash
   cd ~/domains/yourdomain.com/public_html
   ```
3. Run:
   ```bash
   bash safe-deploy.sh
   ```

**Option B — VPS via SSH:**
```bash
ssh user@your-server-ip
cd /var/www/phonesdaddy
bash safe-deploy.sh
```

### What `safe-deploy.sh` does automatically:
| Step | Action | Your Images |
|---|---|---|
| 1 | Backs up `server/uploads/` and `public/webfiles/` to temp folder | ✅ Safe |
| 2 | Extracts `deploy-bundle.zip` (new code) | ✅ Backup in temp |
| 3 | Restores all your images from the temp backup | ✅ Fully Restored |
| 4 | Runs `npm install --omit=dev` | — |
| 5 | Restarts the app via PM2 or prints manual instructions | — |
| 6 | Deletes temp backup + ZIP file | ✅ Clean |

---

## 🔒 What Is Always Protected

| Protected Item | Why | How |
|---|---|---|
| `server/uploads/phones/` | Phone images (WebP + thumbnails) | Backed up & restored by `safe-deploy.sh` |
| `server/uploads/news/` | News article images | Backed up & restored by `safe-deploy.sh` |
| `server/uploads/brands/` | Brand logos | Backed up & restored by `safe-deploy.sh` |
| `server/uploads/branding/` | Site logo & favicon | Backed up & restored by `safe-deploy.sh` |
| `server/uploads/reviews/` | User review images | Backed up & restored by `safe-deploy.sh` |
| `public/webfiles/phones/` | Scraped gallery images | Backed up & restored by `safe-deploy.sh` |
| `public/webfiles/news/` | Scraped news thumbnails | Backed up & restored by `safe-deploy.sh` |
| `.env` | DB credentials & secrets | Never included in ZIP |
| `node_modules/` | Dependencies | Never included in ZIP |
| MySQL Database | All phones, articles, reviews | Auto-migrate only adds columns, never drops |

---

## 🗄️ Database Commands Reference

| Command | Description | Safe on Live Server? |
|---|---|---|
| `npm run db:backup` | Creates a timestamped `.sql` backup in `backups/` | ✅ 100% Safe |
| `npm run migrate` | Adds missing columns non-destructively | ✅ 100% Safe |
| `npm run package:deploy` | Creates `deploy-bundle.zip` for upload | ✅ Local only |
| `npm start` | Starts server with auto-migrations on boot | ✅ 100% Safe |

---

## ⚠️ Things to NEVER Do

1. ❌ **NEVER click "Extract" on the ZIP directly in Hostinger File Manager** — it will wipe `server/uploads/`
2. ❌ **NEVER upload your local `.env`** to the server
3. ❌ **NEVER run `DROP TABLE` or `TRUNCATE`** in phpMyAdmin
4. ❌ **NEVER manually replace `server/uploads/`** with your local folder (your local uploads are empty)

---

## 🔁 Quick Reference: Full Deploy Flow

```
[Your PC]                          [Server]
   │                                  │
   ├─ npm run package:deploy           │
   │  → Creates deploy-bundle.zip      │
   │                                  │
   ├─ Upload deploy-bundle.zip ──────► │
   │                                  │
   │                                  ├─ bash safe-deploy.sh
   │                                  │   ├─ Backup images
   │                                  │   ├─ Extract ZIP
   │                                  │   ├─ Restore images
   │                                  │   ├─ npm install
   │                                  │   └─ Restart app
   │                                  │
   │                            ✅ Site Updated
   │                            ✅ All Images Safe
```
