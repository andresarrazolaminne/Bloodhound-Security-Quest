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
: "${CONTAINER_NAME:=app}"
: "${CONTAINER_PORT:=5000}"
: "${DOMAIN:=bloodhound.example.com}"

command -v docker >/dev/null 2>&1 || { echo "ERROR: docker no esta instalado"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "ERROR: aws cli no esta instalado"; exit 1; }

echo "==> Validando sesion AWS"
if [[ -n "${AWS_PROFILE:-}" ]]; then
  aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null
else
  aws sts get-caller-identity >/dev/null
fi

GIT_SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DATE_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf 'GIT_SHA=%s\n' "${GIT_SHA}" > scripts/lightsail/release-meta.env
printf 'BRANCH=%s\n' "${BRANCH}" >> scripts/lightsail/release-meta.env
printf 'DATE_UTC=%s\n' "${DATE_UTC}" >> scripts/lightsail/release-meta.env
printf 'AWS_REGION=%s\n' "${AWS_REGION}" >> scripts/lightsail/release-meta.env
printf 'SERVICE_NAME=%s\n' "${SERVICE_NAME}" >> scripts/lightsail/release-meta.env
printf 'CONTAINER_NAME=%s\n' "${CONTAINER_NAME}" >> scripts/lightsail/release-meta.env
printf 'CONTAINER_PORT=%s\n' "${CONTAINER_PORT}" >> scripts/lightsail/release-meta.env
printf 'DOMAIN=%s\n' "${DOMAIN}" >> scripts/lightsail/release-meta.env

echo "==> Release metadata"
cat scripts/lightsail/release-meta.env
echo
echo "OK: checklist base completado."
