import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  isAllowedAdmin,
} from "@/lib/admin-auth";

export const STAFF_ROLES = ["owner", "manager", "cashier", "kitchen", "service"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PERMISSIONS = [
  "staff.manage",
  "menu.manage",
  "tables.manage",
  "orders.read",
  "orders.update",
  "reports.read",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  owner: STAFF_PERMISSIONS,
  manager: ["menu.manage", "tables.manage", "orders.read", "orders.update", "reports.read"],
  cashier: ["orders.read", "orders.update", "reports.read"],
  kitchen: ["orders.read", "orders.update"],
  service: ["orders.read", "orders.update"],
};

export type StaffContext = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  membershipId: string | null;
  permissions: readonly StaffPermission[];
};

type AppwriteUser = { $id?: string; email?: string; name?: string };
type Membership = {
  $id?: string;
  teamId?: string;
  userId?: string;
  roles?: string[];
  confirm?: boolean;
  joined?: string | null;
};

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Resolves the signed-in user's role from Appwrite Team membership.
 * The existing immutable admin allowlist remains the owner bootstrap path,
 * so enabling the Team feature cannot lock out the current owner.
 */
export async function getStaffContext(): Promise<StaffContext | null> {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE) return null;

  const cookieStore = await cookies();
  const sessionSecret = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionSecret) return null;

  const headers = {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-Session": sessionSecret,
  };

  const userResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers,
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = (await userResponse.json()) as AppwriteUser;
  if (!user.$id) return null;

  if (isAllowedAdmin(user.$id)) {
    return {
      id: user.$id,
      email: user.email ?? "",
      name: user.name ?? "",
      role: "owner",
      membershipId: null,
      permissions: ROLE_PERMISSIONS.owner,
    };
  }

  const teamId = process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff";
  if (!teamId) return null;

  const query = encodeURIComponent(JSON.stringify({
    method: "equal",
    attribute: "teamId",
    values: [teamId],
  }));
  const membershipsResponse = await fetch(
    `${APPWRITE_ENDPOINT}/account/memberships?queries[]=${query}`,
    { headers, cache: "no-store" },
  );
  if (!membershipsResponse.ok) return null;

  const payload = (await membershipsResponse.json()) as { memberships?: Membership[] };
  const membership = payload.memberships?.find(
    (entry) =>
      entry.teamId === teamId &&
      entry.userId === user.$id &&
      entry.confirm === true &&
      Boolean(entry.joined),
  );
  if (!membership?.$id || !Array.isArray(membership.roles)) return null;

  const role = membership.roles.find(isStaffRole);
  if (!role) return null;

  return {
    id: user.$id,
    email: user.email ?? "",
    name: user.name ?? "",
    role,
    membershipId: membership.$id,
    permissions: ROLE_PERMISSIONS[role],
  };
}

export function hasStaffPermission(
  staff: StaffContext,
  permission: StaffPermission,
): boolean {
  return staff.permissions.includes(permission);
}

export async function getStaffUser(permission: StaffPermission): Promise<StaffContext | null> {
  const staff = await getStaffContext();
  return staff && hasStaffPermission(staff, permission) ? staff : null;
}
