# Staff roles and permissions

Bella Roses uses Appwrite Teams for staff membership. The feature is intentionally opt-in until the owner completes the production bootstrap.

## Environment

- `APPWRITE_STAFF_TEAM_ID`: ID of the Appwrite Team dedicated to Bella Roses staff.
- Keep `APPWRITE_API_KEY` server-only. Do not expose it through a `NEXT_PUBLIC_*` variable.

When the Team ID is not configured, only the existing immutable admin allowlist can resolve as the owner. Once configured, allowlisted owner IDs retain full owner access while other accounts must have a confirmed, joined membership in that exact Team.

## Roles

| Appwrite Team role | Permissions |
| --- | --- |
| `owner` | All permissions; bootstrap owner |
| `manager` | Menu, tables, orders, reports (staff membership changes remain owner-only) |
| `cashier` | Read/update orders and read reports |
| `kitchen` | Read/update orders |
| `service` | Read/update orders |

## Permission identifiers

- `staff.manage`
- `menu.manage`
- `tables.manage`
- `orders.read`
- `orders.update`
- `reports.read`

## Security notes

- Roles are resolved from the authenticated Appwrite session, not from client-provided data.
- Invited but unconfirmed memberships are denied.
- The owner allowlist is a bootstrap and recovery mechanism; it must not be removed until the Team owner membership and recovery path have been verified.
- API routes must call `getStaffContext()` and enforce the specific permission with `hasStaffPermission()`. Hiding navigation items in the browser is not authorization.
- Do not create the production Team, invite staff, or alter existing memberships as part of code deployment. Those are separate owner-approved operational steps.

## Team bootstrap and invitations

The default Team ID is `bella-roses-staff`; override it with the server-only `APPWRITE_STAFF_TEAM_ID` environment variable if needed. The owner opens `/admin/staff` and uses **Set up staff team** once. Team creation uses the owner's authenticated Appwrite session, making that account the Team owner. The owner can then send email invitations and manage membership roles from the same page.

Invited staff must sign in with the invited account and accept the invitation at `/admin/staff/accept`. Staff-management endpoints are restricted to the Team owner because Appwrite's membership-management API requires owner privileges.
