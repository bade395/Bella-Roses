"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Realtime } from "appwrite";
import { appwriteClient, APPWRITE_DATABASE_ID } from "@/lib/appwrite";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Order = {
  $id: string; order_number: string; table_id: string; status: string;
  subtotal: number; customer_name?: string; notes?: string; $createdAt: string;
};
type OrderItem = {
  $id: string; product_name_ar: string; product_name_en?: string;
  unit_price: number; quantity: number; line_total: number; notes?: string;
};
type Table = { $id: string; table_number: number; label?: string };

const statusLabels: Record<string, string> = {
  new: "جديد", accepted: "تم القبول", preparing: "قيد التحضير",
  ready: "جاهز", served: "تم التقديم", cancelled: "ملغي",
};
const statuses = ["new", "accepted", "preparing", "ready", "served", "cancelled"];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "connected" | "fallback">("connecting");
  const audioContext = useRef<AudioContext | null>(null);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoadComplete = useRef(false);

  const playAlert = useCallback(() => {
    const context = audioContext.current;
    if (!soundEnabled || !context || context.state !== "running") return;
    const now = context.currentTime;
    [880, 660].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.22);
      gain.gain.setValueAtTime(0.0001, now + index * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.22 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.22 + 0.18);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(now + index * 0.22); oscillator.stop(now + index * 0.22 + 0.19);
    });
  }, [soundEnabled]);

  function enableSound() {
    try {
      const Context = window.AudioContext;
      if (!Context) return;
      if (!audioContext.current) audioContext.current = new Context();
      void audioContext.current.resume().then(() => {
        setSoundEnabled(true);
        const ctx = audioContext.current;
        if (!ctx) return;
        const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
        oscillator.frequency.value = 740; gain.gain.value = 0.12;
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(); oscillator.stop(ctx.currentTime + 0.12);
      });
    } catch { setError("المتصفح لا يدعم التنبيه الصوتي."); }
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل الطلبات.");
      const nextOrders = (data.orders ?? []) as Order[];
      if (initialLoadComplete.current) {
        const incoming = nextOrders.filter((order) => order.status === "new" && !knownOrderIds.current.has(order.$id));
        if (incoming.length) playAlert();
      }
      nextOrders.forEach((order) => knownOrderIds.current.add(order.$id));
      initialLoadComplete.current = true;
      setOrders(nextOrders); setTables(data.tables ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تحميل الطلبات.");
    } finally { if (!silent) setLoading(false); }
  }, [router, playAlert]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!appwriteClient) { setLiveStatus("fallback"); return; }
    let active = true;
    let realtime: Realtime | null = null;
    let subscription: { unsubscribe: () => Promise<void> } | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const connect = async () => {
      try {
        const tokenResponse = await fetch("/api/admin/realtime-token", { cache: "no-store" });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.jwt) throw new Error("JWT");
        if (!active) return;
        appwriteClient.setJWT(tokenData.jwt as string);
        if (subscription) await subscription.unsubscribe().catch(() => undefined);
        realtime = new Realtime(appwriteClient);
        subscription = await realtime.subscribe(
          ["tablesdb." + APPWRITE_DATABASE_ID + ".tables.orders.rows"],
          () => { if (active) void load(true); },
        );
        if (active) setLiveStatus("connected");
      } catch {
        if (active) setLiveStatus("fallback");
      }
    };

    void connect();
    refreshTimer = setInterval(() => { void connect(); }, 10 * 60 * 1000);
    pollTimer = setInterval(() => { void load(true); }, 30 * 1000);
    return () => {
      active = false;
      if (refreshTimer) clearInterval(refreshTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (subscription) void subscription.unsubscribe().catch(() => undefined);
      if (realtime) void realtime.disconnect().catch(() => undefined);
      appwriteClient?.setJWT("");
      if (audioContext.current) void audioContext.current.close();
    };
  }, [load]);

  async function openOrder(id: string) {
    setSelected(id); setDetailLoading(true); setItems([]); setError("");
    try {
      const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل تفاصيل الطلب.");
      setItems(data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تحميل التفاصيل.");
    } finally { setDetailLoading(false); }
  }

  async function updateStatus(order: Order, status: string) {
    setSaving(order.$id); setError("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.$id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحديث الحالة.");
      setOrders((current) => current.map((item) => item.$id === order.$id ? { ...item, status } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تحديث الحالة.");
    } finally { setSaving(""); }
  }

  const tableMap = new Map(tables.map((table) => [table.$id, table]));
  const selectedOrder = orders.find((order) => order.$id === selected) ?? null;

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
        <div className="admin-header-actions"><Link className="admin-tables-link" href="/admin">إدارة القائمة</Link><Link className="admin-tables-link" href="/admin/tables">الطاولات و QR</Link></div>
      </header>
      <section className="admin-dashboard-content admin-menu-content">
        <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
        <h1>إدارة الطلبات</h1>
        <p>تابع الطلبات الواردة من الطاولات وحدّث حالتها لحظة بلحظة.</p>
        <div className="admin-stats">
          <div><span>كل الطلبات</span><strong>{orders.length}</strong></div>
          <div><span>طلبات جديدة</span><strong>{orders.filter((order) => order.status === "new").length}</strong></div>
          <div><span>قيد التحضير</span><strong>{orders.filter((order) => order.status === "preparing").length}</strong></div>
        </div>
        {error ? <div className="admin-error-banner" role="alert">{error}</div> : null}
        <div className="admin-list-toolbar">
          <span>آخر 100 طلب · <small className={liveStatus === "connected" ? "orders-live-connected" : "orders-live-fallback"}>{liveStatus === "connected" ? "● متصل لحظيًا" : "● تحديث تلقائي احتياطي"}</small></span>
          <div className="admin-orders-actions"><button type="button" className={soundEnabled ? "orders-sound-enabled" : ""} onClick={enableSound}>{soundEnabled ? "🔔 التنبيه الصوتي مفعّل" : "♬ تفعيل صوت التنبيه"}</button><button type="button" onClick={() => void load()}>↻ تحديث</button></div>
        </div>
        {loading ? <div className="admin-empty-state">جارٍ تحميل الطلبات...</div> : orders.length === 0 ? (
          <div className="admin-empty-state">لا توجد طلبات حتى الآن. ستظهر هنا الطلبات التي يرسلها العملاء من الطاولات.</div>
        ) : (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>رقم الطلب</th><th>الطاولة</th><th>الوقت</th><th>الإجمالي</th><th>الحالة</th><th>التفاصيل</th></tr></thead>
            <tbody>{orders.map((order) => {
              const table = tableMap.get(order.table_id);
              return <tr key={order.$id}>
                <td><strong dir="ltr">{order.order_number}</strong>{order.customer_name ? <small className="admin-order-customer">{order.customer_name}</small> : null}</td>
                <td>{table ? `طاولة ${table.table_number}` : "—"}</td>
                <td dir="ltr">{new Date(order.$createdAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="admin-price">{Number(order.subtotal).toFixed(2)} ر.س</td>
                <td><select className="admin-order-status" value={order.status} disabled={saving === order.$id} onChange={(event) => void updateStatus(order, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></td>
                <td><button className="admin-order-detail-button" type="button" onClick={() => void openOrder(order.$id)}>عرض</button></td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
        <p className="admin-data-note">الأسعار المعروضة هي نسخة محفوظة وقت إنشاء الطلب. تغيير سعر المنتج لاحقًا لا يغيّر الطلبات السابقة.</p>
      </section>
      {selectedOrder ? <div className="cart-backdrop admin-order-backdrop" role="presentation" onClick={() => setSelected(null)}>
        <section className="cart-panel admin-order-panel" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="cart-panel-heading"><div><p className="eyebrow"><span /> ORDER DETAILS</p><h2 id="order-detail-title">طلب {selectedOrder.order_number}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="إغلاق">×</button></div>
          {detailLoading ? <div className="admin-empty-state">جارٍ تحميل التفاصيل...</div> : <>
            <div className="admin-order-meta"><span>الحالة: {statusLabels[selectedOrder.status] ?? selectedOrder.status}</span><strong>{Number(selectedOrder.subtotal).toFixed(2)} ر.س</strong></div>
            {items.map((item) => <div className="admin-order-item" key={item.$id}><div><strong>{item.product_name_ar}</strong><small>{item.quantity} × {Number(item.unit_price).toFixed(2)} ر.س</small>{item.notes ? <p>ملاحظة: {item.notes}</p> : null}</div><b>{Number(item.line_total).toFixed(2)} ر.س</b></div>)}
            {selectedOrder.notes ? <div className="admin-order-notes"><strong>ملاحظات العميل</strong><p>{selectedOrder.notes}</p></div> : null}
          </>}
        </section>
      </div> : null}
    </main>
  );
}
