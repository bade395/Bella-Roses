import { NextResponse } from "next/server";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) {
    return NextResponse.json({ error: "رمز الطاولة غير صالح." }, { status: 404 });
  }
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) {
    return NextResponse.json({ error: "الخدمة غير متاحة مؤقتًا." }, { status: 503 });
  }

  const query = encodeURIComponent(JSON.stringify({ method: "equal", attribute: "qr_token", values: [token] }));
  const activeQuery = encodeURIComponent(JSON.stringify({ method: "equal", attribute: "is_active", values: [true] }));
  const endpoint = `${APPWRITE_ENDPOINT}/tablesdb/${DATABASE_ID}/tables/restaurant_tables/rows?queries[]=${query}&queries[]=${activeQuery}&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [1] }))}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Key": key },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Public table resolution failed", { status: response.status });
      return NextResponse.json({ error: "تعذّر التحقق من الطاولة." }, { status: 502 });
    }
    const payload = await response.json() as { rows?: Array<{ $id: string; table_number: number; label?: string | null }> };
    const row = payload.rows?.[0];
    if (!row) return NextResponse.json({ error: "رمز الطاولة غير معروف أو الطاولة غير مفعّلة." }, { status: 404 });
    return NextResponse.json({ table: { id: row.$id, table_number: row.table_number, label: row.label ?? "" } });
  } catch {
    return NextResponse.json({ error: "تعذّر التحقق من الطاولة." }, { status: 502 });
  }
}
