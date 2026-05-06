# Multitenant Big-Bang Cutover Runbook

## Scope
- Campaign-based multitenancy (`campaign` parent entity).
- Tenant resolution by `campaignSlug`.
- Full data scoping for users, segments, prizes, venues, uploads, config, and rankings.

## Preconditions
- Maintenance window approved.
- Production DB backup verified.
- New backend and frontend artifacts built and ready.
- `ADMIN_API_TOKEN` and `DEFAULT_CAMPAIGN_SLUG` defined in environment.

## Step 1: Backup
1. Create full DB dump.
2. Validate that restore works in a staging sandbox.

## Step 2: Apply DB migration
1. Run `scripts/multitenant-bigbang.sql` in production DB.
2. Verify post-migration:
   - `campaigns` contains `default`.
   - all business tables have non-null `campaign_id`.
   - unique indexes exist:
     - `users_campaign_document_unique`
     - `map_segment_campaign_segment_unique`

## Step 3: Deploy backend/frontend
1. Deploy backend with new tenant middleware and scoped storage.
2. Deploy frontend with campaign-aware routing and API headers.
3. Restart service (`pm2 restart bloodhound --update-env`).

## Step 4: Smoke tests (minimum)
1. Campaign A:
   - login/register/unlock
   - system config read/update
   - admin uploads/list/delete
   - ranking endpoints
2. Campaign B:
   - repeat same checks and verify no data leak from campaign A.
3. Cross-check:
   - same `documentNumber` can exist in two campaigns independently.
   - segment IDs can overlap across campaigns without conflict.

## Step 5: Rollback
If isolation fails:
1. Stop app.
2. Restore DB backup.
3. Redeploy previous stable release.
4. Restart app and re-run health checks.

## Post-cutover checks
- `/api/health` returns 200.
- `/api/system-config` works with campaign context.
- `/api/admin/*` requires `x-admin-auth`.
- Nginx routing remains compatible with `/bloodhound`.
