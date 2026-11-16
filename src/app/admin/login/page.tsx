"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_EMAIL } from "@/lib/appwrite";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذّر تسجيل الدخول.");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="admin-auth-page"><section className="admin-auth-card">
    <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
    <p className="admin-auth-eyebrow">PRIVATE ADMINISTRATION</p><h1>مرحبًا بعودتك</h1>
    <p className="admin-auth-copy">سجّل الدخول لإدارة قائمة بيلا روز وطلبات المطعم.</p>
    <form onSubmit={submit} className="admin-auth-form">
      <label>البريد الإلكتروني<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label>
      <label>كلمة المرور<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required minLength={8}/></label>
      {error && <p className="admin-auth-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "جارٍ التحقق..." : "تسجيل الدخول"}</button>
    </form>
    <div className="admin-auth-links"><Link className="admin-auth-subtle" href="/admin/forgot-password">نسيت كلمة المرور؟</Link><Link className="admin-auth-subtle" href="/admin/setup">تفعيل حساب المدير لأول مرة</Link></div>
    <p className="admin-auth-foot">دخول مخصص لفريق إدارة Bella Roses</p>
  </section></main>;
}
