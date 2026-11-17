"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Order = { $id: string; order_number: string; table_id: string; status: string; subtotal: number; customer_name?: string; notes?: string; $createdAt: string };
type Table = { $id: string; table_number: number };
type Item = { $id: string; product_name_ar: string; quantity: number; unit_price: number; line_total: number; notes?: string };
const labels: Record<string, string> = { served: "تم التقديم", cancelled: "ملغي" };

export default function OrdersArchivePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 50;

  const load = useCallback(async (nextOffset = 0, nextStatus = status) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/orders/archive?status=${nextStatus}&limit=${limit}&offset=${nextOffset}`, { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل الأرشيف.");
      setOrders(data.orders ?? []); setTables(data.tables ?? []); setTotal(data.total ?? 0); setOffset(nextOffset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تحميل الأرشيف.");
    } finally { setLoading(false); }
  }, [router, status]);

  useEffect(() => { void load(0, status); }, [load, status]);

  async function openDetails(order: Order) {
    setSelected(order); setItems([]); setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(order.$id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل تفاصيل الطلب.");
      setItems(data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تحميل التفاصيل.");
    } finally { setDetailLoading(false); }
  }

  const tableMap = useMemo(() => new Map(tables.map((table) => [table.$id, table.table_number])), [tables]);

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header">
      <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
      <div className="admin-header-actions">
        <Link className="admin-tables-link" href="/admin">إدارة القائمة</Link>
        <Link className="admin-tables-link" href="/admin/orders">الطلبات النشطة</Link>
        <Link className="admin-tables-link" href="/admin/reports">تقارير المبيعات</Link>
      </div>
    </header>
    <section className="admin-dashboard-content admin-menu-content">
      <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
      <h1>أرشيف الطلبات</h1>
      <p>كل الطلبات التي تم تقديمها أو إلغاؤها محفوظة هنا للرجوع إليها، دون حذف أي سجل.</p>
      <div className="admin-stats">
        <div><span>إجمالي السجلات</span><strong>{total}</strong></div>
        <div><span>المعروض الآن</span><strong>{orders.length}</strong></div>
        <div><span>الصفحة</span><strong>{Math.floor(offset / limit) + 1}</strong></div>
      </div>
      <div className="admin-list-toolbar archive-toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">كل الطلبات المؤرشفة</option>
          <option value="served">تم التقديم</option>
          <option value="cancelled">ملغاة</option>
        </select>
        <button type="button" onClick={() => void load(offset, status)}>↻ تحديث</button>
      </div>
      {error ? <p className="admin-error-banner" role="alert">{error}</p> : null}
      {loading ? <div className="admin-empty-state">جارٍ تحميل الأرشيف...</div> : orders.length === 0 ? <div className="admin-empty-state">لا توجد طلبات مؤرشفة في هذا الاختيار.</div> : (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>الطاولة</th><th>العميل</th><th>القيمة</th><th>الحالة</th><th>التفاصيل</th></tr></thead>
          <tbody>{orders.map((order) => <tr key={order.$id}>
            <td><strong dir="ltr">{order.order_number}</strong></td>
            <td>{new Date(order.$createdAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td>{tableMap.get(order.table_id) ?? "—"}</td>
            <td>{order.customer_name || "—"}</td>
            <td>{Number(order.subtotal).toFixed(2)} ر.س</td>
            <td><span className={order.status === "served" ? "admin-status" : "admin-status off"}>{labels[order.status] ?? order.status}</span></td>
            <td><button className="archive-detail-button" type="button" onClick={() => void openDetails(order)}>عرض</button></td>
          </tr>)}</tbody>
        </table></div>
      )}
      <div className="archive-pagination">
        <button type="button" disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - limit), status)}>السابق</button>
        <span>{total ? `${offset + 1}–${Math.min(offset + orders.length, total)} من ${total}` : "0 نتائج"}</span>
        <button type="button" disabled={loading || offset + limit >= total} onClick={() => void load(offset + limit, status)}>التالي</button>
      </div>
      <p className="admin-data-note">الأرشيف للعرض والرجوع فقط. لا يتم حذف الطلبات أو تعديل سجلها من هذه الشاشة.</p>
    </section>
    {selected ? <div className="cart-backdrop admin-order-backdrop" role="presentation" onClick={() => setSelected(null)}>
      <section className="cart-panel admin-order-panel" role="dialog" aria-modal="true" aria-labelledby="archive-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="cart-panel-heading"><div><p className="eyebrow"><span /> ORDER ARCHIVE</p><h2 id="archive-detail-title">{selected.order_number}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="إغلاق">×</button></div>
        <div className="admin-order-meta"><span>{labels[selected.status] ?? selected.status}</span><strong>{Number(selected.subtotal).toFixed(2)} ر.س</strong></div>
        {detailLoading ? <div className="admin-empty-state">جارٍ تحميل التفاصيل...</div> : items.map((item) => <div className="admin-order-item" key={item.$id}><div><strong>{item.product_name_ar}</strong><small>{item.quantity} × {Number(item.unit_price).toFixed(2)} ر.س</small>{item.notes ? <p>{item.notes}</p> : null}</div><b>{Number(item.line_total).toFixed(2)} ر.س</b></div>)}
      </section>
    </div> : null}
  </main>;
}
