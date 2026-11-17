import type { ResolvedTenant } from "./tenant-context";

export type TenantMembership = {
  tenantId: string;
  userId: string;
  role: string;
  status: "active" | "pending" | "revoked";
};

export type BranchRecord = {
  id: string;
  tenantId: string;
  status: "active" | "inactive";
};

export type TenantAuthorizationInput = {
  tenant: ResolvedTenant;
  membership: TenantMembership | null;
  userId: string;
  requiredRoles?: readonly string[];
  branch?: BranchRecord | null;
};

export function authorizeTenantOperation(input: TenantAuthorizationInput): boolean {
  if (input.tenant.status !== "active" || !input.membership) return false;
  if (
    input.membership.tenantId !== input.tenant.id ||
    input.membership.userId !== input.userId ||
    input.membership.status !== "active"
  ) return false;
  if (input.requiredRoles?.length && !input.requiredRoles.includes(input.membership.role)) return false;
  if (input.branch && (input.branch.tenantId !== input.tenant.id || input.branch.status !== "active")) return false;
  return true;
}

export function assertSameTenant(parentTenantId: string, childTenantId: string): void {
  if (!parentTenantId || parentTenantId !== childTenantId) {
    throw new Error("CROSS_TENANT_RESOURCE");
  }
}
