import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/bade3/platform-identity";
import { writePlatformAuditEvent } from "@/lib/bade3/platform-audit";
import { platformDatabaseId } from "@/lib/bade3/appwrite-platform-store";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformOwner();
    const endpoint = (APPWRITE_ENDPOINT ?? "").replace(/\\/+$/, "");
    const projectId = APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    if (!endpoint || !projectId || !apiKey) {
      return NextResponse.json({ error: "Platform storage is not configured." }, { status: 503 });
    }

    const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10000) {
      return NextResponse.json({ error: "رقم الصفحة غير صالح." }, { status: 400 });
    }
    const offset = (requestedPage - 1) * PAGE_SIZE;
    const queries = [
      { method: "orderAsc", attribute: "name" },
      { method: "limit", values: [PAGE_SIZE] },
      { method: "offset", values: [offset] },
    ].map((query) => `queries[]=${encodeURIComponent(JSON.stringify(query))}`).join("&");

    const response = await fetch(
      `${endpoint}/tablesdb/${encodeURIComponent(platformDatabaseId())}/tables/tenants/rows?${queries}`,
      {
        headers: { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      rows?: Array<{ $id: string; data: Record<string, unknown> }>;
      total?: number;
      type?: string;
    };
    if (!response.ok) throw new Error(payload.type ?? "TENANT_LIST_FAILED");

    // Audit only after the privileged read has succeeded.
    await writePlatformAuditEvent({
      actor,
      action: "platform.tenants.list",
      resourceType: "tenant",
      outcome: "success",
      metadata: { source: "platform-api", page: requestedPage, pageSize: PAGE_SIZE },
    });

    const tenants = (payload.rows ?? []).map((row) => ({
      id: row.$id,
      name: row.data.name,
      slug: row.data.slug,
      status: row.data.status,
      defaultCurrency: row.data.default_currency,
      timezone: row.data.timezone,
    }));
    const total = Number.isFinite(payload.total) ? Number(payload.total) : offset + tenants.length;
    return NextResponse.json({
      tenants,
      page: requestedPage,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }, { headers: { "Cache-Control": "no-store, private" } });
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
