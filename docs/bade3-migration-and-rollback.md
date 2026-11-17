# bade3 7.1 — Migration, Backup, and Rollback Plan

**Status:** Approved plan; no migration has been executed  
**Initial tenant:** Bella Roses  
**Legacy database:** `bella_roses`  
**Proposed target database:** `bade3_core`

## 1. Objectives

Migrate the existing Bella Roses application into the bade3 multi-tenant architecture without losing historical records, breaking active operations, or weakening authorization.

The migration must be additive, staged, observable, and reversible.

The existing `bella_roses` database remains the legacy source until an explicit production migration is approved.

## 2. Phase 0 — Read-only inventory

Before changing production:
- Inspect current repository code and schema documentation.
- Inspect actual Appwrite database and table definitions.
- Inspect attributes, indexes, permissions, and row counts.
- Inventory Storage files and references.
- Identify current owner/admin identities.
- Inspect environment variables and deployment configuration without exposing secrets.
- Identify active production dependencies and routes.
- Record a baseline for orders and operational data.

This phase is read-only. Do not create, modify, or delete production resources.

## 3. Phase 1 — Platform foundation

After separate approval:
- Create the target platform database.
- Create platform core tables.
- Create tenant and membership foundations.
- Create initial plan and feature definitions.
- Establish platform owner identity and recovery.
- Validate platform access independently from tenant access.

The proposed database identifier is `bade3_core`; availability and naming must be checked before provisioning.

## 4. Phase 2 — Initial tenant

Create the Bella Roses tenant record:
- Create the default branch.
- Assign an initial subscription.
- Configure tenant settings.
- Configure tenant branding.
- Map existing owner and staff identities.
- Preserve existing identifiers where possible.

Do not assume that repository documentation proves current production data or user membership. Inspect actual Appwrite state first.

## 5. Phase 3 — Legacy data mapping

Map existing records:
- `categories`
- `products`
- `restaurant_tables`
- `orders`
- `order_items`
- `restaurant_settings`
- Storage assets and file references

Add tenant ownership and branch ownership where applicable.

Preserve order snapshots, historical references, original IDs where possible, and the existing order lifecycle semantics.

## 6. Phase 4 — Server context refactor

- Introduce trusted tenant resolution.
- Introduce branch resolution.
- Update server-side data access.
- Enforce tenant and branch authorization.
- Enforce subscription entitlements.
- Add audit events for privileged operations.
- Update public menu and QR routes.
- Add idempotency to critical write workflows.

Do not rely on client-side filtering for isolation.

## 7. Phase 5 — Validation

Required test suites:
- Tenant isolation.
- Branch isolation.
- Role and permission matrix.
- Public endpoint security.
- Order lifecycle and duplicate submission.
- Inventory consistency and idempotency.
- Domain resolution and ownership.
- Subscription limits.
- Legacy compatibility.
- Backup restoration.
- Rollback rehearsal.

## 8. Phase 6 — Controlled production rollout

Only after approval:
1. Verify backups.
2. Apply additive schema changes.
3. Run migration in controlled batches.
4. Record checkpoints and row counts.
5. Validate parent-child relationships and tenant/branch ownership.
6. Run smoke tests.
7. Enable tenant-aware routing.
8. Monitor errors, latency, and access logs.
9. Keep the previous stable deployment and rollback path available.

Do not perform destructive legacy cleanup during the initial rollout.

## 9. Data reconciliation

For every migrated table:
- Record source row count.
- Record destination row count.
- Compare stable identifiers.
- Validate required fields.
- Validate tenant ownership.
- Validate branch ownership.
- Validate parent references.
- Validate timestamps and monetary values.
- Record rejected or quarantined rows with reasons.

Migration must stop if unexplained discrepancies occur.

## 10. Backup and recovery

Proposed initial operational targets:
- RPO: 24 hours or better.
- RTO: 8 hours or better.

These are design targets, not guarantees. Validate them against actual Appwrite backup/export capabilities, retention, storage recovery, and operational procedures.

Required:
- Pre-migration backup.
- Database export or supported backup.
- Storage inventory and recovery plan.
- Backup integrity verification.
- Restore rehearsal.
- Documented recovery owner.
- Audit of restore operations.

## 11. Rollback strategy

### Application rollback
- Restore the previous stable deployment.
- Disable tenant-aware routing if required.
- Preserve records written after migration.
- Verify compatibility before running old code against changed schemas.

### Schema rollback
- Prefer disabling new functionality over deleting new tables.
- Keep legacy fields during transition.
- Do not drop legacy tables during the initial rollout.
- Avoid destructive schema changes until a separate cleanup approval.

### Data rollback
- Use migration markers and checkpoints.
- Preserve original identifiers.
- Reconcile source and destination counts.
- Use compensating transactions for inventory and financial operations.
- Never silently discard legitimate post-migration activity.
- Prevent duplicate orders and duplicate inventory deductions.

A rollback must be rehearsed in a non-production environment before the production migration.

## 12. Stop conditions

Stop the migration and preserve the current stable system if:
- Backup verification fails.
- Source inventory is incomplete.
- Tenant ownership cannot be established confidently.
- Parent-child relationships are inconsistent.
- Row counts differ without explanation.
- Authorization tests fail.
- Critical order or inventory workflows fail.
- Rollback readiness cannot be demonstrated.

## 13. Approval boundaries

This document does not authorize:
- Appwrite database or table creation.
- Production schema changes.
- Production data migration.
- Appwrite permission changes.
- Team creation or membership changes.
- Vercel domain or environment changes.
- Production deployment.
- Legacy data deletion.

Each production-impacting phase requires separate explicit approval after its plan, risks, and rollback path are reviewed.
