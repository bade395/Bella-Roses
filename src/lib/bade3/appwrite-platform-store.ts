import "server-only";

import {
  resolveTenantFromHost,
  type ResolvedTenant,
  type TenantDirectory,
} from "./tenant-context";

const DATABASE_ID =
  process.env.BADE3_CORE_DATABASE_ID ??
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  "bella_roses";

const TENANT_TABLES = new Set([
  "categories",
  "products",
  "restaurant_tables",
  "orders",
  "order_items",
]);

type AppwriteRow<T> = { $id: string; data: T };
type AppwriteList<T> = { rows?: AppwriteRow<T>[]; total?: number };
type DomainData = {
  tenant_id?: string;
  domain?: string;
  is_active?: boolean;
  verification_status?: string;
  is_primary?: boolean;
};
type TenantData = { $id?: string; slug?: string; status?: string };
type MembershipData = {
  tenant_id?: string;
  user_id?: string;
  role?: string;
  status?: string;
};
type BranchData = { tenant_id?: string; status?: string };

function appwriteConfig() {
  const endpoint = (
    process.env.APPWRITE_ENDPOINT ??
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
    ""
  ).replace(/\/+$/, "");
  const projectId =
    process.env.APPWRITE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("BADE3_PLATFORM_STORAGE_NOT_CONFIGURED");
  }
  return { endpoint, projectId, apiKey };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { endpoint, projectId, apiKey } = appwriteConfig();
  const response = await fetch(`${endpoint}${path}`, {
    ...init,
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as T & {
    type?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(`BADE3_PLATFORM_STORAGE_ERROR:${payload.type ?? response.status}`);
  }
  return payload;
}

function queryParam(query: Record<string, unknown>) {
  return `queries[]=${encodeURIComponent(JSON.stringify(query))}`;
}

async function listRows<T>(
  tableId: string,
  queries: Record<string, unknown>[],
  limit = 100,
): Promise<AppwriteRow<T>[]> {
  const params = [
    ...queries.map(queryParam),
    queryParam({ method: "limit", values: [limit] }),
  ].join("&");
  const result = await request<AppwriteList<T>>(
    `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/${encodeURIComponent(tableId)}/rows?${params}`,
  );
  return Array.isArray(result.rows) ? result.rows : [];
}

/** Server-only Appwrite implementation of the verified-domain directory. */
export class AppwriteTenantDirectory implements TenantDirectory {
  async findVerifiedDomain(hostname: string): Promise<DomainData | null> {
    const rows = await listRows<DomainData>("tenant_domains", [
      { method: "equal", attribute: "domain", values: [hostname] },
      { method: "equal", attribute: "verification_status", values: ["verified"] },
      { method: "equal", attribute: "is_active", values: [true] },
    ], 1);
    return rows[0]?.data ?? null;
  }

  async getTenant(tenantId: string): Promise<TenantData | null> {
    const row = await request<AppwriteRow<TenantData>>(
      `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/tenants/rows/${encodeURIComponent(tenantId)}`,
    ).catch(() => null);
    return row?.data ? { ...row.data, $id: row.$id } : null;
  }
}

export async function resolveTenantForHost(
  hostHeader: string | null,
): Promise<ResolvedTenant | null> {
  return resolveTenantFromHost(hostHeader, new AppwriteTenantDirectory());
}

export async function getActiveTenantMembership(
  tenantId: string,
  userId: string,
): Promise<{ tenantId: string; userId: string; role: string; status: "active" | "pending" | "revoked" } | null> {
  const rows = await listRows<MembershipData>("tenant_members", [
    { method: "equal", attribute: "tenant_id", values: [tenantId] },
    { method: "equal", attribute: "user_id", values: [userId] },
    { method: "equal", attribute: "status", values: ["active"] },
  ], 1);
  const member = rows[0]?.data;
  if (!member?.tenant_id || !member.user_id || !member.role) return null;
  return {
    tenantId: member.tenant_id,
    userId: member.user_id,
    role: member.role,
    status: "active",
  };
}

export async function isActiveTenantBranch(
  tenantId: string,
  branchId: string,
): Promise<boolean> {
  const branch = await request<AppwriteRow<BranchData>>(
    `/tablesdb/${encodeURIComponent(DATABASE_ID)}/tables/branches/rows/${encodeURIComponent(branchId)}`,
  ).catch(() => null);
  return Boolean(
    branch?.data &&
    branch.data.tenant_id === tenantId &&
    branch.data.status === "active",
  );
}

/**
 * Tenant-owned list access must use this helper so tenant_id is always
 * injected by trusted server code. Browser-supplied tenant IDs are not accepted
 * by any public function in this module.
 */
export async function listTenantRows<T>(
  tableId: string,
  tenantId: string,
  branchId?: string,
  limit = 100,
): Promise<AppwriteRow<T>[]> {
  if (!TENANT_TABLES.has(tableId)) throw new Error("UNSUPPORTED_TENANT_TABLE");
  if (!tenantId) throw new Error("TENANT_CONTEXT_REQUIRED");
  const queries: Record<string, unknown>[] = [
    { method: "equal", attribute: "tenant_id", values: [tenantId] },
  ];
  if (branchId) {
    queries.push({ method: "equal", attribute: "branch_id", values: [branchId] });
  }
  return listRows<T>(tableId, queries, Math.min(Math.max(limit, 1), 100));
}

export function platformDatabaseId(): string {
  return DATABASE_ID;
}
