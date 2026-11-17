import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffUser } from "@/lib/staff-permissions";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getStaffUser("orders.read");
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
    return NextResponse.json({ error: "انتهت جلسة الإدارة." }, { status: 401 });
  }

  try {
    const response = await fetch(`${APPWRITE_ENDPOINT}/account/jwts`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": session,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { jwt?: string; message?: string };
    if (!response.ok || !payload.jwt) {
      console.error("Admin realtime JWT creation failed", { status: response.status, message: payload.message });
      return NextResponse.json({ error: "تعذّر تفعيل الاتصال اللحظي." }, { status: 502 });
    }
    return NextResponse.json({ jwt: payload.jwt }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (cause) {
    console.error("Admin realtime token failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "تعذّر تفعيل الاتصال اللحظي." }, { status: 502 });
  }
}
