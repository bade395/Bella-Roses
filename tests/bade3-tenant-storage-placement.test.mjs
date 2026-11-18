import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantStoragePlacement } from "../src/lib/bade3/tenant-storage-placement.ts";

const ENV_KEYS = [
  "APPWRITE_PROJECT_ID",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "BADE3_SHARED_DATABASE_ID",
  "NEXT_PUBLIC_APPWRITE_DATABASE_ID",
];

async function withEnv(values, run) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (Object.hasOwn(values, key)) process.env[key] = values[key];
    else delete process.env[key];
  }
  try {
    return await run();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("uses the existing shared free-tier database by default", async () => {
  await withEnv({ APPWRITE_PROJECT_ID: "project-1" }, async () => {
    assert.deepEqual(await resolveTenantStoragePlacement("tenant-a"), {
      mode: "shared",
      projectId: "project-1",
      databaseId: "bella_roses",
    });
  });
});

test("supports server-configured shared database identifiers", async () => {
  await withEnv({
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: "project-2",
    BADE3_SHARED_DATABASE_ID: "shared-db",
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "legacy-db",
  }, async () => {
    assert.deepEqual(await resolveTenantStoragePlacement("tenant-a"), {
      mode: "shared",
      projectId: "project-2",
      databaseId: "shared-db",
    });
  });
});

test("uses a server-side dedicated placement when the directory provides one", async () => {
  await withEnv({}, async () => {
    const directory = {
      async getPlacement(tenantId) {
        assert.equal(tenantId, "tenant-paid");
        return { mode: "dedicated", projectId: "dedicated-project", databaseId: "tenant-db" };
      },
    };
    assert.deepEqual(await resolveTenantStoragePlacement("tenant-paid", directory), {
      mode: "dedicated",
      projectId: "dedicated-project",
      databaseId: "tenant-db",
    });
  });
});

test("falls back to shared placement when no dedicated placement is registered", async () => {
  await withEnv({ APPWRITE_PROJECT_ID: "project-1" }, async () => {
    const directory = { async getPlacement() { return null; } };
    assert.deepEqual(await resolveTenantStoragePlacement("tenant-a", directory), {
      mode: "shared",
      projectId: "project-1",
      databaseId: "bella_roses",
    });
  });
});

test("rejects missing tenant and missing Appwrite project configuration", async () => {
  await withEnv({}, async () => {
    await assert.rejects(resolveTenantStoragePlacement(""), /TENANT_ID_REQUIRED/);
    await assert.rejects(resolveTenantStoragePlacement("tenant-a"), /APPWRITE_PROJECT_NOT_CONFIGURED/);
  });
});
