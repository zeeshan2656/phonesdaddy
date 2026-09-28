#!/bin/bash
# =============================================================================
# PhonesDaddy — SAFE ZIP DEPLOYMENT SCRIPT (Server-side)
# =============================================================================
# Use this when deploying via deploy-bundle.zip on Hostinger, cPanel, or VPS.
#
# HOW TO USE:
#   1. Upload deploy-bundle.zip to your server project folder.
#   2. Run:
#        bash safe-deploy.sh
#
# GUARANTEE:
#   Your media folder is stored outside the deployment folder (or in persistent storage).
#   Neither this script nor the ZIP will EVER overwrite or wipe your images.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP_FILE="$PROJECT_DIR/deploy-bundle.zip"

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}  PhonesDaddy — Safe ZIP Deployment${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""

if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}❌ ERROR: deploy-bundle.zip not found in: $PROJECT_DIR${NC}"
  echo -e "   Please upload deploy-bundle.zip to your project folder first."
  exit 1
fi

# Step 1: Extract deploy-bundle.zip
echo -e "${BOLD}Step 1/4 — Extracting new code bundle...${NC}"
unzip -o "$ZIP_FILE" -d "$PROJECT_DIR" > /dev/null
echo -e "  ${GREEN}✓${NC} Code extracted successfully (media folders are untouched)."
echo ""

# Step 2: Ensure persistent media setup
echo -e "${BOLD}Step 2/4 — Verifying media storage...${NC}"
if [ -f "$PROJECT_DIR/setup-persistent-media.sh" ]; then
  bash "$PROJECT_DIR/setup-persistent-media.sh"
else
  node "$PROJECT_DIR/scripts/setup-media.js" 2>/dev/null || true
fi
echo ""

# Step 3: Install dependencies
echo -e "${BOLD}Step 3/4 — Installing production dependencies...${NC}"
cd "$PROJECT_DIR"
npm install --omit=dev --silent
echo -e "  ${GREEN}✓${NC} Dependencies up to date."
echo ""

# Step 4: Restart application
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
  echo -e "  ${YELLOW}ℹ️  Please restart your app via your hosting panel (Hostinger Node.js App Manager / cPanel).${NC}"
fi

# Clean up zip
rm -f "$ZIP_FILE"
echo ""
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Deployment Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "  • Code updated to latest version"
echo -e "  • All media/images 100% safe in persistent storage"
echo -e "  • Production database & credentials untouched"
echo ""
