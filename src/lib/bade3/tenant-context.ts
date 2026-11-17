export type TenantStatus = "pending" | "active" | "suspended" | "cancelled" | "archived";

export type ResolvedTenant = {
  id: string;
  slug: string;
  status: TenantStatus;
  primaryDomain: string;
};

export type TenantDomainRecord = {
  tenant_id?: unknown;
  domain?: unknown;
  is_active?: unknown;
  verification_status?: unknown;
  is_primary?: unknown;
};

export type TenantRecord = {
  $id?: unknown;
  slug?: unknown;
  status?: unknown;
};

export interface TenantDirectory {
  findVerifiedDomain(hostname: string): Promise<TenantDomainRecord | null>;
  getTenant(tenantId: string): Promise<TenantRecord | null>;
}

export function normalizeHostname(input: string): string {
  const candidate = input.trim().toLowerCase().replace(/\.$/, "");
  if (!candidate || candidate.length > 253 || /[\s/@?#]/.test(candidate)) {
    throw new Error("INVALID_TENANT_HOST");
  }
  const hostname = candidate.replace(/:\d+$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)) {
    throw new Error("INVALID_TENANT_HOST");
  }
  return hostname;
}

/**
 * Resolves a tenant only from a verified server-side domain directory.
 * A browser-provided tenant_id is intentionally not accepted by this API.
 */
export async function resolveTenantFromHost(
  hostHeader: string | null,
  directory: TenantDirectory,
): Promise<ResolvedTenant | null> {
  if (!hostHeader) return null;
  const hostname = normalizeHostname(hostHeader.split(",")[0]);
  const domain = await directory.findVerifiedDomain(hostname);
  if (
    !domain ||
    domain.domain !== hostname ||
    domain.is_active !== true ||
    domain.verification_status !== "verified" ||
    typeof domain.tenant_id !== "string"
  ) return null;

  const tenant = await directory.getTenant(domain.tenant_id);
  if (
    !tenant ||
    tenant.$id !== domain.tenant_id ||
    tenant.status !== "active" ||
    typeof tenant.slug !== "string" ||
    !tenant.slug
  ) return null;

  return {
    id: domain.tenant_id,
    slug: tenant.slug,
    status: "active",
    primaryDomain: hostname,
  };
}
