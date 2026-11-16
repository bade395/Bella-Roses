"use client";
import { FormEvent,Suspense,useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { account,ADMIN_EMAIL } from "@/lib/appwrite";
function ResetForm(){
 const params=useSearchParams(),userId=params.get("userId")??"",secret=params.get("secret")??"";
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setMessage("");
  if(!account||!userId||!secret){setError("رابط الاستعادة غير مكتمل أو منتهي الصلاحية. اطلب رابطًا جديدًا.");return;}
  if(password.length<8){setError("يجب ألا تقل كلمة المرور عن 8 أحرف.");return;}
  if(password!==confirm){setError("كلمتا المرور غير متطابقتين.");return;}
  setBusy(true);try{await account.updateRecovery({userId,secret,password});setMessage("تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.");setPassword("");setConfirm("");}
  catch{setError("تعذّر تحديث كلمة المرور. قد يكون الرابط منتهي الصلاحية؛ اطلب رابطًا جديدًا.");}finally{setBusy(false);}
 }
 return <main className="admin-auth-page"><section className="admin-auth-card">
  <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link><p className="admin-auth-eyebrow">SECURE PASSWORD RESET</p><h1>كلمة مرور جديدة</h1>
  <p className="admin-auth-copy">أنشئ كلمة مرور قوية لحساب المدير {ADMIN_EMAIL}.</p>
  <form onSubmit={submit} className="admin-auth-form">
   <label>كلمة المرور الجديدة<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
   <label>تأكيد كلمة المرور<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
   {error&&<p className="admin-auth-error" role="alert">{error}</p>}{message&&<p className="admin-auth-success" role="status">{message}</p>}
   <button type="submit" disabled={busy||!userId||!secret}>{busy?"جارٍ الحفظ...":"حفظ كلمة المرور"}</button>
  </form><Link className="admin-auth-subtle" href="/admin/login">العودة لتسجيل الدخول</Link>
 </section></main>;
}
export default function ResetPasswordPage(){return <Suspense fallback={<main className="admin-auth-page"><p>جارٍ تحميل الصفحة...</p></main>}><ResetForm/></Suspense>;}