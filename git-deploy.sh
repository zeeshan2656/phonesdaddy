#!/bin/bash
# =============================================================================
# PhonesDaddy — SAFE GIT DEPLOYMENT SCRIPT
# =============================================================================
# PURPOSE:
#   Run this on your server after every GitHub push. It performs a safe
#   git pull WITHOUT ever losing your uploaded images or webfiles.
#
# HOW TO USE:
#   First time setup on server (run once):
#     chmod +x git-deploy.sh
#
#   Every time you want to deploy new code from GitHub:
#     bash git-deploy.sh
#
# WHAT IT DOES:
#   1. Checks if UPLOADS_DIR is set in .env (persistent folder outside git)
#   2. If NOT set → backs up server/uploads/ and public/webfiles/ first
#   3. Runs: git pull origin main
#   4. Restores uploads/webfiles if they were backed up (fallback mode)
#   5. Runs: npm install --omit=dev
#   6. Restarts the Node.js app (via PM2 or prints manual instructions)
#
# RECOMMENDED SETUP (run once on server, then images are ALWAYS safe):
#   See Section: "Permanent Persistent Uploads Setup" below.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Read .env for UPLOADS_DIR ─────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
UPLOADS_DIR_VALUE=""
WEBFILES_DIR_VALUE=""

if [ -f "$ENV_FILE" ]; then
  UPLOADS_DIR_VALUE=$(grep -E '^UPLOADS_DIR=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  WEBFILES_DIR_VALUE=$(grep -E '^WEBFILES_DIR=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
fi

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}  PhonesDaddy — Safe Git Deploy${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""

# ── Check deployment mode ──────────────────────────────────────────────────────
NEED_BACKUP=false

if [ -n "$UPLOADS_DIR_VALUE" ]; then
  echo -e "${GREEN}✅  UPLOADS_DIR is configured: $UPLOADS_DIR_VALUE${NC}"
  echo -e "    Images live outside git repo → no backup needed, always safe."
  echo ""
else
  echo -e "${YELLOW}⚠️   UPLOADS_DIR not set in .env${NC}"
  echo -e "    Fallback mode: will backup uploads before git pull and restore after."
  echo -e "    ${BOLD}Recommended: set UPLOADS_DIR in .env for permanent safety.${NC}"
  echo ""
  NEED_BACKUP=true
fi

BACKUP_DIR=""

# ── Step 1: Backup if UPLOADS_DIR not configured ──────────────────────────────
if [ "$NEED_BACKUP" = true ]; then
  BACKUP_DIR="$PROJECT_DIR/.git-deploy-backup-$(date +%Y%m%d_%H%M%S)"
  echo -e "${BOLD}Step 1/5 — Backing up images before git pull...${NC}"
  mkdir -p "$BACKUP_DIR"

  PRESERVE_DIRS=(
    "server/uploads"
    "public/webfiles/phones"
    "public/webfiles/brands"
    "public/webfiles/news"
  )

  for dir in "${PRESERVE_DIRS[@]}"; do
    SRC="$PROJECT_DIR/$dir"
    DEST="$BACKUP_DIR/$dir"
    if [ -d "$SRC" ]; then
      mkdir -p "$(dirname "$DEST")"
      cp -r "$SRC" "$DEST"
      COUNT=$(find "$SRC" -type f ! -name '.gitkeep' | wc -l)
      echo -e "  ${GREEN}✓${NC} Backed up: $dir ($COUNT files)"
    fi
  done
  echo ""
else
  echo -e "${BOLD}Step 1/5 — Skipped backup (UPLOADS_DIR is set — images are safe).${NC}"
  echo ""
fi

# ── Step 2: Git pull ──────────────────────────────────────────────────────────
echo -e "${BOLD}Step 2/5 — Pulling latest code from GitHub...${NC}"
cd "$PROJECT_DIR"

# Make sure we're on the right branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
git pull origin "$BRANCH"
echo -e "  ${GREEN}✓${NC} Git pull complete (branch: $BRANCH)."
echo ""

# ── Step 3: Restore uploads if backed up ─────────────────────────────────────
if [ "$NEED_BACKUP" = true ] && [ -n "$BACKUP_DIR" ]; then
  echo -e "${BOLD}Step 3/5 — Restoring images from backup...${NC}"

  PRESERVE_DIRS=(
    "server/uploads"
    "public/webfiles/phones"
    "public/webfiles/brands"
    "public/webfiles/news"
  )

  RESTORED=0
  for dir in "${PRESERVE_DIRS[@]}"; do
    BACKED_UP="$BACKUP_DIR/$dir"
    TARGET="$PROJECT_DIR/$dir"
    if [ -d "$BACKED_UP" ]; then
      rm -rf "$TARGET"
      mkdir -p "$(dirname "$TARGET")"
      cp -r "$BACKED_UP" "$TARGET"
      COUNT=$(find "$TARGET" -type f ! -name '.gitkeep' | wc -l)
      echo -e "  ${GREEN}✓${NC} Restored: $dir ($COUNT files)"
      RESTORED=$((RESTORED + COUNT))
    else
      mkdir -p "$TARGET"
    fi
  done

  rm -rf "$BACKUP_DIR"
  echo -e "  ${GREEN}Total restored: $RESTORED files.${NC}"
  echo ""
else
  echo -e "${BOLD}Step 3/5 — Skipped restore (UPLOADS_DIR persistent storage is active).${NC}"
  echo ""
fi

# ── Step 4: npm install ───────────────────────────────────────────────────────
echo -e "${BOLD}Step 4/5 — Installing/updating npm packages...${NC}"
npm install --omit=dev --silent
echo -e "  ${GREEN}✓${NC} npm packages up to date."
echo ""

# ── Step 5: Restart app ───────────────────────────────────────────────────────
echo -e "${BOLD}Step 5/5 — Restarting the application...${NC}"

if command -v pm2 &> /dev/null; then
  PM2_APP=$(pm2 list --no-color 2>/dev/null | grep -E 'online|stopped' | awk '{print $4}' | head -1)
  if [ -n "$PM2_APP" ]; then
    pm2 restart "$PM2_APP" --update-env
    echo -e "  ${GREEN}✓${NC} Restarted via PM2: $PM2_APP"
  else
    pm2 start server/server.js --name phonesdaddy
    echo -e "  ${GREEN}✓${NC} Started new PM2 process: phonesdaddy"
  fi
else
  echo -e "  ${YELLOW}⚠️  PM2 not found.${NC} Restart manually:"
  echo -e "     Hostinger: Node.js App Manager → Restart"
  echo -e "     cPanel: Setup Node.js App → Restart"
fi
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Git Deployment Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "  Code updated to latest GitHub commit."
if [ -n "$UPLOADS_DIR_VALUE" ]; then
  echo -e "  Images (${UPLOADS_DIR_VALUE}) → ${GREEN}Always Safe (Persistent Dir)${NC}"
else
  echo -e "  Images → ${GREEN}Restored from backup${NC}"
  echo ""
  echo -e "  ${YELLOW}💡 TIP: Add UPLOADS_DIR to .env to skip backup on every deploy:${NC}"
  echo -e "     echo 'UPLOADS_DIR=/home/\$(whoami)/phonesdaddy_uploads' >> .env"
  echo -e "     bash setup-persistent-uploads.sh"
fi
echo ""

# =============================================================================
# PERMANENT PERSISTENT UPLOADS SETUP (run setup-persistent-uploads.sh once)
# =============================================================================
# After running git-deploy.sh for the first time, run this once to move your
# uploads to a permanent folder outside the git repo:
#
#   bash setup-persistent-uploads.sh
#
# After that, git pull will NEVER touch your images again — ever.
# =============================================================================
