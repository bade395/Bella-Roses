import { cookies } from "next/headers";

export const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
export const APPWRITE_PROJECT_ID =
  process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

export const ADMIN_SESSION_COOKIE = APPWRITE_PROJECT_ID
  ? `a_session_${APPWRITE_PROJECT_ID}`
  : "";

const DEFAULT_ADMIN_USER_ID = "6afadf0e0017f0c448ff";

export function isAllowedAdmin(userId: string) {
  const configured = process.env.APPWRITE_ADMIN_USER_IDS;
  const allowed = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [DEFAULT_ADMIN_USER_ID];
  return allowed.includes(userId);
}

export async function getAdminUser() {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionSecret = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionSecret) return null;

  const response = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Session": sessionSecret,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const user = (await response.json()) as {
    $id?: string;
    email?: string;
    name?: string;
  };

  if (!user.$id || !isAllowedAdmin(user.$id)) return null;

  return { id: user.$id, email: user.email ?? "", name: user.name ?? "" };
}
