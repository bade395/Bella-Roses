import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  isAllowedAdmin,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

function readCookieValue(setCookies: string[], names: string[]) {
  for (const name of names) {
    for (const cookie of setCookies) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0 && pair.slice(0, separator).trim() === name) {
        return pair.slice(separator + 1);
      }
    }
  }
  return undefined;
}

function getAppwriteSessionSecret(headers: Headers, projectId: string) {
  const names = [
    `a_session_${projectId}`,
    `a_session_${projectId}_legacy`,
  ];
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = extendedHeaders.getSetCookie?.() ?? [];
  const directValue = readCookieValue(setCookies, names);
  if (directValue) return directValue;

  // Some fetch implementations expose Set-Cookie only as a combined header.
  const combined = headers.get("set-cookie");
  if (!combined) return undefined;

  for (const name of names) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = combined.match(new RegExp(`(?:^|,)\\s*${escapedName}=([^;,\\s]+)`));
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export async function POST(request: Request) {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE || !apiKey) {
    return NextResponse.json({ error: "Server authentication is not configured." }, { status: 503 });
  }

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin) {
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

  let loginResponse: Response;
  try {
    loginResponse = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بخدمة تسجيل الدخول. حاول لاحقًا." }, { status: 502 });
  }

  if (!loginResponse.ok) {
    const errorType = loginResponse.headers.get("x-appwrite-error-type") ?? "unknown";
    console.error("Appwrite admin login rejected", {
      status: loginResponse.status,
      errorType,
    });
    return NextResponse.json({ error: "تعذّر تسجيل الدخول. راجع بياناتك أو إعدادات المصادقة." }, { status: 401 });
  }

  const session = (await loginResponse.json().catch(() => ({}))) as {
    secret?: string;
    expire?: string;
  };

  const sessionSecret =
    session.secret ??
    getAppwriteSessionSecret(loginResponse.headers, APPWRITE_PROJECT_ID);

  if (!sessionSecret) {
    const extendedHeaders = loginResponse.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = extendedHeaders.getSetCookie?.() ?? [];
    console.error("Appwrite admin login returned no session secret", {
      status: loginResponse.status,
      contentType: loginResponse.headers.get("content-type"),
      responseFormat: loginResponse.headers.get("x-appwrite-response-format"),
      cookieNames: setCookies.map((cookie) => cookie.split(";", 1)[0]?.split("=", 1)[0]).filter(Boolean),
      hasCombinedSetCookie: Boolean(loginResponse.headers.get("set-cookie")),
      responseKeys: Object.keys(session),
    });
    return NextResponse.json({ error: "نجح الاتصال بـ Appwrite لكن لم تصل بيانات الجلسة. راجع سجلات الخادم." }, { status: 502 });
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": sessionSecret,
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "تعذّر التحقق من جلسة المدير لدى Appwrite." }, { status: 502 });
  }

  const user = userResponse.ok
    ? (await userResponse.json().catch(() => null)) as { $id?: string; email?: string } | null
    : null;

  if (!user?.$id || (!isAllowedAdmin(user.$id) && !(process.env.APPWRITE_STAFF_TEAM_ID ?? "bella-roses-staff"))) {
    await fetch(`${APPWRITE_ENDPOINT}/account/sessions/current`, {
      method: "DELETE",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": sessionSecret,
      },
      cache: "no-store",
    }).catch(() => undefined);
    return NextResponse.json({ error: "هذا الحساب غير مخوّل بلوحة الإدارة." }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, email: user.email ?? "" });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: session.expire ? new Date(session.expire) : undefined,
  });
  return response;
}
