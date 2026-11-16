"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { account, ADMIN_EMAIL } from "@/lib/appwrite";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,setEmail]=useState(ADMIN_EMAIL);
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setError("");
    if(!account){setError("إعدادات الاتصال بخدمة Appwrite غير مكتملة.");return;}
    if(email.trim().toLowerCase()!==ADMIN_EMAIL){setError("هذا البريد غير مخوّل بالدخول إلى لوحة الإدارة.");return;}
    setBusy(true);
    try{
      await account.createEmailPasswordSession({email:ADMIN_EMAIL,password});
      const user=await account.get();
      if(user.email.toLowerCase()!==ADMIN_EMAIL){await account.deleteSession({sessionId:"current"});throw new Error("Unauthorized");}
      router.replace("/admin");
    }catch{setError("تعذّر تسجيل الدخول. راجع كلمة المرور وحاول مرة أخرى.");}
    finally{setBusy(false);}
  }
  return <main className="admin-auth-page"><section className="admin-auth-card">
    <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
    <p className="admin-auth-eyebrow">PRIVATE ADMINISTRATION</p><h1>مرحبًا بعودتك</h1>
    <p className="admin-auth-copy">سجّل الدخول لإدارة قائمة بيلا روز وطلبات المطعم.</p>
    <form onSubmit={submit} className="admin-auth-form">
      <label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required minLength={8}/></label>
      {error&&<p className="admin-auth-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy?"جارٍ التحقق...":"تسجيل الدخول"}</button>
    </form>
    <div className="admin-auth-links"><Link className="admin-auth-subtle" href="/admin/forgot-password">نسيت كلمة المرور؟</Link><Link className="admin-auth-subtle" href="/admin/setup">تفعيل حساب المدير لأول مرة</Link></div>
    <p className="admin-auth-foot">دخول مخصص لفريق إدارة Bella Roses</p>
  </section></main>;
}