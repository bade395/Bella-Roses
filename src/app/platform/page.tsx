import { redirect } from "next/navigation";
import { getPlatformActor } from "@/lib/bade3/platform-identity";
import PlatformTenants from "./platform-tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const actor = await getPlatformActor();
  if (!actor) redirect("/admin");

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-sm sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-rose-200">BADE3 · PLATFORM CONTROL</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">لوحة مالك منصة bade3</h1>
              <p className="mt-2 text-sm text-slate-300">إدارة مركزية مستقلة عن لوحة تشغيل المطعم.</p>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200">Platform Owner</span>
          </div>
        </header>

        <PlatformTenants />

        <footer className="text-center text-xs text-slate-400">bade3 · Multi-tenant restaurant platform</footer>
      </div>
    </main>
  );
}
