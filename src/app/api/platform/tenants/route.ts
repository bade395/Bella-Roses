import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/bade3/platform-identity";
import { writePlatformAuditEvent } from "@/lib/bade3/platform-audit";
import { platformDatabaseId } from "@/lib/bade3/appwrite-platform-store";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requirePlatformOwner();
    const endpoint = (APPWRITE_ENDPOINT ?? "").replace(/\/+$/, "");
    const projectId = APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    if (!endpoint || !projectId || !apiKey) {
      return NextResponse.json({ error: "Platform storage is not configured." }, { status: 503 });
    }

    // Record the privileged read before returning tenant data.
    await writePlatformAuditEvent({
      actor,
      action: "platform.tenants.list",
      resourceType: "tenant",
      outcome: "success",
      metadata: { source: "platform-api" },
    });

    const response = await fetch(
      `${endpoint}/tablesdb/${encodeURIComponent(platformDatabaseId())}/tables/tenants/rows?queries[]=${encodeURIComponent(JSON.stringify({ method: "orderAsc", attribute: "name" }))}&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }))}`,
      {
        headers: {
          "X-Appwrite-Project": projectId,
          "X-Appwrite-Key": apiKey,
        },
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      rows?: Array<{ $id: string; data: Record<string, unknown> }>;
      type?: string;
    };
    if (!response.ok) throw new Error(payload.type ?? "TENANT_LIST_FAILED");

    const tenants = (payload.rows ?? []).map((row) => ({
      id: row.$id,
      name: row.data.name,
      slug: row.data.slug,
      status: row.data.status,
      defaultCurrency: row.data.default_currency,
      timezone: row.data.timezone,
    }));
    return NextResponse.json({ tenants }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    const denied = message === "PLATFORM_OWNER_REQUIRED";
    console.error("Platform tenant list failed", denied ? "denied" : message);
    return NextResponse.json(
      { error: denied ? "غير مصرح." : "تعذر تحميل الشركات." },
      { status: denied ? 403 : 503 },
    );
  }
}
