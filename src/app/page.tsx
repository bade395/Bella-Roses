import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";

const departments = [
  { href: "/admin", icon: "✿", title: "إدارة المنيو", description: "المنتجات والتصنيفات والأسعار", tag: "MENU" },
  { href: "/admin/orders", icon: "⌁", title: "إدارة الطلبات", description: "استقبال الطلبات ومتابعة حالتها", tag: "ORDERS" },
  { href: "/admin/orders/archive", icon: "▤", title: "أرشيف الطلبات", description: "الطلبات المقدّمة والملغاة وسجل تفاصيلها", tag: "ORDER ARCHIVE" },
  { href: "/admin/reports", icon: "▥", title: "تقارير المبيعات", description: "ملخصات يومية وقيمة الطلبات المقدّمة", tag: "REPORTS" },
  { href: "/admin/tables", icon: "▦", title: "الطاولات ورموز QR", description: "إدارة الطاولات وروابط قوائم العملاء", tag: "TABLES & QR" },
  { href: "/admin/orders/display", icon: "▣", title: "شاشة عرض الطلبات", description: "شاشة متابعة الطلبات داخل الكافيه", tag: "CAFE DISPLAY" },
];

type AdminHomePageProps = {
  searchParams: Promise<{ table?: string | string[] }>;
};

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  // Backward compatibility: QR codes printed before the customer menu moved
  // to /menu still point to /?table=TOKEN. Keep those customer links public.
  const params = await searchParams;
  const tableToken = Array.isArray(params.table) ? params.table[0] : params.table;
  if (tableToken) {
    redirect(`/menu?table=${encodeURIComponent(tableToken)}`);
  }

  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <main className="admin-dashboard admin-hub-page">
      <header className="admin-dashboard-header">
        <Link className="admin-auth-brand" href="/" aria-label="لوحة تحكم Bella Roses">BELLA ROSES <span>✿</span></Link>
        <div className="admin-header-actions">
          <span className="admin-user-email">{user.email}</span>
          <Link className="admin-tables-link" href="/menu" target="_blank">معاينة صفحة العميل ↗</Link>
          <Link className="admin-tables-link" href="/admin">إدارة القائمة</Link>
        </div>
      </header>
      <section className="admin-dashboard-content admin-hub-content">
        <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
        <h1>لوحة الإدارة الرئيسية</h1>
        <p className="admin-hub-intro">كل إدارات بيلا روز في مكان واحد. اختر القسم الذي تريد العمل عليه.</p>
        <div className="admin-department-grid">
          {departments.map((department) => (
            <Link className="admin-department-card" href={department.href} key={department.href}>
              <span className="admin-department-icon" aria-hidden="true">{department.icon}</span>
              <span className="admin-department-tag">{department.tag}</span>
              <strong>{department.title}</strong>
              <small>{department.description}</small>
              <span className="admin-department-open">فتح القسم <b>←</b></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
