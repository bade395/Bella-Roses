import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  isAllowedAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE) {
    return NextResponse.json({ error: "Server authentication is not configured." }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 256) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const loginResponse = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!loginResponse.ok) {
    return NextResponse.json({ error: "تعذّر تسجيل الدخول. راجع بياناتك وحاول مرة أخرى." }, { status: 401 });
  }

  const session = (await loginResponse.json()) as {
    secret?: string;
    expire?: string;
  };

  if (!session.secret) {
    return NextResponse.json({ error: "تعذّر إنشاء جلسة آمنة." }, { status: 502 });
  }

  const userResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Session": session.secret,
    },
    cache: "no-store",
  });

  const user = userResponse.ok
    ? (await userResponse.json()) as { $id?: string; email?: string }
    : null;

  if (!user?.$id || !isAllowedAdmin(user.$id)) {
    await fetch(`${APPWRITE_ENDPOINT}/account/sessions/current`, {
      method: "DELETE",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": session.secret,
      },
      cache: "no-store",
    }).catch(() => undefined);
    return NextResponse.json({ error: "هذا الحساب غير مخوّل بلوحة الإدارة." }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, email: user.email ?? "" });
  response.cookies.set(ADMIN_SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expire ? new Date(session.expire) : undefined,
  });
  return response;
}
