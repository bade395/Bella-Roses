import { NextResponse } from "next/server";
import { getTenantMenu, resolveTenantForHost } from "@/lib/bade3/appwrite-platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const tenant = await resolveTenantForHost(request.headers.get("host"));
    if (!tenant) return NextResponse.json({ error: "القائمة غير متاحة لهذا النطاق." }, { status: 404 });
    const menu = await getTenantMenu(tenant.id);
    return NextResponse.json(menu, {
      headers: { "Cache-Control": "no-store, public" },
    });
  } catch (cause) {
    console.error("Tenant menu load failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "تعذّر تحميل القائمة حاليًا." }, { status: 503 });
  }
}
