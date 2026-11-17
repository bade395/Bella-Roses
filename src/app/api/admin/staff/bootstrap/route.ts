import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffContext } from "@/lib/staff-permissions";

export const runtime = "nodejs";
const TEAM_ID = process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({error:"مصدر الطلب غير موثوق."},{status:403});
  const staff = await getStaffContext();
  if (!staff || staff.role !== "owner") return NextResponse.json({error:"هذه العملية متاحة للمالك فقط."},{status:403});
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session || !APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) return NextResponse.json({error:"انتهت الجلسة."},{status:401});
  const headers = {"X-Appwrite-Project":APPWRITE_PROJECT_ID,"X-Appwrite-Session":session,"Content-Type":"application/json"};
  const existing = await fetch(`${APPWRITE_ENDPOINT}/teams/${TEAM_ID}`,{headers,cache:"no-store"});
  if (existing.ok) return NextResponse.json({success:true,teamId:TEAM_ID,existing:true});
  const response = await fetch(`${APPWRITE_ENDPOINT}/teams`,{
    method:"POST",headers,cache:"no-store",
    body:JSON.stringify({teamId:TEAM_ID,name:"Bella Roses Staff",roles:["owner","manager","cashier","kitchen","service"]})
  });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) return NextResponse.json({error:(payload as {message?:string}).message ?? "تعذّر إنشاء فريق الموظفين."},{status:response.status});
  return NextResponse.json({success:true,teamId:TEAM_ID,team:payload},{status:201});
}
