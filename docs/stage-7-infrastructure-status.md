# Stage 7 — Infrastructure Provisioning Status

**Checked:** 2026-11-17  
**Status:** Free-tier shared database provisioned; application route integration and acceptance tests in progress.

## Completed

- Stage 7.1 architecture, logical schema, security/permissions, and migration/rollback specifications are merged.
- Stage 7.2 platform identity, verified-host tenant resolution, tenant/branch authorization primitives, append-only audit writer, and foundation tests are merged.
- The approved free-tier architecture is merged: one shared physical Appwrite database now, with a tenant storage placement abstraction for future dedicated databases.
- Thirteen private platform/configuration tables have been provisioned in the existing `bella_roses` database with row security enabled and no table-level permissions.
- Existing Bella Roses records were backfilled with tenant and branch ownership fields.
- Vercel Production, Preview and Development platform environment variables were configured for the shared database and Platform Owner allowlist.
- Vercel reports `bella-roses.bade3.com` as verified; the domain registry is active.
- GitHub Quality checks and Vercel preview build passed for the shared database integration branch before the latest route-scoping changes.

## Live Appwrite state

- Appwrite project: `6afac57c0019b2ee5fa0`
- Physical database: `bella_roses` (enabled, ready)
- Existing storage bucket: `menu_images`
- Existing staff Team: `bella-roses-staff`
- No paid plan or additional Appwrite database/project was created.

## Live schema

See `docs/bade3-free-tier-live-schema.md` for the verified inventory, seed rows, ownership backfill counts and indexes.

## Remaining acceptance gates

1. Finish tenant scoping for every tenant-owned admin route and staff invitation lifecycle.
2. Add end-to-end tests for cross-tenant reads/writes, branch mismatch, inactive membership, suspended tenant and unverified domain.
3. Verify the Platform Owner tenant-list API against an authenticated session and confirm audit rows are persisted.
4. Verify production smoke tests for menu, QR resolution, order placement, order tracking, staff dashboard, archive and reports.
5. Do not onboard a second live tenant until every gate above passes.

## Safety

No paid upgrade was performed. Existing customer records and legacy tables were preserved; schema changes are additive. The existing Bella Roses production routes must remain available while tenant-scoped route integration is completed. Dedicated per-tenant databases remain a future subscription capability, not a current requirement.
