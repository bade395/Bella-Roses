"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Order = { $id: string; order_number: string; table_id: string; status: string; $createdAt: string };
type Table = { $id: string; table_number: number };
const columns = [
  { key: "new", title: "طلبات جديدة", color: "new" },
  { key: "preparing", title: "قيد التحضير", color: "preparing" },
  { key: "ready", title: "جاهزة للاستلام", color: "ready" },
] as const;

export default function OrdersDisplayPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [connected, setConnected] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const data = await response.json();
      if (response.status === 403) { setAccessError("حسابك لا يملك صلاحية عرض شاشة الطلبات."); setConnected(false); return; }
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل الطلبات.");
      setAccessError("");
      setOrders(data.orders ?? []);
      setTables(data.tables ?? []);
      setConnected(true);
    } catch { setConnected(false); }
  }, [router]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 5000);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [load]);

  const tableMap = new Map(tables.map((table) => [table.$id, table.table_number]));
  const activeOrders = orders.filter((order) => ["new", "accepted", "preparing", "ready"].includes(order.status));

  return (
    <main className="orders-display">
      <header className="orders-display-header">
        <div className="orders-display-brand">BELLA ROSES <span>✿</span><small>ORDER BOARD</small></div>
        <div className="orders-display-clock"><strong>{now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</strong><small>{now.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}</small></div>
        <div className={connected ? "orders-display-connection online" : "orders-display-connection"}>{connected ? "● مباشر" : "● جاري إعادة الاتصال"}</div>
      </header>
      <section className="orders-display-intro"><h1>طلباتكم في بيلا روز</h1><p>تابع رقم طلبك — هنكون سعداء بخدمتك</p></section>
      {accessError ? <p className="orders-display-empty" role="alert">{accessError}</p> : null}
      <section className="orders-display-columns">
        {columns.map((column) => {
          const matching = activeOrders.filter((order) => column.key === "preparing" ? ["accepted", "preparing"].includes(order.status) : order.status === column.key);
          return <section className={`orders-display-column ${column.color}`} key={column.key}>
            <header><h2>{column.title}</h2><strong>{matching.length}</strong></header>
            <div className="orders-display-list">
              {matching.map((order) => <article className="orders-display-ticket" key={order.$id}>
                <strong dir="ltr">{order.order_number}</strong>
                <span>طاولة {tableMap.get(order.table_id) ?? "—"}</span>
                <small>{new Date(order.$createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</small>
              </article>)}
              {matching.length === 0 ? <div className="orders-display-empty">لا توجد طلبات هنا حاليًا</div> : null}
            </div>
          </section>;
        })}
      </section>
      <footer className="orders-display-footer"><span>لحظات جميلة تبدأ بتفصيلة ✿</span><button type="button" onClick={() => void document.documentElement.requestFullscreen?.()}>عرض ملء الشاشة ⛶</button></footer>
    </main>
  );
}
