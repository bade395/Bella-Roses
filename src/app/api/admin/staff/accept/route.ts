import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
const TEAM_ID = process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({error:"مصدر الطلب غير موثوق."},{status:403});
  const body = await request.json().catch(()=>null) as {userId?:unknown;secret?:unknown;membershipId?:unknown;teamId?:unknown} | null;
  if (body?.teamId !== TEAM_ID || typeof body.userId !== "string" || typeof body.secret !== "string" || typeof body.membershipId !== "string") {
    return NextResponse.json({error:"رابط الدعوة غير صالح."},{status:400});
  }
  const store = await cookies();
  const session = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) return NextResponse.json({error:"سجّل الدخول بالحساب المدعو أولًا."},{status:401});
  const headers = {"X-Appwrite-Project":APPWRITE_PROJECT_ID,"X-Appwrite-Session":session,"Content-Type":"application/json"};
  const account = await fetch(`${APPWRITE_ENDPOINT}/account`,{headers,cache:"no-store"});
  const user = account.ok ? await account.json() as {$id?:string} : null;
  if (!user?.$id || user.$id !== body.userId) return NextResponse.json({error:"يجب قبول الدعوة بالحساب الذي استلمها."},{status:403});
  const response = await fetch(`${APPWRITE_ENDPOINT}/teams/${TEAM_ID}/memberships/${encodeURIComponent(body.membershipId)}`,{
    method:"PATCH",headers,cache:"no-store",body:JSON.stringify({userId:body.userId,secret:body.secret})
  });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) return NextResponse.json({error:(payload as {message?:string}).message ?? "تعذّر قبول الدعوة."},{status:response.status});
  return NextResponse.json({success:true});
}
