"use client";

import { useCallback, useEffect, useState } from "react";

type Tenant = {
  id: string;
  name?: string;
  slug?: string;
  status?: string;
  defaultCurrency?: string;
  timezone?: string;
};

type TenantPage = {
  tenants?: Tenant[];
  total?: number;
  totalPages?: number;
  error?: string;
};

function statusLabel(status?: string) {
  if (status === "active") return "نشطة";
  if (status === "suspended") return "موقوفة";
  if (status === "pending") return "قيد الإعداد";
  return status || "غير محدد";
}

export default function PlatformTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTenants = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/platform/tenants?page=${targetPage}`, { cache: "no-store" });
      const payload = await response.json() as TenantPage;
      if (!response.ok) throw new Error(payload.error || "تعذّر تحميل الشركات.");
      setTenants(Array.isArray(payload.tenants) ? payload.tenants : []);
      setPage(Number.isInteger(payload.totalPages) ? targetPage : 1);
      setTotal(Number.isFinite(payload.total) ? Number(payload.total) : 0);
      setTotalPages(Number.isInteger(payload.totalPages) ? Math.max(1, Number(payload.totalPages)) : 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTenants(1); }, [loadTenants]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">الشركات المسجلة</h2>
          <p className="mt-1 text-sm text-slate-500">عرض مركزي للشركات المسجلة على منصة bade3.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadTenants(page)}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "جارٍ التحديث…" : "تحديث القائمة"}
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">إجمالي الشركات</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "—" : total}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">النشطة في الصفحة</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{loading ? "—" : tenants.filter((tenant) => tenant.status === "active").length}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500">قاعدة البيانات</p>
            <p className="mt-1 text-sm font-medium text-slate-800">Shared · Free Tier</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">جارٍ تحميل بيانات الشركات…</div>
        ) : tenants.length === 0 && !error ? (
          <div className="p-8 text-center text-sm text-slate-500">لا توجد شركات مسجلة حتى الآن.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tenants.map((tenant) => (
              <article key={tenant.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{tenant.name || tenant.slug || tenant.id}</h3>
                  <p className="mt-1 text-xs text-slate-500" dir="ltr">{tenant.slug || tenant.id}</p>
                  <p className="mt-1 text-xs text-slate-400">{[tenant.defaultCurrency, tenant.timezone].filter(Boolean).join(" · ") || "لم تُحدد إعدادات المنطقة"}</p>
                </div>
                <span className={tenant.status === "active"
                  ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"}>
                  {statusLabel(tenant.status)}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void loadTenants(page - 1)}
          disabled={loading || page <= 1}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
        >
          السابق
        </button>
        <p className="text-xs tabular-nums text-slate-500">صفحة {page} من {totalPages}</p>
        <button
          type="button"
          onClick={() => void loadTenants(page + 1)}
          disabled={loading || page >= totalPages}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
        >
          التالي
        </button>
      </div>

      <p className="text-xs leading-6 text-slate-500">
        هذه شاشة قراءة فقط في المرحلة الحالية. إنشاء الشركات وتغيير حالتها وإدارة الاشتراكات ستُفعّل بعد اكتمال اختبارات العزل والتدقيق والصلاحيات.
      </p>
    </section>
  );
}
