import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHostname,
  resolveTenantFromHost,
} from "../src/lib/bade3/tenant-context.ts";
import {
  assertSameTenant,
  authorizeTenantOperation,
} from "../src/lib/bade3/tenant-authorization.ts";

test("normalizes hostnames and rejects URL/path injection", () => {
  assert.equal(normalizeHostname(" Cafe.Example.com.:443 "), "cafe.example.com");
  assert.throws(() => normalizeHostname("https://cafe.example.com/path"));
  assert.throws(() => normalizeHostname("cafe.example.com/path"));
});

test("resolves only active tenants through verified active domains", async () => {
  const directory = {
    async findVerifiedDomain(domain) {
      assert.equal(domain, "cafe.example.com");
      return { tenant_id: "tenant-a", domain, is_active: true, verification_status: "verified" };
    },
    async getTenant(id) {
      assert.equal(id, "tenant-a");
      return { $id: id, slug: "cafe", status: "active" };
    },
  };
  assert.deepEqual(await resolveTenantFromHost("cafe.example.com", directory), {
    id: "tenant-a", slug: "cafe", status: "active", primaryDomain: "cafe.example.com",
  });
});

test("rejects unverified domains, suspended tenants and missing host headers", async () => {
  const unverified = {
    async findVerifiedDomain(domain) {
      return { tenant_id: "tenant-a", domain, is_active: true, verification_status: "pending" };
    },
    async getTenant() { return { $id: "tenant-a", slug: "cafe", status: "active" }; },
  };
  assert.equal(await resolveTenantFromHost("cafe.example.com", unverified), null);
  assert.equal(await resolveTenantFromHost(null, unverified), null);
  const suspended = {
    async findVerifiedDomain(domain) {
      return { tenant_id: "tenant-a", domain, is_active: true, verification_status: "verified" };
    },
    async getTenant() { return { $id: "tenant-a", slug: "cafe", status: "suspended" }; },
  };
  assert.equal(await resolveTenantFromHost("cafe.example.com", suspended), null);
});

test("tenant authorization rejects cross-tenant, inactive and unassigned access", () => {
  const base = {
    tenant: { id: "tenant-a", slug: "a", status: "active", primaryDomain: "a.example.com" },
    membership: { tenantId: "tenant-a", userId: "user-1", role: "manager", status: "active" },
    userId: "user-1",
    requiredRoles: ["manager", "owner"],
    branch: { id: "branch-1", tenantId: "tenant-a", status: "active" },
  };
  assert.equal(authorizeTenantOperation(base), true);
  assert.equal(authorizeTenantOperation({ ...base, membership: { ...base.membership, tenantId: "tenant-b" } }), false);
  assert.equal(authorizeTenantOperation({ ...base, branch: { ...base.branch, tenantId: "tenant-b" } }), false);
  assert.equal(authorizeTenantOperation({ ...base, membership: { ...base.membership, status: "pending" } }), false);
  assert.equal(authorizeTenantOperation({ ...base, requiredRoles: ["owner"] }), false);
});

test("cross-tenant parent-child links fail closed", () => {
  assert.doesNotThrow(() => assertSameTenant("tenant-a", "tenant-a"));
  assert.throws(() => assertSameTenant("tenant-a", "tenant-b"), /CROSS_TENANT_RESOURCE/);
});
