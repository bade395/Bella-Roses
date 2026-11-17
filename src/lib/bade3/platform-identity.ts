import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from "@/lib/admin-auth";

export type PlatformActor = {
  id: string;
  email: string;
  name: string;
  role: "platform_owner";
};

type AppwriteAccount = { $id?: string; email?: string; name?: string };

function configuredPlatformOwners(): Set<string> {
  return new Set(
    (process.env.BADE3_PLATFORM_OWNER_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/** Platform identity is deliberately separate from every tenant role/team. */
export function isPlatformOwnerId(userId: string): boolean {
  return Boolean(userId) && configuredPlatformOwners().has(userId);
}

export async function getPlatformActor(): Promise<PlatformActor | null> {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !ADMIN_SESSION_COOKIE) return null;

  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  const response = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Session": session,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const account = (await response.json()) as AppwriteAccount;
  if (!account.$id || !isPlatformOwnerId(account.$id)) return null;

  return {
    id: account.$id,
    email: account.email ?? "",
    name: account.name ?? "",
    role: "platform_owner",
  };
}

export async function requirePlatformOwner(): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor) throw new Error("PLATFORM_OWNER_REQUIRED");
  return actor;
}
