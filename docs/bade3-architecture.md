# bade3 7.1 — Platform Architecture

**Status:** Approved design; implementation pending separate approval  
**Product:** bade3  
**Initial tenant:** Bella Roses  
**Architecture:** White-label multi-tenant SaaS  
**Application:** Next.js App Router + TypeScript  
**Backend:** Appwrite Cloud (TablesDB, Auth, Teams, Storage)  
**Hosting:** Vercel

## 1. Purpose

bade3 is a SaaS platform for restaurants, cafés, and hospitality businesses. Each tenant receives an isolated business workspace, its own brand identity, branches, staff, menu, orders, inventory, and optional advanced capabilities.

Bella Roses is the first tenant, not the platform identity.

## 2. Binding architecture decisions

| Decision | Approved design |
|---|---|
| Database | Shared Appwrite database |
| Tenant isolation | Mandatory server-enforced tenant scoping |
| Enterprise expansion | Future option for dedicated databases |
| Support access | Platform Owner may enter tenant workspaces directly |
| Support auditing | Mandatory audit trail for privileged activity |
| Onboarding | Manual and self-service |
| Domain ownership | Centrally controlled by Platform Owner |
| Branding | Independent tenant branding |
| Attribution | Non-removable, visually subordinate “Powered by bade3” |
| Payments | Deferred |

## 3. Logical architecture

```text
                    bade3 Platform
                           |
             +-------------+-------------+
             |                           |
       Platform Admin              Public Onboarding
             |                           |
             +-------------+-------------+
                           |
                  Tenant Resolution
                           |
                 Authentication Layer
                           |
                  Authorization Layer
                           |
                Tenant / Branch Context
                           |
             +-------------+-------------+
             |                           |
        Shared Appwrite              Vercel
        Database & Storage        Next.js Application
             |                           |
             +-------------+-------------+
                           |
                 Tenant Applications
                           |
        +------------------+------------------+
        |                  |                  |
     Bella Roses        Tenant B           Tenant C
```

Core principles:
1. Centralized platform administration.
2. Strict tenant and branch isolation.
3. Server-side authorization.
4. Tenant-specific branding.
5. Auditable privileged operations.
6. Subscription-driven entitlements.
7. Expandable infrastructure without changing public API contracts.

## 4. Shared database and tenant context

The target logical database identifier is `bade3_core`. This is a proposed resource; it is not asserted to exist.

The existing `bella_roses` database remains the legacy source for the initial tenant until an approved migration is executed. Do not rename, delete, or repurpose it during the documentation phase.

Every tenant-owned record must carry `tenant_id`, directly or through a strictly validated parent relationship. Branch-owned operational records must also carry `branch_id`.

The server must resolve tenant context from an authenticated identity or a verified domain mapping. Never trust a browser-supplied `tenant_id`.

The design must allow selected Enterprise tenants to move to dedicated databases in a future phase without changing the public API contract.

## 5. Platform Owner and tenant onboarding

### Platform Owner

The Platform Owner has direct administrative access across tenants. Access must be visibly distinguished from tenant-user access and must retain the actual acting platform identity.

Privileged reads and writes, tenant switching, subscription changes, domain operations, and permission changes must be auditable.

Platform privileges are independent from tenant membership. Tenant administrators cannot grant themselves platform roles.

### Manual onboarding

- Platform Owner creates the tenant.
- Assigns a plan and initial tenant owner.
- Creates the default branch.
- Configures branding and settings.
- Activates the tenant.

### Self-service onboarding

- Business submits registration.
- Platform creates a pending registration.
- Email and required business information are verified.
- Plan eligibility and onboarding policy are evaluated.
- Tenant is activated only after required checks.

Self-service registration must never grant platform privileges or bypass verification, tenant isolation, or subscription policy.

## 6. Domain lifecycle

1. Tenant requests a domain.
2. Platform Owner reviews the request.
3. Platform generates verification instructions.
4. Domain ownership is verified.
5. DNS and deployment configuration are checked.
6. Authorized platform process configures Vercel.
7. HTTPS readiness is confirmed.
8. Platform Owner activates the mapping.
9. Public domain resolution becomes available.

Tenant managers may request domain configuration but cannot approve, activate, transfer, or remove domain mappings.

The resolver must normalize the hostname, require a registered/verified/active mapping, resolve exactly one tenant, and expose only public tenant configuration.

## 7. Branding

Tenants may configure logo, display name, colors, fonts, menu imagery, and supported languages.

The platform retains control of platform identity, security settings, domain activation, subscription enforcement, and technical attribution.

“Powered by bade3” must remain small, elegant, visually subordinate, consistent, and non-removable through tenant settings.

## 8. Product capabilities

The target platform includes:
- Menu and product catalog.
- Branches and staff.
- QR ordering and table sessions.
- Order management and order history.
- Kitchen Display System (KDS).
- Full inventory, recipes, and stock movements.
- Offers, coupons, and redemptions.
- Customers and loyalty.
- Analytics and audit history.
- Multi-language support.
- Subscription and feature-limit management.
- Custom domains.

Payment gateway integration is explicitly deferred.

## 9. Subscription entitlements

Plans may define branch count, staff count, inventory, KDS, analytics, loyalty, custom domain eligibility, advanced branding, and storage/usage limits.

Entitlements must be enforced on the server. Hiding a feature in the UI is not authorization.

## 10. Security invariants

1. Resolve tenant context on the server.
2. Scope every tenant-owned query by tenant.
3. Validate branch ownership and user branch assignment.
4. Validate parent-child ownership on every write.
5. Keep privileged Appwrite API keys server-only.
6. Expose only explicitly public fields from public endpoints.
7. Validate opaque QR tokens server-side.
8. Enforce tenant status and subscription entitlements.
9. Log privileged operations.
10. Never let tenant roles grant platform privileges.

## 11. Appwrite implementation note

Appwrite TablesDB does not provide conventional relational foreign-key enforcement or SQL-style cross-table transactions. Relationships therefore require server-side validation, appropriate indexes, idempotency, and compensating operations for multi-step workflows.

Appwrite Teams may support membership and role assignment, but Team membership alone does not replace tenant and branch authorization.

## 12. Scope boundary

This document describes the approved target architecture only. It does not authorize:
- Creating or modifying Appwrite resources.
- Migrating production data.
- Changing Appwrite permissions or memberships.
- Changing Vercel domains or environment variables.
- Deploying application changes.
- Destructive cleanup of legacy resources.

Each implementation phase requires separate review and explicit approval.
