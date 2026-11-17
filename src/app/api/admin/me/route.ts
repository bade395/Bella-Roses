import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    user: { id: staff.id, email: staff.email, name: staff.name },
    staff: { role: staff.role, permissions: staff.permissions, membershipId: staff.membershipId },
  }, { headers: { "Cache-Control": "no-store" } });
}
