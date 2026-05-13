#!/usr/bin/env bash
set -euo pipefail

if [[ -f "scripts/lightsail/.env" ]]; then
  # shellcheck disable=SC1091
  source "scripts/lightsail/.env"
fi

: "${AWS_REGION:=us-east-1}"
: "${SERVICE_NAME:=bloodhound-prod}"

AWS_ARGS=(--region "$AWS_REGION")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

SERVICE_URL="$(aws lightsail get-container-services "${AWS_ARGS[@]}" \
  --service-name "$SERVICE_NAME" \
  --query "containerServices[0].url" \
  --output text)"

if [[ -z "$SERVICE_URL" || "$SERVICE_URL" == "None" ]]; then
  echo "ERROR: no se pudo obtener URL del servicio ${SERVICE_NAME}"
  exit 1
fi

echo "==> Smoke tests on ${SERVICE_URL}"
curl -fsS "${SERVICE_URL}/api/health" && echo
curl -fsSI "${SERVICE_URL}/" >/dev/null
echo "OK: health y root responden."
