"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Day = { date: string; orders: number; served: number; cancelled: number; revenue: number };
type Report = { rangeDays: number; totalOrders: number; servedOrders: number; cancelledOrders: number; activeOrders: number; servedValue: number; averageServedOrder: number; daily: Day[]; truncated: boolean };

export default function SalesReportsPage() {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (range = days) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/reports?days=${range}`, { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل التقرير.");
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء إعداد التقرير.");
    } finally { setLoading(false); }
  }, [days, router]);

  useEffect(() => { void load(days); }, [load, days]);

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header">
      <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
      <div className="admin-header-actions">
        <Link className="admin-tables-link" href="/admin">إدارة القائمة</Link>
        <Link className="admin-tables-link" href="/admin/orders">الطلبات النشطة</Link>
        <Link className="admin-tables-link" href="/admin/orders/archive">أرشيف الطلبات</Link>
      </div>
    </header>
    <section className="admin-dashboard-content admin-menu-content">
      <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
      <h1>تقارير المبيعات</h1>
      <p>ملخص تشغيلي للطلبات المقدّمة والملغاة والقيمة المرتبطة بالطلبات المقدّمة.</p>
      <div className="admin-menu-tabs report-range-tabs">
        {[7, 30, 90].map((value) => <button type="button" key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value} يوم</button>)}
      </div>
      {error ? <p className="admin-error-banner" role="alert">{error}</p> : null}
      {loading || !report ? <div className="admin-empty-state">جارٍ إعداد التقرير...</div> : <>
        <div className="admin-stats report-stats">
          <div><span>إجمالي الطلبات</span><strong>{report.totalOrders}</strong></div>
          <div><span>الطلبات المقدّمة</span><strong>{report.servedOrders}</strong></div>
          <div><span>الطلبات الملغاة</span><strong>{report.cancelledOrders}</strong></div>
          <div><span>قيد التنفيذ</span><strong>{report.activeOrders}</strong></div>
          <div><span>قيمة الطلبات المقدّمة</span><strong>{report.servedValue.toFixed(2)} <small>ر.س</small></strong></div>
          <div><span>متوسط الطلب المقدّم</span><strong>{report.averageServedOrder.toFixed(2)} <small>ر.س</small></strong></div>
        </div>
        <div className="archive-report-heading"><h2>ملخص يومي</h2><button type="button" onClick={() => void load(days)}>↻ تحديث التقرير</button></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>اليوم</th><th>الطلبات</th><th>المقدّمة</th><th>الملغاة</th><th>قيمة المقدّم</th></tr></thead>
          <tbody>{report.daily.map((day) => <tr key={day.date}><td>{new Date(`${day.date}T12:00:00+03:00`).toLocaleDateString("ar-SA", { dateStyle: "medium" })}</td><td>{day.orders}</td><td>{day.served}</td><td>{day.cancelled}</td><td>{day.revenue.toFixed(2)} ر.س</td></tr>)}</tbody>
        </table></div>
        {report.daily.length === 0 ? <div className="admin-empty-state">لا توجد طلبات خلال هذه الفترة.</div> : null}
        {report.truncated ? <p className="orders-permission-note">التقرير وصل إلى حد القراءة الآمن (5000 طلب). قلّص الفترة للحصول على ملخص كامل.</p> : null}
        <p className="admin-data-note">التقرير يعتمد على تاريخ إنشاء الطلب، ويحتسب قيمة الطلبات التي حالتها «تم التقديم» فقط. لا يُعد هذا إثباتًا للمبالغ المحصّلة؛ لأن الدفع الإلكتروني لم يُفعّل بعد.</p>
      </>}
    </section>
  </main>;
}
