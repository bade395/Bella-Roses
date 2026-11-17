import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";

const departments = [
  { href: "/admin", icon: "✿", title: "إدارة المنيو", description: "المنتجات والتصنيفات والأسعار", tag: "MENU" },
  { href: "/admin/orders", icon: "⌁", title: "إدارة الطلبات", description: "استقبال الطلبات ومتابعة حالتها", tag: "ORDERS" },
  { href: "/admin/tables", icon: "▦", title: "الطاولات ورموز QR", description: "إدارة الطاولات وروابط قوائم العملاء", tag: "TABLES & QR" },
  { href: "/admin/orders/display", icon: "▣", title: "شاشة عرض الطلبات", description: "شاشة متابعة الطلبات داخل الكافيه", tag: "CAFE DISPLAY" },
];

export default async function AdminHomePage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <main className="admin-dashboard admin-hub-page">
      <header className="admin-dashboard-header">
        <Link className="admin-auth-brand" href="/" aria-label="لوحة تحكم Bella Roses">BELLA ROSES <span>✿</span></Link>
        <div className="admin-header-actions">
          <span className="admin-user-email">{user.email}</span>
          <Link className="admin-tables-link" href="/menu" target="_blank">معاينة صفحة العميل ↗</Link>
          <form action="/api/admin/logout" method="post"><button className="admin-logout" type="submit">تسجيل الخروج</button></form>
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
