#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "scripts/lightsail/.env" ]]; then
  # shellcheck disable=SC1091
  source "scripts/lightsail/.env"
fi

# Claves S3 del .env son para el contenedor. Quitarlas del entorno para que "aws" use ~/.aws / AWS_PROFILE.
CONTAINER_AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
CONTAINER_AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

: "${AWS_REGION:=us-east-1}"
: "${SERVICE_NAME:=bloodhound-prod}"
: "${CONTAINER_NAME:=app}"
: "${CONTAINER_PORT:=5000}"
: "${NODE_ENV:=production}"
: "${PORT:=5000}"
: "${UI_BASE_PATH:=/}"
: "${UPLOADS_DIR:=/app/uploads}"
: "${DEFAULT_CAMPAIGN_SLUG:=default}"
: "${DATABASE_URL:?Define DATABASE_URL en scripts/lightsail/.env o entorno}"
: "${ADMIN_API_TOKEN:?Define ADMIN_API_TOKEN en scripts/lightsail/.env o entorno}"
: "${QUIZ_CHALLENGE_SECRET:?Define QUIZ_CHALLENGE_SECRET en scripts/lightsail/.env o entorno}"
: "${UPLOADS_BACKEND:=local}"
: "${S3_BUCKET:=}"
: "${S3_REGION:=}"
: "${S3_PREFIX:=bloodhound}"
: "${S3_PUBLIC_BASE_URL:=}"

AWS_ARGS=(--region "$AWS_REGION")
if [[ -n "${AWS_PROFILE:-}" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

IMAGE="${IMAGE:-}"
if [[ -z "$IMAGE" ]]; then
  IMAGE="$(aws lightsail get-container-images "${AWS_ARGS[@]}" \
    --service-name "$SERVICE_NAME" \
    --query "sort_by(containerImages,&createdAt)[-1].image" \
    --output text)"
fi

if [[ -z "$IMAGE" || "$IMAGE" == "None" ]]; then
  echo "ERROR: no se encontró imagen en Lightsail para ${SERVICE_NAME}."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
CONTAINERS_JSON="${TMP_DIR}/containers.json"
PUBLIC_JSON="${TMP_DIR}/public-endpoint.json"

cat > "$CONTAINERS_JSON" <<EOF
{
  "${CONTAINER_NAME}": {
    "image": "${IMAGE}",
    "ports": { "${CONTAINER_PORT}": "HTTP" },
    "environment": {
      "NODE_ENV": "${NODE_ENV}",
      "PORT": "${PORT}",
      "UI_BASE_PATH": "${UI_BASE_PATH}",
      "UPLOADS_DIR": "${UPLOADS_DIR}",
      "DEFAULT_CAMPAIGN_SLUG": "${DEFAULT_CAMPAIGN_SLUG}",
      "DATABASE_URL": "${DATABASE_URL}",
      "ADMIN_API_TOKEN": "${ADMIN_API_TOKEN}",
      "QUIZ_CHALLENGE_SECRET": "${QUIZ_CHALLENGE_SECRET}",
      "UPLOADS_BACKEND": "${UPLOADS_BACKEND}",
      "S3_BUCKET": "${S3_BUCKET}",
      "S3_REGION": "${S3_REGION}",
      "S3_PREFIX": "${S3_PREFIX}",
      "S3_PUBLIC_BASE_URL": "${S3_PUBLIC_BASE_URL}",
      "AWS_ACCESS_KEY_ID": "${CONTAINER_AWS_ACCESS_KEY_ID}",
      "AWS_SECRET_ACCESS_KEY": "${CONTAINER_AWS_SECRET_ACCESS_KEY}"
    }
  }
}
EOF

cat > "$PUBLIC_JSON" <<EOF
{
  "containerName": "${CONTAINER_NAME}",
  "containerPort": ${CONTAINER_PORT},
  "healthCheck": {
    "path": "/api/health",
    "successCodes": "200-499",
    "intervalSeconds": 10,
    "timeoutSeconds": 5,
    "healthyThreshold": 2,
    "unhealthyThreshold": 2
  }
}
EOF

echo "==> Deploying image ${IMAGE} to service ${SERVICE_NAME}"
aws lightsail create-container-service-deployment \
  "${AWS_ARGS[@]}" \
  --service-name "$SERVICE_NAME" \
  --containers "file://${CONTAINERS_JSON}" \
  --public-endpoint "file://${PUBLIC_JSON}"

echo "OK: despliegue enviado."
