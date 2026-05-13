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
: "${POWER:=micro}"
: "${SCALE:=1}"

AWS_ARGS=(--region "$AWS_REGION")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

if aws lightsail get-container-services "${AWS_ARGS[@]}" --service-name "$SERVICE_NAME" >/dev/null 2>&1; then
  echo "INFO: el servicio ${SERVICE_NAME} ya existe."
  exit 0
fi

echo "==> Creating Lightsail container service ${SERVICE_NAME}"
aws lightsail create-container-service \
  "${AWS_ARGS[@]}" \
  --service-name "$SERVICE_NAME" \
  --power "$POWER" \
  --scale "$SCALE"

echo "OK: servicio creado."
