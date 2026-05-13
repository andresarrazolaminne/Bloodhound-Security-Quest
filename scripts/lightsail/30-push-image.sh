#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "scripts/lightsail/.env" ]]; then
  # shellcheck disable=SC1091
  source "scripts/lightsail/.env"
fi

: "${AWS_REGION:=us-east-1}"
: "${SERVICE_NAME:=bloodhound-prod}"

TAG="${TAG:-$(git rev-parse --short HEAD)}"
IMAGE_LOCAL="${IMAGE_LOCAL:-bloodhound:${TAG}}"
LABEL="${LABEL:-app}"

AWS_ARGS=(--region "$AWS_REGION")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

echo "==> Pushing image ${IMAGE_LOCAL} to Lightsail as label ${LABEL}"
aws lightsail push-container-image \
  "${AWS_ARGS[@]}" \
  --service-name "$SERVICE_NAME" \
  --label "$LABEL" \
  --image "$IMAGE_LOCAL"

echo "OK: image publicada."
