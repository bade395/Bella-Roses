import { NextResponse } from "next/server";
import { getAdminUser, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const PAGE_SIZE = 100;
const MAX_ROWS = 5000;

function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function q(value: unknown) { return `queries[]=${encodeURIComponent(JSON.stringify(value))}`; }
function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!row || typeof row !== "object") return {};
    const entry = row as Record<string, unknown>;
    const data = entry.data;
    return data && typeof data === "object" ? { ...entry, ...(data as Record<string, unknown>) } : entry;
  });
}

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

function localDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

export async function GET(request: Request) {
  if (!(await getAdminUser())) return fail("غير مصرح.", 401);
  const range = Number(new URL(request.url).searchParams.get("days") ?? 7);
  if (![7, 30, 90].includes(range)) return fail("الفترة المطلوبة غير صالحة.");

  try {
    const end = new Date();
    const start = new Date(end.getTime() - range * 24 * 60 * 60 * 1000);
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const queries = [
        q({ method: "greaterThanEqual", attribute: "$createdAt", values: [start.toISOString()] }),
        q({ method: "lessThanEqual", attribute: "$createdAt", values: [end.toISOString()] }),
        q({ method: "orderDesc", attribute: "$createdAt" }),
        q({ method: "limit", values: [PAGE_SIZE] }),
        q({ method: "offset", values: [offset] }),
      ];
      const result = await call(`/tablesdb/${DB}/tables/orders/rows?${queries.join("&")}`);
      if (!result.response.ok) throw new Error("REPORT_READ");
      const batch = normalizeRows(result.payload.rows);
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    const days = new Map<string, { date: string; orders: number; served: number; cancelled: number; revenue: number }>();
    let served = 0, cancelled = 0, active = 0, revenue = 0;
    for (const order of rows) {
      const status = String(order.status ?? "new");
      const amount = Number(order.subtotal ?? 0);
      if (status === "served") { served += 1; revenue += Number.isFinite(amount) ? amount : 0; }
      else if (status === "cancelled") cancelled += 1;
      else active += 1;
      const createdAt = typeof order.$createdAt === "string" ? order.$createdAt : "";
      if (!createdAt) continue;
      const date = localDay(createdAt);
      const day = days.get(date) ?? { date, orders: 0, served: 0, cancelled: 0, revenue: 0 };
      day.orders += 1;
      if (status === "served") { day.served += 1; day.revenue += Number.isFinite(amount) ? amount : 0; }
      if (status === "cancelled") day.cancelled += 1;
      days.set(date, day);
    }
    const daily = [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({
      rangeDays: range,
      totalOrders: rows.length,
      servedOrders: served,
      cancelledOrders: cancelled,
      activeOrders: active,
      servedValue: Math.round(revenue * 100) / 100,
      averageServedOrder: served ? Math.round((revenue / served) * 100) / 100 : 0,
      daily,
      truncated: rows.length >= MAX_ROWS,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (cause) {
    console.error("Sales report read failed", cause instanceof Error ? cause.message : "unknown");
    return fail("تعذّر إعداد تقرير المبيعات.", 502);
  }
}
