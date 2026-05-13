#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${1:-}"
DEST="${ROOT_DIR}/docker/uploads-seed"

if [[ -z "$SRC" ]]; then
  echo "Uso: $0 <ruta_uploads_origen>"
  echo "Ejemplo: $0 /mnt/old-server/uploads"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: no existe directorio origen: $SRC"
  exit 1
fi

mkdir -p "$DEST"

echo "==> Seeding uploads from: $SRC"
rsync -av --delete "$SRC"/ "$DEST"/

touch "$DEST/.gitkeep"
echo "OK: uploads seeded in $DEST"
