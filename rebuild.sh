#!/usr/bin/env bash
set -euo pipefail

# --- Config ---
PROJECT_NAME="kneep"

echo ">>> Pulling latest changes..."
git pull

echo ">>> Cleaning old build..."
rm -rf node_modules dist

echo ">>> Installing dependencies..."
npm ci

echo ">>> Auditing packages..."
npm audit fix || true   # allow audit to fail without aborting

echo ">>> Building frontend..."
npm run build

echo ">>> Stopping and removing existing containers..."
docker compose -p "$PROJECT_NAME" down

echo ">>> Rebuilding Docker images..."
docker compose build --no-cache

echo ">>> Starting stack..."
docker compose -p "$PROJECT_NAME" up -d

echo ">>> Checking that build output exists..."
ls -lh dist || echo "⚠️  dist folder missing — build may have failed."

echo "✅ Rebuild complete."

