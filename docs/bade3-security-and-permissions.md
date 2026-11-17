# bade3 7.1 — Security and Permissions

**Status:** Approved security design; implementation pending separate approval

## 1. Identity domains

Platform identities and tenant identities are separate authorization domains.

Platform roles:
- `platform_owner`
- `platform_support`

Tenant roles:
- `tenant_owner`
- `tenant_manager`
- `branch_manager`
- `cashier`
- `kitchen`
- `service`
- `customer`

A tenant role can never grant platform privileges.

## 2. Platform Owner access

The approved policy permits the Platform Owner to enter tenant workspaces directly.

The application must:
- Authenticate the platform identity.
- Explicitly identify the active tenant and optional branch context.
- Keep the acting platform identity in request context.
- Visibly distinguish platform access from tenant-user access.
- Record tenant switching and privileged activity.
- Never impersonate the tenant owner or write audit events under the tenant owner's identity.

Sensitive reads and all privileged writes must be logged. Audit records should include actor, target tenant, optional branch, action, resource, outcome, timestamp, and appropriate request metadata.

## 3. Tenant authorization checks

Every protected operation must validate:
1. Authenticated user identity.
2. Active tenant membership or valid platform authority.
3. Tenant status.
4. Requested permission.
5. Branch assignment when applicable.
6. Subscription entitlement.
7. Resource ownership.
8. Allowed operation and lifecycle transition.

Never trust `tenant_id`, `branch_id`, role, or permission claims supplied by the browser.

## 4. Branch authorization

A tenant user does not automatically receive access to every branch.

For every branch-scoped operation:
- Confirm the branch exists.
- Confirm the branch belongs to the resolved tenant.
- Confirm the user has access to that branch or a tenant-wide role.
- Confirm the tenant and branch are active.
- Apply the same scope to reads, writes, exports, and background jobs.

## 5. Appwrite Teams

Appwrite Teams may be used for staff membership and role assignment. Team membership is not, by itself, sufficient authorization for a tenant or branch resource.

The trusted server layer must map the authenticated Appwrite identity to the correct tenant membership and branch assignments.

Invitations that are pending, unconfirmed, expired, or revoked must not grant access.

The existing Bella Roses Team implementation is legacy tenant-specific groundwork. It must not be treated as the final multi-tenant authorization model without an explicit migration and review.

## 6. Tenant isolation invariants

1. Every tenant-owned query is scoped by resolved `tenant_id`.
2. Never accept tenant identity from an untrusted client payload.
3. Validate every parent-child relationship on writes.
4. Validate every branch relationship.
5. Reject cross-tenant resource references.
6. Keep privileged Appwrite API keys server-only.
7. Public menu APIs return only allowlisted public fields.
8. Public QR endpoints validate opaque tokens server-side.
9. Enforce tenant suspension and subscription limits server-side.
10. Log privileged operations and security-relevant failures.

## 7. Storage isolation

Every tenant asset must be associated with its tenant. Private assets require server-side ownership checks. Public assets must be explicitly designated and must not expose private metadata.

Recommended path convention:

`tenants/{tenant_id}/{asset_type}/{file_id}`

## 8. Domain permissions

Tenant managers may request domain setup and view verification instructions.

Only Platform Owner-authorized processes may:
- Approve domain ownership.
- Activate or deactivate a domain.
- Set primary domain.
- Suspend or remove a domain mapping.
- Configure the production Vercel domain association.

Activation requires verified ownership and HTTPS readiness.

## 9. Subscription enforcement

Feature entitlements and resource limits are checked server-side for every relevant operation.

The UI may hide unavailable features but must not be relied on as a security boundary.

Usage updates must be safe against duplicate submissions and concurrent requests.

## 10. Audit policy

Audit events must be append-only at application level. Ordinary tenant roles cannot edit or delete them.

At minimum, log:
- Platform Owner tenant access and tenant switching.
- Tenant creation, suspension, activation, and archival.
- Membership and permission changes.
- Domain verification and activation.
- Subscription and plan changes.
- Sensitive exports and administrative reads.
- Failed privileged operations.
- Security configuration changes.

Do not store passwords, session secrets, API keys, or raw domain verification tokens in audit metadata.

## 11. Appwrite implementation considerations

Appwrite TablesDB does not provide conventional foreign-key enforcement or SQL-style cross-table transactions. Enforce logical relationships through trusted server checks, indexes, idempotency keys, and compensating operations.

The implementation must validate the deployed Appwrite permissions and API capabilities before applying the model.

## 12. Security acceptance tests

- Tenant A cannot read or mutate Tenant B data.
- Cross-tenant IDs cannot bypass authorization.
- Branch users cannot access unassigned branches.
- Tenant users cannot grant platform roles.
- Platform Owner access is correctly attributed and audited.
- Pending invitations are denied.
- Suspended tenants cannot perform protected operations.
- Disabled plan features cannot be reached through direct API calls.
- Private assets remain private when their IDs are known.
- Public endpoints expose only allowlisted fields.
