# AWS Lightsail progressive deployment

Flujo recomendado para despliegue progresivo en Lightsail Container Service.

## 0) Configurar variables
1. Copia `scripts/lightsail/.env.example` a `scripts/lightsail/.env`.
2. Completa credenciales/variables obligatorias.
3. Usa el mismo valor para `ADMIN_API_TOKEN` y `VITE_ADMIN_API_TOKEN`.

## 1) Checklist + release metadata
```bash
scripts/lightsail/00-prep-checklist.sh
```

## 2) Build local image
```bash
scripts/lightsail/10-build-image.sh
```

## 3) Crear servicio (si no existe)
```bash
scripts/lightsail/20-create-service.sh
```

## 4) Publicar imagen en Lightsail registry
```bash
scripts/lightsail/30-push-image.sh
```

## 5) Desplegar staging
```bash
scripts/lightsail/40-deploy-staging.sh
```

## 6) Smoke tests
```bash
scripts/lightsail/50-smoke-tests.sh
```

## Uploads local temporal (seed inicial)
Si necesitas migrar uploads existentes al primer build:
```bash
scripts/lightsail/35-seed-uploads.sh /ruta/de/uploads
```
Luego vuelve a construir imagen y publica de nuevo.

## Rollback
Con una imagen previa de Lightsail:
```bash
IMAGE=service.label.version scripts/lightsail/70-rollback.sh
```

## DNS cutover
Sigue `scripts/lightsail/CUTOVER_CHECKLIST.md`.

## Fase 2 (S3)
Plan de persistencia real en `scripts/lightsail/PHASE2_S3_PLAN.md`.
