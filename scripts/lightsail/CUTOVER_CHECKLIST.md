# Cutover checklist (DNS)

## Antes del cutover
- Servicio Lightsail en estado `RUNNING`.
- `scripts/lightsail/50-smoke-tests.sh` exitoso.
- TTL del subdominio reducido (ej. 60-300s) al menos 30 min antes.
- Servidor antiguo activo para fallback.

## Cutover
1. Apuntar `bloodhound.tu-dominio.com` al endpoint público de Lightsail.
2. Verificar:
   - `https://bloodhound.tu-dominio.com/api/health`
   - Login admin y jugador
   - Flujo quiz (acierto/fallo)
   - Ranking + export
   - Upload y lectura de imagen

## Post-cutover (30-60 min)
- Revisar logs/errores del servicio.
- Confirmar sin reinicios inesperados.
- Mantener servidor viejo sin cambios (standby) durante al menos 24h.

## Rollback rápido
1. Revertir DNS al origen anterior.
2. O redeploy de imagen anterior con:
   - `IMAGE=service.label.version scripts/lightsail/70-rollback.sh`
