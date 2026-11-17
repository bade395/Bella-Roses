import { NextResponse } from "next/server";
import { getTenantOperationalRow, resolveTenantForHost } from "@/lib/bade3/appwrite-platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderData = {
  order_number?: string;
  status?: string;
  table_id?: string;
  subtotal?: number;
  $createdAt?: string;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "رابط متابعة الطلب غير صالح." }, { status: 400 });
  }
  try {
    const tenant = await resolveTenantForHost(request.headers.get("host"));
    if (!tenant) return NextResponse.json({ error: "النطاق غير مرتبط بمطعم نشط." }, { status: 404 });

    const order = await getTenantOperationalRow<OrderData>("orders", tenant.id, id);
    if (!order) return NextResponse.json({ error: "لم نعثر على هذا الطلب." }, { status: 404 });

    const table = order.table_id
      ? await getTenantOperationalRow<{ table_number?: number }>("restaurant_tables", tenant.id, order.table_id)
      : null;

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
    return NextResponse.json({ error: "تعذّر تحميل حالة الطلب الآن." }, { status: 503 });
  }
}
