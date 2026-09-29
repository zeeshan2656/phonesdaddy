#!/bin/bash
# =============================================================================
# PhonesDaddy — ONE-TIME MEDIA SETUP (Run on live server via Hostinger Terminal)
# =============================================================================
# This script sets up a persistent media directory OUTSIDE the deployment
# folder so that future Git pulls and ZIP deployments NEVER wipe your images.
#
# HOW TO RUN:
#   1. Open Hostinger Terminal
#   2. cd ~/domains/yourdomain.com/public_html
#   3. bash setup-persistent-media.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}  PhonesDaddy — Persistent Media Setup${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""
echo -e "  Project : ${BOLD}$PROJECT_DIR${NC}"

# ── Determine media directory ─────────────────────────────────────────────────
# On Hostinger (or any system with $HOME), persistent media MUST live in $HOME
# completely outside temporary build folders like hbuilds!
if [ -n "$HOME" ] && [ -d "$HOME" ] && [ -w "$HOME" ]; then
  PERSISTENT_MEDIA="$HOME/phonesdaddy_media"
elif [[ "$PROJECT_DIR" == *"hbuilds"* ]]; then
  HOSTINGER_ROOT="${PROJECT_DIR%%/hbuilds*}"
  PERSISTENT_MEDIA="$HOSTINGER_ROOT/phonesdaddy_media"
else
  PERSISTENT_MEDIA="$(cd "$PROJECT_DIR/.." 2>/dev/null && pwd)/phonesdaddy_media"
fi

echo -e "  Media   : ${BOLD}${GREEN}$PERSISTENT_MEDIA${NC}"
echo ""

# ── Step 1: Create directory structure ───────────────────────────────────────
echo -e "${BOLD}Step 1/4 — Creating persistent directories...${NC}"

mkdir -p "$PERSISTENT_MEDIA/uploads/phones"
mkdir -p "$PERSISTENT_MEDIA/uploads/brands"
mkdir -p "$PERSISTENT_MEDIA/uploads/branding"
mkdir -p "$PERSISTENT_MEDIA/uploads/news"
mkdir -p "$PERSISTENT_MEDIA/uploads/reviews"
mkdir -p "$PERSISTENT_MEDIA/webfiles/phones"
mkdir -p "$PERSISTENT_MEDIA/webfiles/brands"
mkdir -p "$PERSISTENT_MEDIA/webfiles/news"
mkdir -p "$PERSISTENT_MEDIA/webfiles/branding"
mkdir -p "$PERSISTENT_MEDIA/images"

echo -e "  ${GREEN}✓${NC} All media directories created"
echo ""

# ── Step 2: Recover any images trapped inside Hostinger's temporary hbuilds ────
echo -e "${BOLD}Step 2/4 — Recovering images from previous builds...${NC}"

# Check hbuilds/current/phonesdaddy_media (from Image 2)
if [ -d "$PROJECT_DIR/../phonesdaddy_media" ] && [ "$(cd "$PROJECT_DIR/../phonesdaddy_media" && pwd)" != "$PERSISTENT_MEDIA" ]; then
  echo -e "  ${YELLOW}ℹ${NC}  Found trapped images in hbuilds/current/phonesdaddy_media. Recovering..."
  cp -rn "$PROJECT_DIR/../phonesdaddy_media/"* "$PERSISTENT_MEDIA/" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Recovered images from hbuilds/current/phonesdaddy_media"
fi

# Check all Hostinger build versions in hbuilds/versions/*/phonesdaddy_media
if [[ "$PROJECT_DIR" == *"hbuilds"* ]]; then
  HBUILDS_ROOT="${PROJECT_DIR%%/hbuilds*}/hbuilds"
  if [ -d "$HBUILDS_ROOT/versions" ]; then
    echo -e "  ${YELLOW}ℹ${NC}  Scanning previous build versions in $HBUILDS_ROOT/versions..."
    for vdir in "$HBUILDS_ROOT/versions/"*/phonesdaddy_media; do
      if [ -d "$vdir" ] && [ "$vdir" != "$PERSISTENT_MEDIA" ]; then
        cp -rn "$vdir/"* "$PERSISTENT_MEDIA/" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Recovered images from $vdir"
      fi
    done
  fi
fi

if [ -d "$PROJECT_DIR/public/webfiles" ]; then
  cp -rn "$PROJECT_DIR/public/webfiles/"* "$PERSISTENT_MEDIA/webfiles/" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Preserved webfiles"
fi

if [ -d "$PROJECT_DIR/server/uploads" ]; then
  cp -rn "$PROJECT_DIR/server/uploads/"* "$PERSISTENT_MEDIA/uploads/" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Preserved uploads"
fi
echo ""

# ── Step 3: Update .env ───────────────────────────────────────────────────────
echo -e "${BOLD}Step 3/4 — Updating .env...${NC}"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$PROJECT_DIR/.env.example" ]; then
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
    echo -e "  ${GREEN}✓${NC} Created .env from .env.example (fill in your DB credentials!)"
  else
    echo "NODE_ENV=production" > "$ENV_FILE"
    echo -e "  ${YELLOW}⚠${NC}  Created minimal .env — add DB credentials manually"
  fi
fi

# Remove old media path entries, add the new unified MEDIA_DIR
sed -i '/^MEDIA_DIR=/d'    "$ENV_FILE"
sed -i '/^UPLOADS_DIR=/d'  "$ENV_FILE"
sed -i '/^WEBFILES_DIR=/d' "$ENV_FILE"

echo "" >> "$ENV_FILE"
echo "# Persistent media — SAFE from Git pull and ZIP extraction" >> "$ENV_FILE"
echo "MEDIA_DIR=$PERSISTENT_MEDIA" >> "$ENV_FILE"

echo -e "  ${GREEN}✓${NC} MEDIA_DIR set to: $PERSISTENT_MEDIA"
echo ""

# ── Step 4: Restart app ───────────────────────────────────────────────────────
echo -e "${BOLD}Step 4/4 — Restarting application...${NC}"

if command -v pm2 &>/dev/null; then
  PM2_APP=$(pm2 list --no-color 2>/dev/null | grep -E 'online|stopped' | awk '{print $4}' | head -1)
  if [ -n "$PM2_APP" ]; then
    pm2 restart "$PM2_APP" --update-env
    echo -e "  ${GREEN}✓${NC} Restarted via PM2: $PM2_APP"
  else
    pm2 start server/server.js --name phonesdaddy
    echo -e "  ${GREEN}✓${NC} Started PM2 process: phonesdaddy"
  fi
else
  echo -e "  ${YELLOW}ℹ${NC}  PM2 not found."
  echo -e "     → Go to Hostinger → Node.js App Manager → click 'Restart'"
fi

echo ""
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Setup Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo ""
echo -e "  All future uploads and phone images will be saved to:"
echo -e "  ${BOLD}$PERSISTENT_MEDIA${NC}"
echo ""
echo -e "  Git pull and ZIP deployments will NEVER overwrite this folder."
echo ""
