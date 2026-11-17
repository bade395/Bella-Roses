import { NextResponse } from "next/server";
import { findTenantTableByToken, resolveTenantForHost } from "@/lib/bade3/appwrite-platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) {
    return NextResponse.json({ error: "رمز الطاولة غير صالح." }, { status: 404 });
  }

  try {
    const tenant = await resolveTenantForHost(request.headers.get("host"));
    if (!tenant) return NextResponse.json({ error: "النطاق غير مرتبط بمطعم نشط." }, { status: 404 });

    const row = await findTenantTableByToken(tenant.id, token) as
      | ({ $id: string; table_number?: number; label?: string | null; branch_id?: string } & Record<string, unknown>)
      | null;
    if (!row || typeof row.branch_id !== "string") {
      return NextResponse.json({ error: "رمز الطاولة غير معروف أو الطاولة غير مفعّلة." }, { status: 404 });
    }

    return NextResponse.json({
      table: {
        id: row.$id,
        table_number: Number(row.table_number ?? 0),
        label: typeof row.label === "string" ? row.label : "",
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Public table resolution failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "تعذّر التحقق من الطاولة." }, { status: 503 });
  }
}
