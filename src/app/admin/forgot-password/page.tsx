"use client";
import { FormEvent,useState } from "react";
import Link from "next/link";
import { account,ADMIN_EMAIL } from "@/lib/appwrite";
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState(ADMIN_EMAIL),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setMessage("");
  if(!account){setError("إعدادات الاتصال بخدمة Appwrite غير مكتملة.");return;}
  if(email.trim().toLowerCase()!==ADMIN_EMAIL){setError("هذا البريد غير مسجّل كمسؤول للمشروع.");return;}
  setBusy(true);try{await account.createRecovery({email:ADMIN_EMAIL,url:`${window.location.origin}/admin/reset-password`});setMessage("إذا كان الحساب موجودًا، ستصلك رسالة تحتوي على رابط آمن لإعادة تعيين كلمة المرور.");}
  catch{setError("تعذّر إرسال رسالة الاستعادة. تأكد من إعداد البريد في Appwrite وحاول مجددًا.");}finally{setBusy(false);}
 }
 return <main className="admin-auth-page"><section className="admin-auth-card">
  <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link><p className="admin-auth-eyebrow">ACCOUNT RECOVERY</p><h1>استعادة كلمة المرور</h1>
  <p className="admin-auth-copy">أدخل بريد المدير وسنرسل رابطًا آمنًا لإعادة تعيين كلمة المرور.</p>
  <form onSubmit={submit} className="admin-auth-form"><label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
   {error&&<p className="admin-auth-error" role="alert">{error}</p>}{message&&<p className="admin-auth-success" role="status">{message}</p>}
   <button type="submit" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال رابط الاستعادة"}</button>
  </form><Link className="admin-auth-subtle" href="/admin/login">العودة لتسجيل الدخول</Link>
 </section></main>;
}