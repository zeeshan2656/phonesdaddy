# 🛡️ PhonesDaddy — Zero-Risk Production Deployment Guide

This guide explains how to deploy new versions of PhonesDaddy to your live Hostinger server with **100% guarantee** that your uploaded phone images, news photos, and brand logos remain completely safe.

---

## 🚨 IMAGES DISAPPEARED AFTER DEPLOYMENT? — Fix in 3 Steps

This happens because images were stored **inside** the deployment folder. Here is how to fix it permanently:

### Step 1: Open Hostinger Terminal
Go to **Hostinger Control Panel → Advanced → Terminal** (or use SSH).

### Step 2: Navigate to your project and run the recovery script
```bash
cd ~/domains/yourdomain.com/public_html
bash setup-persistent-media.sh
```
This will:
1. Create `~/phonesdaddy_media/` outside your deployment folder (safe zone)
2. Copy any existing images from `server/uploads` and `public/webfiles` into the safe zone
3. Update your `.env` with `MEDIA_DIR=~/phonesdaddy_media` so all future image uploads go there

### Step 3: Restart your Node.js app
Go to **Hostinger → Node.js App Manager → click Restart**.

✅ **Done!** Your images are now permanently protected. They can never be overwritten by Git pulls or ZIP extractions again.

---

## ⚡ Why Images Were Disappearing on Hostinger (The Root Cause)

Hostinger's Cloud / Node.js build system uses **`hbuilds`**:
- Every time you deploy a new version, Hostinger generates a new folder: `hbuilds/versions/<new-id>/` and updates a symlink `hbuilds/current` to point to it.
- If media is stored inside `hbuilds/current/phonesdaddy_media`, every deployment creates a **brand new empty folder**, leaving your uploaded photos behind in the old build folder!

### The Permanent Solution:
Media is now moved completely **OUTSIDE** `hbuilds` to your top-level user home:
👉 **`/home/u434697879/phonesdaddy_media/`** (or `~/phonesdaddy_media/`)

```text
/home/u434697879/                       (Your User Root)
│
├── phonesdaddy_media/                  ← 100% PERSISTENT (Completely outside hbuilds)
│   ├── uploads/                        ← Admin logos, news banners, branding
│   └── webfiles/phones/                ← Scraped & optimized WebP phone photos
│
└── hbuilds/                            (Hostinger Build System)
    ├── versions/                       ← Hostinger creates new folders here on deploy
    └── current -> versions/<id>        ← Deployed code (Safe: media is NOT here!)
```

Because `phonesdaddy_media` is sitting at `/home/u434697879/phonesdaddy_media` outside `hbuilds/`, Hostinger's build system can create 10,000 new versions without ever touching your photos!

---

## 🚀 Safe Deployment Process (After One-Time Setup)

### METHOD 1: Via GitHub Git Auto-Deploy (Recommended)

Your media is already outside the Git repo, so:
1. Push code changes to GitHub
2. Hostinger Git Auto-Deploy pulls new code automatically
3. ✅ Media is untouched — nothing to do

Or manually via Hostinger Terminal:
```bash
cd ~/domains/yourdomain.com/public_html
bash git-deploy.sh
```

### METHOD 2: Via ZIP File (Hostinger File Manager)

1. On your local machine, run:
   ```bash
   npm run package:deploy
   ```
   This creates `deploy-bundle.zip` (~2–3 MB) — **it contains zero media folders**, so extracting it can never wipe your images.

2. Upload `deploy-bundle.zip` to your Hostinger File Manager
3. Click **Extract** (safe — zero media folders in zip)
4. Delete the zip file
5. Go to **Node.js App Manager → Restart**

---

## ⚙️ Required .env Settings on Live Server

After running `setup-persistent-media.sh`, your `.env` should contain:

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=phonesdaddy
DB_USER=your_db_user
DB_PASSWORD=your_db_password
SESSION_SECRET=your_secret_key

# IMPORTANT: This must point to the external media folder
MEDIA_DIR=/home/yourusername/phonesdaddy_media
```

> 💡 **Tip:** You can find your exact home path by running `echo $HOME` in the Hostinger Terminal.

---

## 🗄️ Database Commands Reference

| Command | Description | Safe on Live Server? |
|---|---|---|
| `npm run db:backup` | Creates a timestamped `.sql` backup in `backups/` | ✅ 100% Safe |
| `npm run migrate` | Adds missing columns non-destructively | ✅ 100% Safe |
| `npm run setup:media` | Migrates media to persistent external folder | ✅ 100% Safe |
| `npm run package:deploy` | Creates clean `deploy-bundle.zip` for upload | ✅ Local only |
| `npm start` | Starts server with non-destructive migrations | ✅ 100% Safe |

---

## ❓ Frequently Asked Questions

**Q: I ran setup-persistent-media.sh but images are still gone. Why?**
A: The images that disappeared were already gone from the server before the script ran. The script protects future images. To get the missing images back, you need to re-upload or re-scrape them from the admin panel.

**Q: Will running the setup script again cause problems?**
A: No — the script is fully idempotent. Running it multiple times is safe. It uses `cp -n` (no-overwrite) so it never overwrites existing images.

**Q: What if my .env doesn't have MEDIA_DIR?**
A: With our latest update in `server/utils/paths.js`, the server automatically creates and uses `../phonesdaddy_media` outside your deployment directory even if `MEDIA_DIR` is not explicitly set in `.env`! Running `bash setup-persistent-media.sh` is still recommended to set the explicit path and establish directory permissions.

**Q: After deployment, do I need to run setup-persistent-media.sh again?**
A: No — only run it once. After that, just deploy as normal (Git or ZIP). All future images remain untouched in the persistent folder outside the deployment root.
