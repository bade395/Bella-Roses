import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getStaffContext();
    if (!staff) {
      console.error("[admin/me] Session rejected: getStaffContext returned null", {
        hasAppwriteEndpoint: Boolean(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT),
        hasProjectId: Boolean(process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID),
        hasApiKey: Boolean(process.env.APPWRITE_API_KEY),
        hasDatabaseOverride: Boolean(process.env.BADE3_CORE_DATABASE_ID),
      });
      return NextResponse.json({ error: "تعذّر اعتماد جلسة الإدارة. سجّل الدخول مجددًا، وإذا تكررت المشكلة راجع سجل الخادم." }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({
      user: { id: staff.id, email: staff.email, name: staff.name },
      staff: { role: staff.role, permissions: staff.permissions, membershipId: staff.membershipId },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/me] Permission verification failed", error);
    return NextResponse.json({
      error: "تعذّر إكمال التحقق من صلاحيات الإدارة بسبب خطأ في إعدادات الخادم أو Appwrite.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
