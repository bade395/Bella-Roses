# bade3 Free-Tier Multi-Tenant Architecture

**Decision:** Keep the current Appwrite project on its existing free plan. No additional paid database, project, or subscription is required for the current launch.

## 1. Current deployment model

Use one Appwrite TablesDB database named `bella_roses` as the initial shared application database for bade3 and its tenants. This is a deliberate cost-conscious deployment choice, not a change to the product identity: bade3 remains the SaaS platform and Bella Roses is its first tenant.

Every tenant-owned row must include a server-controlled `tenant_id`. Branch-owned rows must also include `branch_id` where applicable. Never accept either value as an authorization fact from the browser.

## 2. Logical platform and tenant domains

Keep platform control-plane records logically distinct from tenant operational records, even while they share one physical database.

Platform-owned logical entities:
- platform administrators and owner identity mapping
- tenants and tenant lifecycle status
- plans, entitlements, subscription status and usage limits
- verified custom domains and domain ownership
- tenant database placement / deployment registry
- privileged access and immutable-by-policy audit events

Tenant-owned logical entities:
- branches and memberships
- staff role assignments
- catalog, categories and products
- restaurant tables, QR tokens, orders and order items
- inventory, stock movements and suppliers
- KDS, promotions, loyalty and analytics

Use explicit collection/table naming conventions and schema ownership metadata to prevent accidental coupling. Do not introduce a separate physical database identifier until the current free-plan capacity or isolation needs justify it.

## 3. Mandatory tenant isolation

- Resolve tenant from a verified active host/domain using server-side directory data.
- Resolve staff identity independently from platform identity.
- Every read, list, create, update and delete is scoped to the authenticated tenant on the server.
- For child records, verify that parent and child have the same tenant and expected branch.
- Verify membership status, role, branch assignment, tenant status and subscription entitlements server-side.
- Deny access by default if tenant context is missing, ambiguous, suspended or unverified.
- Do not use client-provided tenant_id, branch_id, role, plan or subscription status as trusted claims.
- Use Appwrite permissions as an additional defense, never as a replacement for server-side tenant authorization.
- Public menu APIs expose only allowlisted fields and only for the resolved active tenant.
- Platform Owner support access is explicit, least-privilege, time-bounded where practical, and audit logged.

## 4. Future per-tenant database placement

Design a database placement abstraction now:

`TenantStoragePlacement` maps each tenant to a storage mode and physical Appwrite project/database identifiers. Initial mode is `shared`; future mode may be `dedicated`.

Application services must request a tenant-scoped repository/context rather than hard-code database IDs in business logic. The placement registry itself is platform-owned and server-only.

Future migration to dedicated storage must:
1. Provision destination database/project and schema.
2. Back up source and record a migration checkpoint.
3. Copy tenant rows with stable IDs and preserve relationships.
4. Validate counts, references, indexes, permissions and representative reads.
5. Pause writes or use a controlled dual-write/catch-up window.
6. Switch the placement registry atomically at the application layer.
7. Run smoke tests and monitor.
8. Retain rollback path until acceptance; never delete source data before sign-off.

No per-tenant dedicated database is provisioned in the current free-tier phase.

## 5. Resource limits and free-tier operation

- Track database storage, rows, file storage, bandwidth and function/API usage against the actual Appwrite plan limits.
- Enforce tenant quotas and product plan entitlements in application logic.
- Add pagination, bounded queries, indexes, retention policies and image optimization.
- Avoid background jobs or realtime subscriptions that scale without limits.
- Surface platform alerts before resource exhaustion; do not silently drop customer writes.
- Re-evaluate dedicated storage only when a customer plan is sold, compliance/isolation requires it, or shared-resource limits are reached.

## 6. Security and operational acceptance gates

Before enabling multiple live tenants:
- All tenant-facing routes and server actions use centralized tenant authorization.
- No legacy route can read or mutate another tenant's records.
- Tests cover cross-tenant list/read/update/delete, branch mismatch, inactive membership, suspended tenant, unverified domain and missing tenant context.
- Audit events are persisted for platform privileged access and sensitive administration.
- Backups and a tested restore procedure exist for the shared database.
- Public APIs and QR flows cannot override tenant identity.
- Production secrets remain server-only.

## 7. Relationship to current implementation

The existing `bade3_core` proposal is logical separation, not a mandatory separate physical database in the free-tier phase. The Stage 7.2 platform identity, tenant context, authorization and audit primitives remain the foundation. Before claiming full multi-tenant readiness, implement and test their Appwrite adapters and integrate them into every relevant route.

The existing `bella_roses` schema and records must be inspected and backed up before any additive schema changes. No destructive schema changes or data migration are authorized by this document.

## 8. Decision record

- Current cost: remain on Appwrite free tier.
- Current physical layout: one shared Appwrite TablesDB database.
- Isolation: strict server-side tenant and branch isolation.
- Future scale: placement abstraction supports dedicated per-tenant databases/projects.
- Payment provider: deferred.
- Existing Bella Roses production data: preserve and migrate only through a reviewed, reversible plan.
