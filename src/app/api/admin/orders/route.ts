import { NextResponse } from "next/server";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffUser } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const STATUSES = ["new", "accepted", "preparing", "ready", "served", "cancelled"] as const;

function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
async function call(path: string, init: RequestInit = {}) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) throw new Error("CONFIG");
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    ...init,
    headers: { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Key": key, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}
function q(value: unknown) { return `queries[]=${encodeURIComponent(JSON.stringify(value))}`; }

export async function GET(request: Request) {
  if (!(await getStaffUser("orders.read"))) return fail("غير مصرح أو لا تملك صلاحية قراءة الطلبات.", 403);
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!/^[A-Za-z0-9._-]{1,36}$/.test(id)) return fail("رقم الطلب غير صالح.");
      const [order, items] = await Promise.all([
        call(`/tablesdb/${DB}/tables/orders/rows/${encodeURIComponent(id)}`),
        call(`/tablesdb/${DB}/tables/order_items/rows?${q({ method: "equal", attribute: "order_id", values: [id] })}&${q({ method: "limit", values: [100] })}`),
      ]);
      if (!order.response.ok) return fail("الطلب غير موجود.", 404);
      if (!items.response.ok) throw new Error("ITEMS");
      return NextResponse.json({ order: order.payload, items: (items.payload.rows ?? []) as unknown[] }, { headers: { "Cache-Control": "no-store" } });
    }
    const [orders, tables] = await Promise.all([
      call(`/tablesdb/${DB}/tables/orders/rows?${q({ method: "notEqual", attribute: "status", values: ["served"] })}&${q({ method: "notEqual", attribute: "status", values: ["cancelled"] })}&${q({ method: "orderDesc", attribute: "$createdAt" })}&${q({ method: "limit", values: [100] })}`),
      call(`/tablesdb/${DB}/tables/restaurant_tables/rows?${q({ method: "limit", values: [100] })}`),
    ]);
    if (!orders.response.ok || !tables.response.ok) throw new Error("LIST");
    return NextResponse.json({ orders: (orders.payload.rows ?? []) as unknown[], tables: (tables.payload.rows ?? []) as unknown[] }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Admin orders read failed", cause instanceof Error ? cause.message : "unknown");
    return fail("تعذّر تحميل الطلبات.", 502);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail("طلب غير مسموح.", 403);
  const staff = await getStaffUser("orders.update");
  if (!staff) return fail("غير مصرح أو لا تملك صلاحية تحديث الطلبات.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (!body || typeof body.id !== "string" || !/^[A-Za-z0-9._-]{1,36}$/.test(body.id) || typeof body.status !== "string" || !STATUSES.includes(body.status as typeof STATUSES[number])) {
    return fail("بيانات تحديث الطلب غير صالحة.");
  }
  const roleStatuses: Record<string, readonly string[]> = {
    kitchen: ["accepted", "preparing", "ready"],
    service: ["ready", "served", "cancelled"],
  };
  const allowedStatuses = roleStatuses[staff.role];
  if (allowedStatuses && !allowedStatuses.includes(body.status)) {
    return fail("هذا الدور لا يملك صلاحية نقل الطلب إلى هذه الحالة.", 403);
  }
  try {
    const result = await call(`/tablesdb/${DB}/tables/orders/rows/${encodeURIComponent(body.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ data: { status: body.status } }),
    });
    if (!result.response.ok) return fail("تعذّر تحديث حالة الطلب.", result.response.status === 404 ? 404 : 502);
    return NextResponse.json({ order: result.payload });
  } catch (cause) {
    console.error("Admin order update failed", cause instanceof Error ? cause.message : "unknown");
    return fail("تعذّر تحديث حالة الطلب.", 502);
  }
}
