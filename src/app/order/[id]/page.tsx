"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "cancelled";
type TrackedOrder = { order_number: string; status: OrderStatus; table_number: number | null; subtotal: number; created_at: string };
const steps: { key: OrderStatus; title: string; detail: string; icon: string }[] = [
  { key: "new", title: "تم استلام طلبك", detail: "وصل طلبك إلى فريق Bella Roses", icon: "✓" },
  { key: "accepted", title: "تم تأكيد الطلب", detail: "بدأ فريقنا في تجهيز طلبك", icon: "✦" },
  { key: "preparing", title: "قيد التحضير", detail: "نحضّر اختياراتك بعناية", icon: "♨" },
  { key: "ready", title: "طلبك جاهز", detail: "يمكنك الاستمتاع بطلبك الآن", icon: "♡" },
  { key: "served", title: "تم تقديم الطلب", detail: "نتمنى لك وقتًا جميلًا", icon: "✿" },
];

export default function TrackOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notificationMessage, setNotificationMessage] = useState("");
  const previousStatus = useRef<OrderStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر تحميل حالة الطلب.");
      const next = data.order as TrackedOrder;
      if (previousStatus.current && previousStatus.current !== next.status) {
        const title = next.status === "cancelled" ? "تحديث على طلبك" : "تحديث طلب Bella Roses";
        const message = next.status === "cancelled" ? "نأسف، تم إلغاء الطلب. يرجى التواصل مع فريق الكافيه." : (steps.find((step) => step.key === next.status)?.title ?? "تم تحديث حالة طلبك");
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body: message, icon: "/brand/rose-mark.webp", tag: id });
          } catch {
            // Keep order status refresh independent from notification support.
          }
        }
      }
      previousStatus.current = next.status;
      setOrder(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تحميل الطلب.");
    }
  }, [id]);

  useEffect(() => {
    if (!window.isSecureContext || !("Notification" in window) || typeof Notification.requestPermission !== "function") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function enableNotifications() {
    setNotificationMessage("");
    if (!window.isSecureContext || !("Notification" in window) || typeof Notification.requestPermission !== "function") {
      setPermission("unsupported");
      setNotificationMessage("هذا المتصفح لا يدعم إشعارات الويب هنا. افتح رابط المتابعة في متصفح حديث.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        try {
          new Notification("Bella Roses", { body: "تم تفعيل الإشعارات. سننبهك عند تحديث حالة طلبك ما دامت صفحة المتابعة مفتوحة.", icon: "/brand/rose-mark.webp", tag: "bella-order-" + id });
          setNotificationMessage("تم السماح بالإشعارات بنجاح. اترك صفحة متابعة الطلب مفتوحة لتصلك التحديثات.");
        } catch {
          setNotificationMessage("المتصفح حفظ إذن الإشعارات، لكنه لا يعرضها من هذه الصفحة. جرّب فتح الرابط في متصفح آخر.");
        }
      } else if (result === "denied") {
        setNotificationMessage("تم حظر الإشعارات من المتصفح. غيّر إذن الإشعارات لهذا الموقع من إعدادات المتصفح ثم أعد المحاولة.");
      } else {
        setNotificationMessage("لم يتم منح الإذن بعد. اضغط تفعيل الإشعارات واختر سماح.");
      }
    } catch {
      setNotificationMessage("تعذّر طلب الإذن. تأكد من فتح الموقع عبر HTTPS ومن إعدادات الإشعارات في المتصفح.");
      if ("Notification" in window) setPermission(Notification.permission);
    }
  }

  const currentIndex = order ? steps.findIndex((step) => step.key === order.status) : -1;
  const cancelled = order?.status === "cancelled";

  return (
    <main className="track-page">
      <header className="track-header">
        <Link className="admin-auth-brand" href="/menu">BELLA ROSES <span>✿</span></Link>
        <span>ORDER TRACKING</span>
      </header>
      <section className="track-card">
        <p className="admin-auth-eyebrow">YOUR BELLA MOMENT</p>
        <h1>متابعة طلبك</h1>
        {error && !order ? <p className="track-error">{error}</p> : null}
        {order ? <>
          <div className="track-number-label">رقم طلبك</div>
          <div className="track-number" dir="ltr">{order.order_number}</div>
          <p className="track-table">الطاولة {order.table_number ?? "—"} · {order.subtotal.toFixed(2)} ر.س</p>
          <div className={cancelled ? "track-cancelled" : "track-progress"}>
            {cancelled ? <><strong>تم إلغاء الطلب</strong><p>يرجى التحدث إلى أحد أفراد فريق Bella Roses للمساعدة.</p></> : steps.map((step, index) => (
              <div className={index <= currentIndex ? "track-step active" : "track-step"} key={step.key}>
                <span className="track-step-icon">{step.icon}</span>
                <div><strong>{step.title}</strong><small>{step.detail}</small></div>
                <span className="track-step-check">{index < currentIndex ? "✓" : index === currentIndex ? "●" : ""}</span>
              </div>
            ))}
          </div>
          <div className="track-notify">
            <div><strong>خليك على اطلاع</strong><small>فعّل إشعارات المتصفح لتصلك تحديثات الحالة أثناء متابعة الصفحة.</small></div>
            <button type="button" onClick={() => void enableNotifications()} disabled={permission === "granted" || permission === "unsupported"}>{permission === "granted" ? "الإشعارات مفعّلة ✓" : permission === "denied" ? "راجع إعدادات المتصفح" : permission === "unsupported" ? "غير مدعومة على هذا المتصفح" : "تفعيل الإشعارات"}</button>
          </div>
          {notificationMessage ? <p className="track-refresh-note" role="status" aria-live="polite">{notificationMessage}</p> : null}
          <p className="track-refresh-note">تُحدّث الحالة كل 5 ثوانٍ، وتظهر إشعارات التغيير أثناء بقاء صفحة المتابعة مفتوحة.</p>
        </> : !error ? <div className="admin-empty-state">جارٍ تحميل تفاصيل طلبك...</div> : null}
        <Link className="track-home-link" href="/menu">العودة إلى قائمة Bella Roses</Link>
      </section>
    </main>
  );
}
