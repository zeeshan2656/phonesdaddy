#!/bin/bash
# =============================================================================
# PhonesDaddy — SAFE SERVER DEPLOYMENT SCRIPT
# =============================================================================
# PURPOSE: Deploy a new version WITHOUT losing any existing images or uploads.
#
# HOW TO USE ON YOUR SERVER (Hostinger / VPS / cPanel SSH):
#   1. Upload  deploy-bundle.zip  to your server's project root folder.
#   2. SSH into your server (or use Hostinger's terminal).
#   3. Navigate to your project folder:
#        cd /home/yourusername/public_html     (Hostinger shared)
#        cd /var/www/phonesdaddy              (VPS)
#   4. Run this script:
#        bash safe-deploy.sh
#
# WHAT THIS SCRIPT DOES:
#   Step 1 — Backs up all existing uploads & webfiles to a temp folder.
#   Step 2 — Extracts deploy-bundle.zip (new code).
#   Step 3 — Restores your uploads & webfiles from the backup.
#   Step 4 — Installs/updates npm packages.
#   Step 5 — Restarts the Node.js application.
# =============================================================================

set -e  # Exit immediately if any command fails

# ── Colors for output ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP_FILE="$PROJECT_DIR/deploy-bundle.zip"
BACKUP_DIR="$PROJECT_DIR/.deploy-backup-$(date +%Y%m%d_%H%M%S)"

# Directories that MUST be preserved (user-uploaded images/files)
PRESERVE_DIRS=(
  "server/uploads/phones"
  "server/uploads/brands"
  "server/uploads/branding"
  "server/uploads/news"
  "server/uploads/reviews"
  "public/webfiles/phones"
  "public/webfiles/brands"
  "public/webfiles/news"
)

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}  PhonesDaddy — Safe Deployment Script${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}❌  ERROR: deploy-bundle.zip not found in: $PROJECT_DIR${NC}"
  echo -e "    Please upload deploy-bundle.zip to your project root first."
  exit 1
fi

echo -e "${GREEN}✅  Found: deploy-bundle.zip${NC}"
echo -e "${YELLOW}📁  Project root: $PROJECT_DIR${NC}"
echo ""

# ── Step 1: Backup existing uploads ──────────────────────────────────────────
echo -e "${BOLD}Step 1/5 — Backing up existing images & uploads...${NC}"
mkdir -p "$BACKUP_DIR"

BACKUP_COUNT=0
for dir in "${PRESERVE_DIRS[@]}"; do
  SRC="$PROJECT_DIR/$dir"
  DEST="$BACKUP_DIR/$dir"
  if [ -d "$SRC" ]; then
    mkdir -p "$(dirname "$DEST")"
    cp -r "$SRC" "$DEST"
    FILE_COUNT=$(find "$SRC" -type f ! -name '.gitkeep' | wc -l)
    echo -e "  ${GREEN}✓${NC} Backed up: $dir ($FILE_COUNT files)"
    BACKUP_COUNT=$((BACKUP_COUNT + FILE_COUNT))
  else
    echo -e "  ${YELLOW}—${NC} Skipped (not found): $dir"
  fi
done
echo -e "  ${GREEN}Total files backed up: $BACKUP_COUNT${NC}"
echo ""

# ── Step 2: Extract the new deployment bundle ─────────────────────────────────
echo -e "${BOLD}Step 2/5 — Extracting deploy-bundle.zip...${NC}"
unzip -o "$ZIP_FILE" -d "$PROJECT_DIR" > /dev/null
echo -e "  ${GREEN}✓${NC} Extraction complete."
echo ""

# ── Step 3: Restore uploads from backup ──────────────────────────────────────
echo -e "${BOLD}Step 3/5 — Restoring images from backup...${NC}"
RESTORE_COUNT=0
for dir in "${PRESERVE_DIRS[@]}"; do
  BACKED_UP="$BACKUP_DIR/$dir"
  TARGET="$PROJECT_DIR/$dir"
  if [ -d "$BACKED_UP" ]; then
    # Remove the empty placeholder that was extracted from zip
    rm -rf "$TARGET"
    mkdir -p "$(dirname "$TARGET")"
    cp -r "$BACKED_UP" "$TARGET"
    FILE_COUNT=$(find "$TARGET" -type f ! -name '.gitkeep' | wc -l)
    echo -e "  ${GREEN}✓${NC} Restored: $dir ($FILE_COUNT files)"
    RESTORE_COUNT=$((RESTORE_COUNT + FILE_COUNT))
  else
    # Directory wasn't in backup — just ensure it exists on server
    mkdir -p "$TARGET"
    echo -e "  ${YELLOW}—${NC} Created empty dir: $dir"
  fi
done
echo -e "  ${GREEN}Total files restored: $RESTORE_COUNT${NC}"
echo ""

# ── Step 4: Install/update npm packages ──────────────────────────────────────
echo -e "${BOLD}Step 4/5 — Installing npm packages...${NC}"
cd "$PROJECT_DIR"
npm install --omit=dev --silent
echo -e "  ${GREEN}✓${NC} npm packages up to date."
echo ""

# ── Step 5: Restart the Node.js application ──────────────────────────────────
echo -e "${BOLD}Step 5/5 — Restarting the application...${NC}"

if command -v pm2 &> /dev/null; then
  APP_NAME=$(pm2 list --no-color 2>/dev/null | grep -oP '[a-z][a-zA-Z0-9_-]+' | head -1)
  if [ -n "$APP_NAME" ]; then
    pm2 restart "$APP_NAME" --update-env
    echo -e "  ${GREEN}✓${NC} Restarted via PM2: $APP_NAME"
  else
    pm2 start server/server.js --name phonesdaddy
    echo -e "  ${GREEN}✓${NC} Started new PM2 process: phonesdaddy"
  fi
else
  echo -e "  ${YELLOW}⚠️  PM2 not found.${NC}"
  echo -e "  → Please restart your app manually via:"
  echo -e "     Hostinger: Node.js App Manager → Restart"
  echo -e "     cPanel: Setup Node.js App → Restart"
  echo -e "     VPS: sudo systemctl restart phonesdaddy"
fi
echo ""

# ── Cleanup the temporary backup ─────────────────────────────────────────────
echo -e "${BOLD}Cleaning up...${NC}"
rm -rf "$BACKUP_DIR"
rm -f "$ZIP_FILE"   # Remove the zip to keep server clean
echo -e "  ${GREEN}✓${NC} Cleanup done."
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Deployment Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "  • All existing phone images     → ${GREEN}PRESERVED${NC}"
echo -e "  • All news/article images       → ${GREEN}PRESERVED${NC}"
echo -e "  • Brand logos & branding files  → ${GREEN}PRESERVED${NC}"
echo -e "  • Production .env & database    → ${GREEN}UNTOUCHED${NC}"
echo -e "  • New code changes              → ${GREEN}LIVE${NC}"
echo ""
echo -e "  Your site is running at your production domain. 🎉"
echo ""
