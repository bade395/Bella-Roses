import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffUser, STAFF_ROLES, type StaffRole } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TEAM_ID = process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
async function sessionHeaders() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) return null;
  return { "X-Appwrite-Project": APPWRITE_PROJECT_ID, "X-Appwrite-Session": session, "Content-Type": "application/json" };
}
function validRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value) && value !== "owner";
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
async function appwrite(path: string, headers: Record<string, string>, init: RequestInit = {}) {
  return fetch(`${APPWRITE_ENDPOINT}${path}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });
}

export async function GET() {
  const actor = await getStaffUser("staff.manage");
  if (!actor) return fail("غير مصرح بإدارة الموظفين.", 403);
  if (!TEAM_ID) return fail("لم يتم إعداد APPWRITE_STAFF_TEAM_ID بعد.", 503);
  const headers = await sessionHeaders();
  if (!headers) return fail("انتهت جلسة الإدارة.", 401);
  const response = await appwrite(`/teams/${encodeURIComponent(TEAM_ID)}/memberships?queries[]=${encodeURIComponent(JSON.stringify({method:"limit",values:[100]}))}`, headers);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return fail("تعذّر تحميل أعضاء الفريق.", 502);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("مصدر الطلب غير موثوق.", 403);
  const actor = await getStaffUser("staff.manage");
  if (!actor) return fail("غير مصرح بإدارة الموظفين.", 403);
  if (!TEAM_ID) return fail("لم يتم إعداد APPWRITE_STAFF_TEAM_ID بعد.", 503);
  const body = await request.json().catch(() => null) as {email?:unknown; name?:unknown; role?:unknown} | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0,128) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validRole(body?.role)) return fail("البريد الإلكتروني أو الدور غير صالح.");
  const headers = await sessionHeaders();
  if (!headers) return fail("انتهت جلسة الإدارة.", 401);
  const response = await appwrite(`/teams/${encodeURIComponent(TEAM_ID)}/memberships`, headers, {
    method: "POST",
    body: JSON.stringify({ email, name, roles: [body.role], url: new URL("/admin/staff/accept", request.url).toString() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return fail((payload as {message?:string}).message ?? "تعذّر إرسال الدعوة. تأكد أن الحساب الحالي مالك الفريق.", response.status);
  return NextResponse.json(payload, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail("مصدر الطلب غير موثوق.", 403);
  const actor = await getStaffUser("staff.manage");
  if (!actor) return fail("غير مصرح بإدارة الموظفين.", 403);
  if (!TEAM_ID) return fail("لم يتم إعداد APPWRITE_STAFF_TEAM_ID بعد.", 503);
  const body = await request.json().catch(() => null) as {membershipId?:unknown; role?:unknown} | null;
  if (typeof body?.membershipId !== "string" || !/^[A-Za-z0-9._-]{1,36}$/.test(body.membershipId) || !validRole(body.role)) return fail("بيانات تعديل العضوية غير صالحة.");
  const headers = await sessionHeaders();
  if (!headers) return fail("انتهت جلسة الإدارة.", 401);
  const response = await appwrite(`/teams/${encodeURIComponent(TEAM_ID)}/memberships/${encodeURIComponent(body.membershipId)}`, headers, {
    method: "PATCH", body: JSON.stringify({ roles: [body.role] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return fail("تعذّر تعديل دور الموظف.", response.status);
  return NextResponse.json(payload);
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("مصدر الطلب غير موثوق.", 403);
  const actor = await getStaffUser("staff.manage");
  if (!actor) return fail("غير مصرح بإدارة الموظفين.", 403);
  if (!TEAM_ID) return fail("لم يتم إعداد APPWRITE_STAFF_TEAM_ID بعد.", 503);
  const membershipId = new URL(request.url).searchParams.get("membershipId") ?? "";
  if (!/^[A-Za-z0-9._-]{1,36}$/.test(membershipId)) return fail("معرّف العضوية غير صالح.");
  const headers = await sessionHeaders();
  if (!headers) return fail("انتهت جلسة الإدارة.", 401);
  const response = await appwrite(`/teams/${encodeURIComponent(TEAM_ID)}/memberships/${encodeURIComponent(membershipId)}`, headers, { method: "DELETE" });
  if (!response.ok) return fail("تعذّر إيقاف عضوية الموظف.", response.status);
  return NextResponse.json({ success: true });
}
