import { cookies, headers as requestHeaders } from "next/headers";
import { AppwriteTenantDirectory, getActiveTenantBranchIds, getActiveTenantMembership, getTenantBranchAccess, resolveTenantForHost } from "@/lib/bade3/appwrite-platform-store";
import { PLATFORM_SUPPORT_COOKIE, verifySupportToken } from "@/lib/bade3/platform-support";
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
  tenantId: string;
  branchIds: string[];
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

function rejectStaffContext(stage: string, details: Record<string, unknown> = {}): null {
  console.error("[staff-context] rejected", { stage, ...details });
  return null;
}

/**
 * Resolves the signed-in user's role from Appwrite Team membership.
 * The existing immutable admin allowlist remains the owner bootstrap path,
 * so enabling the Team feature cannot lock out the current owner.
 */
export async function getStaffContext(): Promise<StaffContext | null> {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE) {
    return rejectStaffContext("appwrite-config-missing", {
      hasEndpoint: Boolean(APPWRITE_ENDPOINT),
      hasProjectId: Boolean(APPWRITE_PROJECT_ID),
      hasCookieName: Boolean(ADMIN_SESSION_COOKIE),
    });
  }

  const cookieStore = await cookies();
  const supportToken = cookieStore.get(PLATFORM_SUPPORT_COOKIE)?.value;
  if (supportToken) {
    const claims = verifySupportToken(supportToken, "bella-support");
    if (!claims) return rejectStaffContext("platform-support-session-invalid");
    const incoming = await requestHeaders();
    const hosts = [incoming.get("host"), incoming.get("x-forwarded-host")]
      .filter((value): value is string => Boolean(value));
    let supportTenant = null;
    for (const host of [...new Set(hosts)]) {
      try {
        supportTenant = await resolveTenantForHost(host);
        if (supportTenant) break;
      } catch (error) {
        console.error("[staff-context] support host resolution failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!supportTenant || supportTenant.id !== claims.tenantId || supportTenant.status !== "active") {
      return rejectStaffContext("platform-support-tenant-mismatch", { tenantId: claims.tenantId });
    }
    const branchIds = await getActiveTenantBranchIds(supportTenant.id);
    return {
      id: claims.sub,
      email: "",
      name: "BADE3 Platform Owner",
      role: "owner",
      membershipId: null,
      permissions: ROLE_PERMISSIONS.owner,
      tenantId: supportTenant.id,
      branchIds,
    };
  }

  const sessionSecret = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionSecret) return rejectStaffContext("session-cookie-missing", { cookieName: ADMIN_SESSION_COOKIE });

  const headers = {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-Session": sessionSecret,
  };

  const userResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers,
    cache: "no-store",
  });
  if (!userResponse.ok) return rejectStaffContext("appwrite-account-rejected", { status: userResponse.status });

  const user = (await userResponse.json()) as AppwriteUser;
  if (!user.$id) return rejectStaffContext("appwrite-account-id-missing");

  const ownerAllowed = isAllowedAdmin(user.$id);
  const incomingHeaders = await requestHeaders();
  const hostCandidates = [incomingHeaders.get("host"), incomingHeaders.get("x-forwarded-host")]
    .filter((value): value is string => Boolean(value));
  let tenant = null;
  for (const host of [...new Set(hostCandidates)]) {
    try {
      tenant = await resolveTenantForHost(host);
      if (tenant) break;
    } catch (error) {
      console.error("[staff-context] host resolution failed", {
        host,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!tenant && ownerAllowed) {
    // The owner tenant ID is a server-side constant/configuration, not user input.
    // Do not make owner login depend on a second tenant-row lookup: the active
    // tenant membership and branch-access checks below remain mandatory gates.
    const ownerTenantId = process.env.BELLA_ROSES_TENANT_ID ?? "bella-roses";
    tenant = {
      id: ownerTenantId,
      slug: "bella-roses",
      status: "active",
      primaryDomain: hostCandidates[0] ?? "owner-fallback",
    };
  }
  if (!tenant) return rejectStaffContext("tenant-not-resolved", { ownerAllowed, hosts: hostCandidates });

  const tenantMembership = await getActiveTenantMembership(tenant.id, user.$id);
  if (!tenantMembership || !isStaffRole(tenantMembership.role)) {
    return rejectStaffContext("tenant-membership-missing-or-invalid", {
      tenantId: tenant.id,
      ownerAllowed,
      membershipFound: Boolean(tenantMembership),
      role: tenantMembership?.role ?? null,
    });
  }

  const branchAccess = await getTenantBranchAccess(tenant.id, user.$id);
  const branchIds = branchAccess.map((entry) => entry.branchId);
  if (branchIds.length === 0) return rejectStaffContext("branch-access-empty", { tenantId: tenant.id, ownerAllowed });

  if (ownerAllowed) {
    return {
      id: user.$id,
      email: user.email ?? "",
      name: user.name ?? "",
      role: tenantMembership.role,
      membershipId: null,
      permissions: ROLE_PERMISSIONS[tenantMembership.role],
      tenantId: tenant.id,
      branchIds,
    };
  }

  const teamId = process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff";
  if (!teamId) return rejectStaffContext("staff-team-id-missing");

  const query = encodeURIComponent(JSON.stringify({
    method: "equal",
    attribute: "teamId",
    values: [teamId],
  }));
  const membershipsResponse = await fetch(
    `${APPWRITE_ENDPOINT}/account/memberships?queries[]=${query}`,
    { headers, cache: "no-store" },
  );
  if (!membershipsResponse.ok) {
    return rejectStaffContext("appwrite-team-memberships-rejected", { status: membershipsResponse.status });
  }

  const payload = (await membershipsResponse.json()) as { memberships?: Membership[] };
  const membership = payload.memberships?.find(
    (entry) =>
      entry.teamId === teamId &&
      entry.userId === user.$id &&
      entry.confirm === true &&
      Boolean(entry.joined),
  );
  if (!membership?.$id || !Array.isArray(membership.roles)) {
    return rejectStaffContext("staff-team-membership-missing", { teamId, tenantRole: tenantMembership.role });
  }

  const teamRole = membership.roles.find(isStaffRole);
  if (!teamRole || teamRole !== tenantMembership.role) {
    return rejectStaffContext("staff-team-role-mismatch", { teamRole: teamRole ?? null, tenantRole: tenantMembership.role });
  }
  const role = tenantMembership.role;

  return {
    id: user.$id,
    email: user.email ?? "",
    name: user.name ?? "",
    role,
    membershipId: membership.$id,
    permissions: ROLE_PERMISSIONS[role],
    tenantId: tenant.id,
    branchIds,
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
