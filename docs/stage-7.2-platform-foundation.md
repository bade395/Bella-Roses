# Stage 7.2 — Platform Foundation Implementation

**Branch:** `feat/bade3-stage-7-platform-foundation`  
**Status:** Implementation candidate; review and deployment pending  
**Base:** Approved bade3 7.1 specification

## Delivered in this change

- Separate Platform Owner identity sourced only from the server-side `BADE3_PLATFORM_OWNER_USER_IDS` allowlist. Tenant Teams and tenant roles do not grant platform privileges.
- Hostname normalization and tenant resolution contract that accepts only active, verified domain mappings and active tenants.
- Reusable tenant membership, role, branch ownership, and parent-child tenant checks.
- Append-only platform audit writer. Sensitive metadata keys are filtered; missing audit configuration or failed writes throw instead of silently succeeding.
- Unit tests for hostname validation, domain verification, suspended tenants, tenant/branch isolation, membership status, and role checks.

## Required deployment configuration

- `BADE3_PLATFORM_OWNER_USER_IDS`: comma-separated Appwrite user IDs for Platform Owner accounts.
- `BADE3_CORE_DATABASE_ID`: defaults to `bade3_core`.
- `BADE3_AUDIT_EVENTS_TABLE_ID`: defaults to `audit_events`.
- Existing server-only `APPWRITE_API_KEY`, `APPWRITE_ENDPOINT`, and `APPWRITE_PROJECT_ID`.

Do not place any of these server-only values behind a `NEXT_PUBLIC_` prefix.

## Important integration boundary

The live Appwrite project was inspected before implementation. It currently exposes the legacy `bella_roses` database and `menu_images` bucket; no `bade3_core` database or platform tables were confirmed. Therefore this PR deliberately does **not** write to, create, rename, or migrate production Appwrite resources.

The new tenant resolver is a typed server-side contract. A production Appwrite directory adapter and platform API routes must be connected only after the `bade3_core` database, verified-domain indexes, and platform tables have been provisioned and checked. Until then, existing Bella Roses routes remain legacy single-tenant routes and must not be represented as multi-tenant isolated.

## Acceptance gates before Stage 8

1. Configure and verify the Platform Owner allowlist.
2. Provision and inspect `bade3_core` and its minimum platform tables in a controlled environment.
3. Implement the Appwrite `TenantDirectory` adapter with server-side exact-match queries.
4. Wire tenant context into every tenant-owned API route before enabling a second tenant.
5. Add platform audit writes to each privileged read/write entry point.
6. Run cross-tenant and branch-isolation integration tests against the provisioned schema.
7. Verify Vercel preview deployment and perform a production-read-only smoke test.
8. Keep Bella Roses legacy data untouched until a separately tested migration plan is approved.

## Explicit non-goals

This PR does not enable self-service signup, billing, custom-domain activation, production tenant switching, production data migration, or multi-tenant access on the existing legacy APIs. These require the platform tables and route-by-route integration above.
