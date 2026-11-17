import { NextResponse } from "next/server";
import { getAdminUser, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const ARCHIVED = ["served", "cancelled"];

function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function q(value: unknown) { return `queries[]=${encodeURIComponent(JSON.stringify(value))}`; }

async function call(path: string) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) throw new Error("CONFIG");
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    headers: { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Key": key },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  return { response, payload };
}

export async function GET(request: Request) {
  if (!(await getAdminUser())) return fail("غير مصرح.", 401);
  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "all";
  const limit = Math.min(100, Math.max(10, Number(params.get("limit")) || 50));
  const offset = Math.max(0, Math.min(10000, Number(params.get("offset")) || 0));
  if (!["all", ...ARCHIVED].includes(status)) return fail("فلتر الحالة غير صالح.");

  try {
    const queries = [
      q({ method: "equal", attribute: "status", values: status === "all" ? ARCHIVED : [status] }),
      q({ method: "orderDesc", attribute: "$createdAt" }),
      q({ method: "limit", values: [limit] }),
      q({ method: "offset", values: [offset] }),
    ];
    const [orders, tables] = await Promise.all([
      call(`/tablesdb/${DB}/tables/orders/rows?${queries.join("&")}`),
      call(`/tablesdb/${DB}/tables/restaurant_tables/rows?${q({ method: "limit", values: [100] })}`),
    ]);
    if (!orders.response.ok || !tables.response.ok) throw new Error("ARCHIVE_READ");
    const rows = Array.isArray(orders.payload.rows) ? orders.payload.rows : [];
    return NextResponse.json({
      orders: rows.map((row: any) => row.data ? { ...row, ...row.data } : row),
      tables: (tables.payload.rows ?? []).map((row: any) => row.data ? { ...row, ...row.data } : row),
      total: Number(orders.payload.total ?? 0),
      limit,
      offset,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (cause) {
    console.error("Order archive read failed", cause instanceof Error ? cause.message : "unknown");
    return fail("تعذّر تحميل أرشيف الطلبات.", 502);
  }
}
