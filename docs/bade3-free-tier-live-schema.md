# bade3 Free-Tier Live Schema — 2026-11-17

## Physical deployment

- Appwrite project: `6afac57c0019b2ee5fa0`
- Physical TablesDB database: `bella_roses`
- Appwrite plan: existing free tier; no upgrade or additional project/database purchased.
- Database remains enabled and ready.
- Existing `menu_images` bucket is unchanged.
- No existing production table or row was deleted.

The database name remains `bella_roses` for compatibility with the live application. This is a physical storage identifier only; the product remains bade3 and Bella Roses is the first tenant.

## New private platform tables created

All thirteen tables were created inside `bella_roses` with `rowSecurity=true` and empty table-level permissions:

| Table | Purpose |
|---|---|
| `platform_admins` | Platform Owner identity registry |
| `tenants` | Company directory |
| `tenant_domains` | Domain verification and activation lifecycle |
| `tenant_members` | Tenant membership and roles |
| `branches` | Tenant branch directory |
| `plans` | Plan and feature entitlements |
| `subscriptions` | Tenant plan assignment (payment gateway deferred) |
| `tenant_storage_placements` | Shared/dedicated future storage placement |
| `audit_events` | Append-only platform audit events |
| `tenant_settings` | Tenant-owned operational settings |
| `tenant_branding` | White-label identity and theme configuration |
| `branch_staff_access` | Branch-level staff membership and roles |
| `branding_assets` | Tenant-owned asset metadata |

Verified indexes are available for tenant slug, normalized domain, tenant membership, branch code, plan code, subscription tenant/status, tenant storage placement, platform admin identity, audit tenant/time, tenant settings, tenant branding, branch staff access, and tenant-scoped table/order number uniqueness.

## First tenant seed

- Tenant row: `bella-roses` — Bella Roses — active.
- Plan row: `free` — Free — active, one branch limit.
- Subscription: `bella-roses-free` — active free plan.
- Branch: `bella-main` — Main Branch — active/default.
- Storage placement: `shared`, database `bella_roses`.
- Tenant owner membership, branch owner access and platform admin registry row were seeded for the existing configured admin identity.
- Tenant settings and initial Bella Roses branding records were seeded; `Powered by bade3` is recorded as non-removable.
- Primary domain `bella-roses.bade3.com` is verified by Vercel and is now active in the tenant domain registry.

## Legacy tenant ownership migration

Nullable ownership columns were added to existing operational tables:
- `categories.tenant_id`
- `products.tenant_id`
- `restaurant_tables.tenant_id`, `restaurant_tables.branch_id`
- `orders.tenant_id`, `orders.branch_id`
- `order_items.tenant_id`, `order_items.branch_id`

The existing records were backfilled without changing business fields:
- categories: 2 rows
- products: 3 rows
- restaurant_tables: 1 row
- orders: 10 rows
- order_items: 14 rows

All these existing rows now belong to tenant `bella-roses`; branch-owned records belong to `bella-main`. Counts were verified before the migration and row updates were individually accepted by Appwrite. Successful schema provisioning events were written to the private audit ledger.

Tenant-scoped indexes are available on all five operational tables.

## Important safety boundary

This schema work does **not** enable multi-tenant routing. Existing legacy customer APIs still need route-by-route changes to inject the server-resolved tenant ID into reads and writes, verify branch ownership and validate related records. Do not onboard a second live tenant until those changes and cross-tenant integration tests are complete.

The primary domain is verified and active. Vercel Production, Preview and Development now have `BADE3_CORE_DATABASE_ID=bella_roses`, `BADE3_PLATFORM_OWNER_USER_IDS` set to the existing Platform Owner Appwrite user ID, and `BADE3_AUDIT_EVENTS_TABLE_ID=audit_events`. These settings are server-side; the owner allowlist is stored as a sensitive environment variable.

## Rollback posture

All changes were additive:
- new tables can remain unused without affecting existing routes;
- new ownership columns are nullable;
- legacy business fields and row IDs were preserved;
- existing data records were not deleted or rewritten except for adding `tenant_id` and `branch_id`.

Do not drop tables or columns as a rollback. Disable new integration code and leave the additive schema in place until a separately reviewed cleanup.
