#!/bin/bash
# =============================================================================
# PhonesDaddy — ONE-TIME PERSISTENT MEDIA SETUP (Linux / Hostinger / cPanel)
# =============================================================================
# Run this ONCE on your live server to permanently move all images/media
# to a dedicated persistent folder OUTSIDE the deployment directory.
#
# After this runs:
#   → All media lives in  ~/phonesdaddy_media/
#   → Neither Git pull, Git webhook, nor ZIP extraction can EVER touch them
#   → All future deployments (Git or ZIP) are 100% safe
#
# HOW TO RUN ON SERVER:
#   bash setup-persistent-media.sh
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
echo -e "${BOLD}  PhonesDaddy — Persistent Media Setup${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# Persistent media directory (outside deployment root)
# Default: ~/phonesdaddy_media or ../phonesdaddy_media
if [ -n "$HOME" ] && [ -d "$HOME" ]; then
  PERSISTENT_MEDIA="${HOME}/phonesdaddy_media"
else
  PERSISTENT_MEDIA="$(cd "$PROJECT_DIR/.." && pwd)/phonesdaddy_media"
fi

echo -e "This will configure your media storage at:"
echo -e "  Persistent Media → ${BOLD}${GREEN}$PERSISTENT_MEDIA${NC}"
echo ""
echo -e "This folder is completely OUTSIDE your deployment directory."
echo -e "Git and ZIP extractions can NEVER overwrite or wipe your images."
echo ""

# ── Step 1: Create persistent directories ────────────────────────────────────
echo -e "${BOLD}Step 1/4 — Creating persistent directories...${NC}"
UPLOAD_SUBDIRS=(phones brands branding news reviews)
WEBFILE_SUBDIRS=(phones brands news branding)

for d in "${UPLOAD_SUBDIRS[@]}"; do
  mkdir -p "$PERSISTENT_MEDIA/uploads/$d"
  echo -e "  ${GREEN}✓${NC} $PERSISTENT_MEDIA/uploads/$d"
done
for d in "${WEBFILE_SUBDIRS[@]}"; do
  mkdir -p "$PERSISTENT_MEDIA/webfiles/$d"
  echo -e "  ${GREEN}✓${NC} $PERSISTENT_MEDIA/webfiles/$d"
done
mkdir -p "$PERSISTENT_MEDIA/images"
echo -e "  ${GREEN}✓${NC} $PERSISTENT_MEDIA/images"
echo ""

# ── Step 2: Migrate existing media to persistent location ────────────────────
echo -e "${BOLD}Step 2/4 — Migrating existing media from project...${NC}"

# Check project server/uploads
if [ -d "$PROJECT_DIR/server/uploads" ]; then
  for subdir in "${UPLOAD_SUBDIRS[@]}"; do
    SRC="$PROJECT_DIR/server/uploads/$subdir"
    DEST="$PERSISTENT_MEDIA/uploads/$subdir"
    if [ -d "$SRC" ]; then
      find "$SRC" -type f ! -name '.gitkeep' -exec cp -n {} "$DEST/" \; 2>/dev/null || true
    fi
  done
fi

# Check project public/webfiles
if [ -d "$PROJECT_DIR/public/webfiles" ]; then
  for subdir in "${WEBFILE_SUBDIRS[@]}"; do
    SRC="$PROJECT_DIR/public/webfiles/$subdir"
    DEST="$PERSISTENT_MEDIA/webfiles/$subdir"
    if [ -d "$SRC" ]; then
      find "$SRC" -type f ! -name '.gitkeep' -exec cp -n {} "$DEST/" \; 2>/dev/null || true
    fi
  done
fi

# Check legacy split folders if they exist (~/phonesdaddy_uploads, ~/phonesdaddy_webfiles)
if [ -d "${HOME}/phonesdaddy_uploads" ] && [ "${HOME}/phonesdaddy_uploads" != "$PERSISTENT_MEDIA/uploads" ]; then
  cp -rn "${HOME}/phonesdaddy_uploads/"* "$PERSISTENT_MEDIA/uploads/" 2>/dev/null || true
fi
if [ -d "${HOME}/phonesdaddy_webfiles" ] && [ "${HOME}/phonesdaddy_webfiles" != "$PERSISTENT_MEDIA/webfiles" ]; then
  cp -rn "${HOME}/phonesdaddy_webfiles/"* "$PERSISTENT_MEDIA/webfiles/" 2>/dev/null || true
fi

TOTAL_FILES=$(find "$PERSISTENT_MEDIA" -type f | wc -l)
echo -e "  ${GREEN}✓${NC} Media migration complete. Total files in persistent storage: ${BOLD}$TOTAL_FILES${NC}"
echo ""

# ── Step 3: Update .env with MEDIA_DIR ────────────────────────────────────────
echo -e "${BOLD}Step 3/4 — Configuring .env...${NC}"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$PROJECT_DIR/.env.example" ]; then
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

# Clean old paths
sed -i '/^MEDIA_DIR=/d' "$ENV_FILE"
sed -i '/^UPLOADS_DIR=/d' "$ENV_FILE"
sed -i '/^WEBFILES_DIR=/d' "$ENV_FILE"

# Append unified MEDIA_DIR
echo "" >> "$ENV_FILE"
echo "# Persistent media storage outside deployment folder (safe across all Git & ZIP deployments)" >> "$ENV_FILE"
echo "MEDIA_DIR=$PERSISTENT_MEDIA" >> "$ENV_FILE"

echo -e "  ${GREEN}✓${NC} Added MEDIA_DIR=$PERSISTENT_MEDIA to .env"
echo ""

# ── Step 4: Restart application ───────────────────────────────────────────────
echo -e "${BOLD}Step 4/4 — Restarting application...${NC}"
if command -v pm2 &> /dev/null; then
  PM2_APP=$(pm2 list --no-color 2>/dev/null | grep -E 'online|stopped' | awk '{print $4}' | head -1)
  if [ -n "$PM2_APP" ]; then
    pm2 restart "$PM2_APP" --update-env
    echo -e "  ${GREEN}✓${NC} Restarted via PM2: $PM2_APP"
  else
    pm2 start server/server.js --name phonesdaddy
    echo -e "  ${GREEN}✓${NC} Started PM2 process: phonesdaddy"
  fi
else
  echo -e "  ${YELLOW}ℹ️  PM2 not found. Please restart your Node.js application in your hosting panel.${NC}"
fi
echo ""

echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Persistent Media Setup Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "  All media is now stored in: ${BOLD}$PERSISTENT_MEDIA${NC}"
echo -e "  You can now deploy using Git or ZIP File anytime with 100% confidence."
echo ""
