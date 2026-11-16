"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminUser = { id: string; email: string; name: string };

export default function AdminHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json() as Promise<{ user: AdminUser }>;
      })
      .then(result => { if (active) setUser(result.user); })
      .catch(() => { router.replace("/admin/login"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking || !user) {
    return <main className="admin-auth-page"><p className="admin-auth-copy">جارٍ التحقق من صلاحيات الدخول...</p></main>;
  }

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header"><Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link><button onClick={logout} className="admin-logout">تسجيل الخروج</button></header>
    <section className="admin-dashboard-content"><p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p><h1>أهلًا بك في لوحة الإدارة</h1><p>تم التحقق من جلستك وصلاحيات حسابك: {user.email}.</p>
      <div className="admin-coming-soon"><span>✿</span><h2>لوحة التحكم قيد التجهيز</h2><p>تم تجهيز أساس المصادقة الخادمية. ستُبنى وحدات التصنيفات والمنتجات والصور والطلبات فوق هذا الأساس.</p></div>
    </section>
  </main>;
}
