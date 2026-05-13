#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "scripts/lightsail/.env" ]]; then
  # shellcheck disable=SC1091
  source "scripts/lightsail/.env"
fi

TAG="${TAG:-$(git rev-parse --short HEAD)}"
IMAGE_LOCAL="${IMAGE_LOCAL:-bloodhound:${TAG}}"
VITE_BASE_PATH="${VITE_BASE_PATH:-/}"
VITE_ADMIN_API_TOKEN="${VITE_ADMIN_API_TOKEN:-admin123}"

echo "==> Building image ${IMAGE_LOCAL}"
docker build \
  --build-arg "VITE_BASE_PATH=${VITE_BASE_PATH}" \
  --build-arg "VITE_ADMIN_API_TOKEN=${VITE_ADMIN_API_TOKEN}" \
  -t "${IMAGE_LOCAL}" \
  .

echo "OK: image creada -> ${IMAGE_LOCAL}"
