"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Channel, Realtime } from "appwrite";
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
  new: "طلب جديد", accepted: "تم القبول", preparing: "قيد التحضير",
  ready: "جاهز للاستلام", served: "تم التقديم", cancelled: "ملغي",
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
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [liveStatus, setLiveStatus] = useState<"connecting" | "connected" | "fallback">("connecting");
  const audioContext = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoadComplete = useRef(false);

  const playAlert = useCallback(() => {
    const context = audioContext.current;
    if (!soundEnabledRef.current || !context || context.state !== "running") return;
    const now = context.currentTime;
    [880, 660, 880].forEach((frequency, index) => {
      const start = now + index * 0.24;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل الطلبات.");
      const nextOrders = (data.orders ?? []) as Order[];
      if (initialLoadComplete.current) {
        const incoming = nextOrders.filter((order) => order.status === "new" && !knownOrderIds.current.has(order.$id));
        if (incoming.length) {
          playAlert();
          if ("Notification" in window && Notification.permission === "granted") {
            incoming.forEach((order) => new Notification(`طلب جديد ${order.order_number}`, {
              body: `وصل طلب جديد من طاولة ${data.tables?.find((table: Table) => table.$id === order.table_id)?.table_number ?? "—"}`,
              tag: order.$id,
              icon: "/favicon.ico",
            }));
          }
        }
      }
      nextOrders.forEach((order) => knownOrderIds.current.add(order.$id));
      initialLoadComplete.current = true;
      setOrders(nextOrders);
      setTables(data.tables ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تحميل الطلبات.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [playAlert, router]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    const client = appwriteClient;
    if (!client) { setLiveStatus("fallback"); return; }
    let active = true;
    let realtime: Realtime | null = null;
    let subscription: { unsubscribe: () => Promise<void> } | null = null;

    const connect = async () => {
      try {
        const tokenResponse = await fetch("/api/admin/realtime-token", { cache: "no-store" });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.jwt) throw new Error("JWT");
        if (!active) return;
        client.setJWT(tokenData.jwt as string);
        if (subscription) await subscription.unsubscribe().catch(() => undefined);
        realtime = new Realtime(client);
        subscription = await realtime.subscribe(
          Channel.tablesdb(APPWRITE_DATABASE_ID).table("orders").row(),
          () => { if (active) void load(true); },
        );
        if (active) setLiveStatus("connected");
      } catch {
        if (active) setLiveStatus("fallback");
      }
    };

    void connect();
    const refreshTimer = window.setInterval(() => void connect(), 10 * 60 * 1000);
    const pollTimer = window.setInterval(() => void load(true), 12 * 1000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(pollTimer);
      if (subscription) void subscription.unsubscribe().catch(() => undefined);
      if (realtime) void realtime.disconnect().catch(() => undefined);
      client.setJWT("");
    };
  }, [load]);

  useEffect(() => () => {
    if (audioContext.current) void audioContext.current.close();
  }, []);

  async function enableAlerts() {
    try {
      const Context = window.AudioContext;
      if (Context) {
        if (!audioContext.current || audioContext.current.state === "closed") audioContext.current = new Context();
        await audioContext.current.resume();
        soundEnabledRef.current = true;
        setSoundEnabled(true);
        playAlert();
      }
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
    } catch {
      setError("تعذّر تفعيل الصوت. تأكد من إعدادات الصوت في المتصفح.");
    }
  }

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
      if (status === "served" || status === "cancelled") setSelected((current) => current === order.$id ? null : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تحديث الحالة.");
    } finally { setSaving(""); }
  }

  const tableMap = new Map(tables.map((table) => [table.$id, table]));
  const activeOrders = orders.filter((order) => !["served", "cancelled"].includes(order.status));
  const selectedOrder = orders.find((order) => order.$id === selected) ?? null;

  return (
    <main className="admin-dashboard admin-orders-dashboard">
      <header className="admin-dashboard-header">
        <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
        <div className="admin-header-actions">
          <Link className="admin-tables-link" href="/admin">إدارة القائمة</Link>
          <Link className="admin-tables-link" href="/admin/tables">الطاولات و QR</Link>
          <Link className="admin-tables-link" href="/admin/orders/display">شاشة عرض الكافيه ↗</Link>
        </div>
      </header>
      <section className="admin-dashboard-content admin-menu-content admin-orders-content">
        <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
        <div className="orders-page-title"><div><h1>مركز متابعة الطلبات</h1><p>كل طلب واضح، وكل تحديث في مكانه.</p></div><span className={liveStatus === "connected" ? "orders-live-connected" : "orders-live-fallback"}>{liveStatus === "connected" ? "● متصل لحظيًا" : "● تحديث تلقائي احتياطي"}</span></div>
        <div className="admin-stats">
          <div><span>الطلبات النشطة</span><strong>{orders.filter((order) => !["served", "cancelled"].includes(order.status)).length}</strong></div>
          <div><span>طلبات جديدة</span><strong>{orders.filter((order) => order.status === "new").length}</strong></div>
          <div><span>قيد التحضير</span><strong>{orders.filter((order) => ["accepted", "preparing"].includes(order.status)).length}</strong></div>
        </div>
        {error ? <div className="admin-error-banner" role="alert">{error}</div> : null}
        <div className="orders-control-bar">
          <div><strong>تنبيهات الطلبات</strong><small>فعّلها مرة واحدة بعد فتح لوحة الإدارة للسماح بالصوت وإشعارات المتصفح.</small></div>
          <div className="admin-orders-actions">
            <button type="button" className={soundEnabled ? "orders-sound-enabled" : ""} onClick={() => void enableAlerts()}>{soundEnabled ? "🔔 الصوت مفعّل" : "♬ تفعيل الصوت والإشعارات"}</button>
            <button type="button" onClick={() => void load()}>↻ تحديث</button>
          </div>
        </div>
        {notificationPermission === "denied" ? <p className="orders-permission-note">إشعارات المتصفح محظورة حاليًا. اسمح بها من إعدادات الموقع في المتصفح.</p> : null}
        {loading ? <div className="admin-empty-state">جارٍ تحميل الطلبات...</div> : activeOrders.length === 0 ? (
          <div className="admin-empty-state">لا توجد طلبات نشطة حاليًا. ستظهر هنا الطلبات الجديدة وقيد التنفيذ فقط.</div>
        ) : (
          <div className="orders-card-grid">
            {activeOrders.map((order) => {
              const table = tableMap.get(order.table_id);
              return <article className={`orders-admin-card status-${order.status}`} key={order.$id}>
                <div className="orders-admin-card-top"><span className={`orders-status-pill status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span><small>{new Date(order.$createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</small></div>
                <strong className="orders-admin-number" dir="ltr">{order.order_number}</strong>
                <div className="orders-admin-meta"><span>طاولة {table?.table_number ?? "—"}</span><span>{order.customer_name || "عميل بيلا روز"}</span></div>
                <div className="orders-admin-total">{Number(order.subtotal).toFixed(2)} <small>ر.س</small></div>
                <label className="orders-admin-status-control">حالة الطلب
                  <select className="admin-order-status" value={order.status} disabled={saving === order.$id} onChange={(event) => void updateStatus(order, event.target.value)}>
                    {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </label>
                <button className="admin-order-detail-button orders-detail-wide" type="button" onClick={() => void openOrder(order.$id)}>عرض تفاصيل الطلب</button>
              </article>;
            })}
          </div>
        )}
        <p className="admin-data-note">الطلبات مرتبة من الأحدث إلى الأقدم. عند التسليم أو الإلغاء يختفي الطلب من هذه الشاشة تلقائيًا، مع الاحتفاظ بسجله في قاعدة البيانات.</p>
      </section>
      {selectedOrder ? <div className="cart-backdrop admin-order-backdrop" role="presentation" onClick={() => setSelected(null)}>
        <section className="cart-panel admin-order-panel" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="cart-panel-heading"><div><p className="eyebrow"><span /> ORDER DETAILS</p><h2 id="order-detail-title">{selectedOrder.order_number}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="إغلاق">×</button></div>
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
