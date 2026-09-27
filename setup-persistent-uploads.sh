#!/bin/bash
# =============================================================================
# PhonesDaddy — ONE-TIME PERSISTENT UPLOADS SETUP
# =============================================================================
# Run this ONCE on your server to permanently move your uploads folder
# to a location OUTSIDE the git repository.
#
# After this runs:
#   → Your images live in  ~/phonesdaddy_uploads/
#   → Git can NEVER touch them, even with git clean or fresh clone
#   → Every future  bash git-deploy.sh  is 100% image-safe automatically
#
# HOW TO RUN (on your server via SSH or Hostinger Terminal):
#   bash setup-persistent-uploads.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  PhonesDaddy — Persistent Uploads Setup${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# ── Determine the persistent uploads path ─────────────────────────────────────
# Default: one level above the project, in ~/phonesdaddy_uploads
PERSISTENT_UPLOADS="${HOME}/phonesdaddy_uploads"
PERSISTENT_WEBFILES="${HOME}/phonesdaddy_webfiles"

echo -e "This will move your images to:"
echo -e "  Uploads  → ${BOLD}$PERSISTENT_UPLOADS${NC}"
echo -e "  Webfiles → ${BOLD}$PERSISTENT_WEBFILES${NC}"
echo ""
echo -e "These folders are completely OUTSIDE the git repository."
echo -e "Git can never delete or overwrite them, ever."
echo ""
read -p "Continue? (y/N) " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi
echo ""

# ── Step 1: Create persistent directories ────────────────────────────────────
echo -e "${BOLD}Step 1/5 — Creating persistent directories...${NC}"
UPLOAD_SUBDIRS=(phones brands branding news reviews)
WEBFILE_SUBDIRS=(phones brands news)

for d in "${UPLOAD_SUBDIRS[@]}"; do
  mkdir -p "$PERSISTENT_UPLOADS/$d"
  echo -e "  ${GREEN}✓${NC} $PERSISTENT_UPLOADS/$d"
done
for d in "${WEBFILE_SUBDIRS[@]}"; do
  mkdir -p "$PERSISTENT_WEBFILES/$d"
  echo -e "  ${GREEN}✓${NC} $PERSISTENT_WEBFILES/$d"
done
echo ""

# ── Step 2: Move existing uploads to persistent location ─────────────────────
echo -e "${BOLD}Step 2/5 — Moving existing images to persistent location...${NC}"

UPLOAD_SRC="$PROJECT_DIR/server/uploads"
WEBFILES_SRC="$PROJECT_DIR/public/webfiles"

if [ -d "$UPLOAD_SRC" ]; then
  for subdir in "${UPLOAD_SUBDIRS[@]}"; do
    SRC="$UPLOAD_SRC/$subdir"
    DEST="$PERSISTENT_UPLOADS/$subdir"
    if [ -d "$SRC" ]; then
      # Copy files (not .gitkeep)
      find "$SRC" -type f ! -name '.gitkeep' -exec cp {} "$DEST/" \;
      COUNT=$(find "$DEST" -type f | wc -l)
      echo -e "  ${GREEN}✓${NC} Moved $COUNT files: uploads/$subdir → $DEST"
    fi
  done
fi

if [ -d "$WEBFILES_SRC" ]; then
  for subdir in "${WEBFILE_SUBDIRS[@]}"; do
    SRC="$WEBFILES_SRC/$subdir"
    DEST="$PERSISTENT_WEBFILES/$subdir"
    if [ -d "$SRC" ]; then
      find "$SRC" -type f ! -name '.gitkeep' -exec cp {} "$DEST/" \;
      COUNT=$(find "$DEST" -type f | wc -l)
      echo -e "  ${GREEN}✓${NC} Moved $COUNT files: webfiles/$subdir → $DEST"
    fi
  done
fi
echo ""

# ── Step 3: Update .env with persistent paths ─────────────────────────────────
echo -e "${BOLD}Step 3/5 — Updating .env with persistent paths...${NC}"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "  ${YELLOW}⚠️  .env not found. Creating from .env.example...${NC}"
  if [ -f "$PROJECT_DIR/.env.example" ]; then
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

# Remove any existing UPLOADS_DIR / WEBFILES_DIR lines
sed -i '/^UPLOADS_DIR=/d' "$ENV_FILE"
sed -i '/^WEBFILES_DIR=/d' "$ENV_FILE"

# Append new values
echo "" >> "$ENV_FILE"
echo "# Persistent storage outside git repo (safe across all deployments)" >> "$ENV_FILE"
echo "UPLOADS_DIR=$PERSISTENT_UPLOADS" >> "$ENV_FILE"
echo "WEBFILES_DIR=$PERSISTENT_WEBFILES" >> "$ENV_FILE"

echo -e "  ${GREEN}✓${NC} Added UPLOADS_DIR=$PERSISTENT_UPLOADS"
echo -e "  ${GREEN}✓${NC} Added WEBFILES_DIR=$PERSISTENT_WEBFILES"
echo ""

# ── Step 4: Keep .gitkeep in project upload dirs ──────────────────────────────
echo -e "${BOLD}Step 4/5 — Ensuring project upload dirs have .gitkeep only...${NC}"
for d in "${UPLOAD_SUBDIRS[@]}"; do
  DIR="$PROJECT_DIR/server/uploads/$d"
  mkdir -p "$DIR"
  # Remove all actual files, keep directory structure
  find "$DIR" -type f ! -name '.gitkeep' -delete 2>/dev/null || true
  touch "$DIR/.gitkeep"
  echo -e "  ${GREEN}✓${NC} Cleared project: server/uploads/$d (images moved to persistent dir)"
done
for d in "${WEBFILE_SUBDIRS[@]}"; do
  DIR="$PROJECT_DIR/public/webfiles/$d"
  mkdir -p "$DIR"
  find "$DIR" -type f ! -name '.gitkeep' -delete 2>/dev/null || true
  touch "$DIR/.gitkeep"
  echo -e "  ${GREEN}✓${NC} Cleared project: public/webfiles/$d (images moved to persistent dir)"
done
echo ""

# ── Step 5: Restart app ───────────────────────────────────────────────────────
echo -e "${BOLD}Step 5/5 — Restarting application with new paths...${NC}"
if command -v pm2 &> /dev/null; then
  PM2_APP=$(pm2 list --no-color 2>/dev/null | grep -E 'online|stopped' | awk '{print $4}' | head -1)
  if [ -n "$PM2_APP" ]; then
    pm2 restart "$PM2_APP" --update-env
    echo -e "  ${GREEN}✓${NC} Restarted via PM2: $PM2_APP"
  else
    pm2 start server/server.js --name phonesdaddy
    echo -e "  ${GREEN}✓${NC} Started: phonesdaddy"
  fi
else
  echo -e "  ${YELLOW}⚠️  Please restart your app manually:${NC}"
  echo -e "     Hostinger: Node.js App Manager → Restart"
fi
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Persistent Storage Setup Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo ""
echo -e "  Your uploads are now stored in:"
echo -e "    ${BOLD}$PERSISTENT_UPLOADS${NC}"
echo -e "    ${BOLD}$PERSISTENT_WEBFILES${NC}"
echo ""
echo -e "  These folders are OUTSIDE the git repository."
echo -e "  No git command can ever touch them."
echo ""
echo -e "  ${BOLD}Future deployments:${NC}"
echo -e "    bash git-deploy.sh   ← images 100% safe, no backup needed"
echo ""
