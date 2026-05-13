#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "scripts/lightsail/.env" ]]; then
  # shellcheck disable=SC1091
  source "scripts/lightsail/.env"
fi

: "${IMAGE:?Debes indicar IMAGE=service.label.version para rollback}"

export IMAGE
exec scripts/lightsail/40-deploy-staging.sh
