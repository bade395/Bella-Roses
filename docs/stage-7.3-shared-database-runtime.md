# Stage 7.3 — Shared Database Runtime Foundation

## Binding deployment decision

The current deployment remains on the existing Appwrite free plan and uses the single physical TablesDB database:

- Appwrite project: the existing bade3/Bella Roses project
- Database ID: `bella_roses`
- Platform product identity: `bade3`
- First tenant: Bella Roses

No second database, paid plan, or paid resource is required or provisioned in this stage.

The earlier `bade3_core` identifier is a logical platform domain only. It is not a physical database to create now. This decision supersedes any earlier wording that described it as the target physical database.

## Logical separation inside one physical database

Platform control-plane tables and tenant operational tables coexist in `bella_roses`, with ownership enforced by server code and table conventions. Tenant-owned rows use server-assigned `tenant_id`; branch-owned rows use validated `branch_id`.

The live database was inspected before this code change. It currently reports 19 tables. The `audit_events` table exists and has the columns expected by the audit writer; its `metadata` column is Appwrite `text`, so the application serializes safe metadata to JSON text before writing.

The existing database also contains tenant/branch-related schema additions. This inspection does not imply that every existing route is tenant-safe or that multiple tenants can be activated.

## Runtime placement contract

`src/lib/bade3/tenant-storage-placement.ts` defines the storage-placement boundary:

- Default mode: `shared`, database `bella_roses`.
- A server-only directory may later return a `dedicated` placement per tenant.
- Browser-supplied project/database identifiers are never accepted.
- Business services should consume the resolved placement rather than hard-code physical database IDs.

The directory interface is a future integration seam, not a claim that paid dedicated databases or a placement registry are already provisioned.

## Audit behavior

`writePlatformAuditEvent` now defaults to the shared database and existing `audit_events` table. Optional server-side overrides are `BADE3_AUDIT_DATABASE_ID` and `BADE3_AUDIT_EVENTS_TABLE_ID`. It requires the server API key and fails closed if persistence fails.

## Safety gates before onboarding a second live tenant

1. Wire the verified tenant resolver and authorization checks into every tenant-facing route and server action.
2. Ensure every tenant-owned query includes server-derived tenant scope.
3. Validate branch ownership, parent-child tenant equality, membership, tenant status and entitlements.
4. Confirm audit writes and privileged-read auditing with integration tests.
5. Verify all legacy Bella Roses rows are assigned to the correct tenant before enabling tenant scoping; never infer ownership or bulk-assign without a reviewed mapping.
6. Test backup and restore, cross-tenant denial, public menu allowlists, and QR tenant binding.

No production row migration, destructive schema change, plan upgrade, or second database creation is part of this stage.

## Future dedicated database migration

When a customer purchases the applicable plan and the platform owner approves the move: provision destination, back up, copy stable IDs and relationships, validate row counts/indexes/permissions, control writes during catch-up, switch the server-side placement registry, smoke-test, and retain rollback until acceptance. Source data is not deleted before explicit sign-off.
