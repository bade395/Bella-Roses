/**
 * Tenant storage placement contract.
 *
 * Current free-tier mode deliberately resolves every tenant to the existing
 * shared Appwrite database. A future billing/entitlement phase can supply a
 * server-only registry implementation that returns dedicated placements.
 * Never accept placement identifiers from browser input.
 */
export type TenantStoragePlacement =
  | {
      mode: "shared";
      projectId: string;
      databaseId: string;
    }
  | {
      mode: "dedicated";
      projectId: string;
      databaseId: string;
    };

export interface TenantStoragePlacementDirectory {
  getPlacement(tenantId: string): Promise<TenantStoragePlacement | null>;
}

export async function resolveTenantStoragePlacement(
  tenantId: string,
  directory?: TenantStoragePlacementDirectory,
): Promise<TenantStoragePlacement> {
  if (!tenantId) throw new Error("TENANT_ID_REQUIRED");

  const configured = directory ? await directory.getPlacement(tenantId) : null;
  if (configured) return configured;

  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.BADE3_SHARED_DATABASE_ID ??
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
    "bella_roses";

  if (!projectId) throw new Error("APPWRITE_PROJECT_NOT_CONFIGURED");

  return { mode: "shared", projectId, databaseId };
}
