# Fase 2: mover uploads de local temporal a S3

## Por qué
En Lightsail Container Service el filesystem del contenedor no es persistente ante redeploy/recreate. El modo local es temporal.

## Objetivo
- Guardar nuevos uploads en S3.
- Servir URLs estables de S3/CloudFront.
- Migrar archivos históricos sin romper referencias.

## Pasos sugeridos
1. Crear bucket S3 dedicado (ej. `bloodhound-uploads-prod`) y política mínima.
2. Crear IAM user/role con permisos de escritura/lectura acotados al bucket/prefix.
3. Añadir variables de entorno:
   - `S3_BUCKET`
   - `S3_REGION`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_BASE_URL` (opcional, para CloudFront)
4. Implementar storage adapter:
   - `local` (actual)
   - `s3` (nuevo)
   - toggle por env `UPLOADS_BACKEND=s3|local`.
5. Script de migración:
   - subir `/app/uploads/*` a S3
   - registrar mapa de rutas si cambia la URL pública.
6. Validación:
   - subir imagen nueva
   - visualizar imagen histórica
   - redeploy y verificar persistencia.

## Criterio de cierre
- Ningún upload depende de filesystem local para persistencia.
