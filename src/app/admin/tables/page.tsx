"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

type RestaurantTable = {
  $id: string;
  table_number: number;
  label?: string;
  qr_token: string;
  is_active?: boolean;
};

export default function AdminTablesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/admin/me", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json();
      })
      .then(() => setChecking(false))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/tables", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذّر تحميل الطاولات.");
      setTables(result.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل الطاولات.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!checking) void loadTables();
  }, [checking, loadTables]);

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: Number(tableNumber), label }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذّرت إضافة الطاولة.");
      setTableNumber("");
      setLabel("");
      setNotice("تمت إضافة الطاولة وإنشاء رمز QR خاص بها.");
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّرت إضافة الطاولة.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTable(id: string, changes: Record<string, unknown>, success: string) {
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "تعذّر تحديث الطاولة.");
      return;
    }
    setNotice(success);
    await loadTables();
  }

  function copyQrLink(token: string) {
    const url = `${origin}/?table=${encodeURIComponent(token)}`;
    void navigator.clipboard.writeText(url).then(
      () => setNotice("تم نسخ رابط QR."),
      () => setError("تعذّر نسخ الرابط من المتصفح."),
    );
  }

  function editLabel(table: RestaurantTable) {
    const next = window.prompt("اسم أو وصف الطاولة:", table.label ?? "");
    if (next === null) return;
    void updateTable(table.$id, { label: next }, "تم تحديث اسم الطاولة.");
  }

  if (checking) {
    return <main className="admin-auth-page"><p className="admin-auth-copy">جارٍ التحقق من صلاحيات الدخول...</p></main>;
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
        <Link className="admin-secondary-button" href="/admin">العودة لإدارة المنيو</Link>
      </header>
      <section className="admin-dashboard-content admin-tables-page">
        <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
        <h1>إدارة الطاولات ورموز QR</h1>
        <p>أنشئ رمزًا مستقلًا لكل طاولة. عند مسحه يفتح المنيو مع التعرّف على الطاولة.</p>

        {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
        {error ? <p className="admin-error-banner" role="alert">{error}</p> : null}

        <form className="admin-editor admin-table-create" onSubmit={createTable}>
          <h2>إضافة طاولة جديدة</h2>
          <div className="admin-form-grid">
            <label>رقم الطاولة
              <input required type="number" min="1" max="9999" step="1" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} />
            </label>
            <label>اسم أو وصف الطاولة (اختياري)
              <input maxLength={80} placeholder="مثال: الصالة الرئيسية" value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
          </div>
          <div className="admin-editor-actions">
            <button className="admin-primary-button" disabled={saving}>{saving ? "جارٍ الإضافة..." : "＋ إنشاء الطاولة ورمز QR"}</button>
          </div>
        </form>

        <div className="admin-tables-heading">
          <h2>الطاولات المسجلة</h2>
          <button className="admin-secondary-button" onClick={() => void loadTables()}>↻ تحديث</button>
        </div>

        {loading ? <div className="admin-empty-state">جارٍ تحميل الطاولات...</div> : tables.length === 0 ? (
          <div className="admin-empty-state">لم تتم إضافة طاولات بعد. ابدأ بإضافة أول طاولة من النموذج أعلاه.</div>
        ) : (
          <div className="admin-tables-grid">
            {tables.map((table) => {
              const url = `${origin}/?table=${encodeURIComponent(table.qr_token)}`;
              return (
                <article className={table.is_active === false ? "admin-table-card inactive" : "admin-table-card"} key={table.$id}>
                  <div className="admin-table-card-heading">
                    <div>
                      <strong>طاولة {table.table_number}</strong>
                      <small>{table.label || "بدون اسم إضافي"}</small>
                    </div>
                    <span className={table.is_active === false ? "admin-status off" : "admin-status"}>{table.is_active === false ? "متوقفة" : "نشطة"}</span>
                  </div>
                  <div className="admin-table-qr">
                    <QRCodeSVG value={url} size={148} level="M" includeMargin />
                    <small>امسح الرمز لفتح منيو هذه الطاولة</small>
                  </div>
                  <div className="admin-table-card-actions">
                    <button onClick={() => copyQrLink(table.qr_token)}>نسخ الرابط</button>
                    <button onClick={() => editLabel(table)}>تعديل الاسم</button>
                    <button onClick={() => void updateTable(table.$id, { is_active: table.is_active === false }, table.is_active === false ? "تم تفعيل الطاولة." : "تم إيقاف الطاولة.")}>{table.is_active === false ? "تفعيل" : "إيقاف"}</button>
                    <button onClick={() => {
                      if (window.confirm("سيُبطل هذا الرمز القديم ويُنشئ رمزًا جديدًا. هل تريد المتابعة؟")) {
                        void updateTable(table.$id, { rotate_qr: true }, "تم تجديد رمز QR وإبطال الرابط السابق.");
                      }
                    }}>تجديد QR</button>
                  </div>
                  <p className="admin-table-url" dir="ltr">{url}</p>
                </article>
              );
            })}
          </div>
        )}
        <p className="admin-data-note">رموز QR تستخدم معرفات عشوائية غير متسلسلة. إيقاف الطاولة أو تجديد الرمز يعطّل الرابط القديم فورًا.</p>
      </section>
    </main>
  );
}
