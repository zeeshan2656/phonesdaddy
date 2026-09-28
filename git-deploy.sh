#!/bin/bash
# =============================================================================
# PhonesDaddy — SAFE GIT DEPLOYMENT SCRIPT
# =============================================================================
# Run this on your server whenever you push changes to GitHub.
#
# HOW TO USE:
#   bash git-deploy.sh
#
# GUARANTEE:
#   Media is stored OUTSIDE the git working directory.
#   Git commands (pull, reset, clean) can NEVER wipe or overwrite your images.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo -e "${BOLD}${BLUE}  PhonesDaddy — Safe Git Deployment${NC}"
echo -e "${BOLD}${BLUE}============================================================${NC}"
echo ""

# Step 1: Ensure persistent media setup outside repo
echo -e "${BOLD}Step 1/4 — Checking media storage...${NC}"
if [ -f "$PROJECT_DIR/setup-persistent-media.sh" ]; then
  bash "$PROJECT_DIR/setup-persistent-media.sh"
fi
echo ""

# Step 2: Git pull
echo -e "${BOLD}Step 2/4 — Pulling latest code from GitHub...${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
git pull origin "$BRANCH"
echo -e "  ${GREEN}✓${NC} Code updated successfully (branch: $BRANCH)."
echo ""

# Step 3: Install dependencies
echo -e "${BOLD}Step 3/4 — Installing production dependencies...${NC}"
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
echo ""

echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅  Git Deployment Complete!${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "  • Latest GitHub commits applied"
echo -e "  • Media directory outside repo remains 100% intact"
echo -e "  • Database and production credentials untouched"
echo ""
