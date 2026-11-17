import { randomUUID } from "node:crypto";
import type { PlatformActor } from "./platform-identity";

export type PlatformAuditEvent = {
  actor: PlatformActor;
  action: string;
  resourceType: string;
  resourceId?: string;
  tenantId?: string;
  branchId?: string;
  outcome: "success" | "denied" | "failure";
  metadata?: Record<string, string | number | boolean | null>;
};

const MAX_METADATA_ENTRIES = 30;

function safeMetadata(input: PlatformAuditEvent["metadata"] = {}) {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input).slice(0, MAX_METADATA_ENTRIES)) {
    if (/password|secret|token|authorization|api.?key|cookie/i.test(key)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      output[key.slice(0, 64)] = typeof value === "string" ? value.slice(0, 500) : value;
    }
  }
  return output;
}

/**
 * Append-only application audit writer. It fails closed: callers must not
 * report a privileged operation as complete if its mandatory audit write fails.
 */
export async function writePlatformAuditEvent(event: PlatformAuditEvent): Promise<void> {
  const endpoint = (process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "").replace(/\/+$/, "");
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.BADE3_CORE_DATABASE_ID ?? "bade3_core";
  const tableId = process.env.BADE3_AUDIT_EVENTS_TABLE_ID ?? "audit_events";

  if (!endpoint || !projectId || !apiKey) throw new Error("PLATFORM_AUDIT_NOT_CONFIGURED");

  const response = await fetch(
    `${endpoint}/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}/rows`,
    {
      method: "POST",
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rowId: randomUUID(),
        data: {
          actor_type: "platform",
          actor_id: event.actor.id,
          tenant_id: event.tenantId ?? null,
          branch_id: event.branchId ?? null,
          action: event.action.slice(0, 120),
          resource_type: event.resourceType.slice(0, 80),
          resource_id: event.resourceId?.slice(0, 128) ?? null,
          result: event.outcome,
          metadata: safeMetadata(event.metadata),
          created_at: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { type?: string };
    throw new Error(`PLATFORM_AUDIT_WRITE_FAILED:${error.type ?? response.status}`);
  }
}
