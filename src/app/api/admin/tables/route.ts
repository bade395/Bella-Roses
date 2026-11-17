import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffUser } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const TABLE_ID = "restaurant_tables";

type TableRow = {
  $id: string;
  table_number: number;
  label?: string | null;
  qr_token: string;
  is_active?: boolean;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function newQrToken() {
  return randomBytes(24).toString("base64url");
}

async function callAppwrite(path: string, init: RequestInit = {}) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) {
    throw new Error("SERVER_CONFIG");
  }
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    ...init,
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": key,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function GET() {
  const admin = await getStaffUser("tables.manage");
  if (!admin) return jsonError("يلزم تسجيل الدخول لإدارة الطاولات.", 401);

  try {
    const queries = [
      { method: "orderAsc", attribute: "table_number" },
      { method: "limit", values: [100] },
    ];
    const query = queries.map((item) => `queries[]=${encodeURIComponent(JSON.stringify(item))}`).join("&");
    const { response, payload } = await callAppwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows?${query}`,
    );
    if (!response.ok) {
      console.error("Appwrite table list failed", { status: response.status });
      return jsonError("تعذّر تحميل الطاولات من قاعدة البيانات.", 502);
    }
    return NextResponse.json({ rows: (payload.rows ?? []) as TableRow[] });
  } catch (error) {
    console.error("Admin table list failed", error instanceof Error ? error.message : "unknown");
    return jsonError("حدث خطأ أثناء تحميل الطاولات.", 500);
  }
}

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("طلب غير مسموح.", 403);
  const admin = await getStaffUser("tables.manage");
  if (!admin) return jsonError("انتهت جلسة الإدارة. سجّل الدخول مجددًا.", 401);

  const body = await request.json().catch(() => null) as { table_number?: unknown; label?: unknown } | null;
  if (!body) return jsonError("بيانات الطلب غير صالحة.");
  const tableNumber = Number(body.table_number);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 9999) {
    return jsonError("رقم الطاولة يجب أن يكون عددًا صحيحًا من 1 إلى 9999.");
  }
  if (body.label !== undefined && typeof body.label !== "string") return jsonError("اسم الطاولة غير صالح.");
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (label.length > 80) return jsonError("اسم الطاولة يجب ألا يتجاوز 80 حرفًا.");

  try {
    const { response, payload } = await callAppwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows`,
      {
        method: "POST",
        body: JSON.stringify({
          rowId: randomUUID(),
          data: { table_number: tableNumber, label, qr_token: newQrToken(), is_active: true },
          permissions: [],
        }),
      },
    );
    if (!response.ok) {
      if (response.status === 409) return jsonError("رقم الطاولة مستخدم بالفعل. اختر رقمًا آخر.", 409);
      console.error("Appwrite table create failed", { status: response.status, type: payload.type });
      return jsonError("تعذّرت إضافة الطاولة.", 502);
    }
    return NextResponse.json({ row: payload }, { status: 201 });
  } catch (error) {
    console.error("Admin table create failed", error instanceof Error ? error.message : "unknown");
    return jsonError("حدث خطأ أثناء إضافة الطاولة.", 500);
  }
}

export async function PATCH(request: Request) {
  if (!(await isSameOrigin(request))) return jsonError("طلب غير مسموح.", 403);
  const admin = await getStaffUser("tables.manage");
  if (!admin) return jsonError("انتهت جلسة الإدارة. سجّل الدخول مجددًا.", 401);

  const body = await request.json().catch(() => null) as {
    id?: unknown; label?: unknown; is_active?: unknown; rotate_qr?: unknown;
  } | null;
  if (!body || typeof body.id !== "string" || !/^[a-zA-Z0-9._-]{1,36}$/.test(body.id)) {
    return jsonError("معرّف الطاولة غير صالح.");
  }
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.trim().length > 80) return jsonError("اسم الطاولة غير صالح.");
    data.label = body.label.trim();
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") return jsonError("حالة الطاولة غير صالحة.");
    data.is_active = body.is_active;
  }
  if (body.rotate_qr !== undefined) {
    if (body.rotate_qr !== true) return jsonError("طلب تجديد رمز QR غير صالح.");
    data.qr_token = newQrToken();
  }
  if (Object.keys(data).length === 0) return jsonError("لا توجد تغييرات للحفظ.");

  try {
    const { response, payload } = await callAppwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(body.id)}`,
      { method: "PATCH", body: JSON.stringify({ data }) },
    );
    if (!response.ok) {
      console.error("Appwrite table update failed", { status: response.status, type: payload.type });
      return jsonError(response.status === 404 ? "الطاولة غير موجودة." : "تعذّر حفظ تعديلات الطاولة.", response.status === 404 ? 404 : 502);
    }
    return NextResponse.json({ row: payload });
  } catch (error) {
    console.error("Admin table update failed", error instanceof Error ? error.message : "unknown");
    return jsonError("حدث خطأ أثناء تعديل الطاولة.", 500);
  }
}
