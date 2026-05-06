#!/usr/bin/env bash
set -euo pipefail

# One-command production deploy for Bloodhound.
# Defaults can be overridden, e.g.:
# BRANCH=main APP_NAME=bloodhound ./deploy.sh

APP_DIR="${APP_DIR:-/var/www/bloodhound}"
BRANCH="${BRANCH:-noreplit}"
APP_NAME="${APP_NAME:-bloodhound}"
API_PORT="${API_PORT:-5005}"
UI_BASE_PATH="${UI_BASE_PATH:-/bloodhound}"

echo "==> Deploy config"
echo "APP_DIR=$APP_DIR"
echo "BRANCH=$BRANCH"
echo "APP_NAME=$APP_NAME"
echo "API_PORT=$API_PORT"
echo "UI_BASE_PATH=$UI_BASE_PATH"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: $APP_DIR is not a git repository"
  exit 1
fi

cd "$APP_DIR"

echo "==> Fetching latest code"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm install

echo "==> Building frontend/backend"
VITE_BASE_PATH="$UI_BASE_PATH" npm run build

echo "==> Restarting PM2 app"
pm2 restart "$APP_NAME" --update-env

echo "==> Waiting 2s before health check"
sleep 2

echo "==> Local health check"
curl -fsS "http://127.0.0.1:${API_PORT}/api/health"
echo

echo "==> Done"
echo "Tip: open ${UI_BASE_PATH}/admin in your domain to validate admin UI."
