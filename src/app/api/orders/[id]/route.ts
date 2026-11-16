import { NextResponse } from "next/server";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";

async function call(path: string) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) throw new Error("CONFIG");
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    headers: { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Key": key },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "رابط متابعة الطلب غير صالح." }, { status: 400 });
  }
  try {
    const result = await call(`/tablesdb/${DB}/tables/orders/rows/${encodeURIComponent(id)}`);
    if (result.response.status === 404) return NextResponse.json({ error: "لم نعثر على هذا الطلب." }, { status: 404 });
    if (!result.response.ok) throw new Error("ORDER_READ");
    const order = result.payload as { order_number?: string; status?: string; table_id?: string; subtotal?: number; $createdAt?: string };
    const tableResult = order.table_id
      ? await call(`/tablesdb/${DB}/tables/restaurant_tables/rows/${encodeURIComponent(order.table_id)}`)
      : null;
    const table = tableResult?.response.ok ? tableResult.payload as { table_number?: number } : null;
    return NextResponse.json({
      order: {
        order_number: order.order_number,
        status: order.status,
        table_number: table?.table_number ?? null,
        subtotal: Number(order.subtotal ?? 0),
        created_at: order.$createdAt,
      },
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (cause) {
    console.error("Public order tracking failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "تعذّر تحميل حالة الطلب الآن." }, { status: 502 });
  }
}
