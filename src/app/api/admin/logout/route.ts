import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { PLATFORM_SUPPORT_COOKIE } from "@/lib/bade3/platform-support";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const secret = ADMIN_SESSION_COOKIE
    ? cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    : undefined;

  if (secret && APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID) {
    await fetch(`${APPWRITE_ENDPOINT}/account/sessions/current`, {
      method: "DELETE",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": secret,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  if (ADMIN_SESSION_COOKIE) {
    response.cookies.set(ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  response.cookies.set(PLATFORM_SUPPORT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
