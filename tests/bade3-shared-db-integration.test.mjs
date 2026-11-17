import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHostname, resolveTenantFromHost } from "../src/lib/bade3/tenant-context.ts";
import { authorizeTenantOperation } from "../src/lib/bade3/tenant-authorization.ts";

test("shared database hostname resolution rejects unverified domains", async () => {
  const tenant = await resolveTenantFromHost("bella-roses.bade3.com", {
    findVerifiedDomain: async () => ({
      tenant_id: "bella-roses",
      domain: "bella-roses.bade3.com",
      is_active: false,
      verification_status: "pending",
    }),
    getTenant: async () => ({ $id: "bella-roses", slug: "bella-roses", status: "active" }),
  });
  assert.equal(tenant, null);
});

test("shared database hostname resolution returns only active verified tenant", async () => {
  const tenant = await resolveTenantFromHost("bella-roses.bade3.com", {
    findVerifiedDomain: async () => ({
      tenant_id: "bella-roses",
      domain: "bella-roses.bade3.com",
      is_active: true,
      verification_status: "verified",
    }),
    getTenant: async (id) => ({ $id: id, slug: "bella-roses", status: "active" }),
  });
  assert.equal(tenant?.id, "bella-roses");
});

test("tenant authorization denies cross-tenant membership and branch", () => {
  const tenant = { id: "tenant-a", slug: "a", status: "active", primaryDomain: "a.example.com" };
  assert.equal(authorizeTenantOperation({
    tenant,
    userId: "user-a",
    membership: { tenantId: "tenant-b", userId: "user-a", role: "owner", status: "active" },
  }), false);
  assert.equal(authorizeTenantOperation({
    tenant,
    userId: "user-a",
    membership: { tenantId: "tenant-a", userId: "user-a", role: "owner", status: "active" },
    branch: { id: "branch-b", tenantId: "tenant-b", status: "active" },
  }), false);
});

test("hostname normalization removes port and trailing dot", () => {
  assert.equal(normalizeHostname("Bella-Roses.Bade3.com.:443"), "bella-roses.bade3.com");
});
