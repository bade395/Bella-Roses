"use client";
import { FormEvent,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ID } from "appwrite";
import { account,ADMIN_EMAIL } from "@/lib/appwrite";
export default function AdminSetupPage(){
 const router=useRouter();const [step,setStep]=useState<"email"|"code">("email");
 const [userId,setUserId]=useState("");const [code,setCode]=useState("");
 const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function sendCode(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");if(!account){setError("إعدادات Appwrite غير مكتملة.");return;}setBusy(true);
  try{const result=await account.createEmailToken({userId:ID.unique(),email:ADMIN_EMAIL});setUserId(result.userId);setStep("code");}
  catch{setError("تعذّر إرسال رمز التفعيل. تأكد من إعداد البريد في Appwrite وأن الحساب غير مسجل مسبقًا.");}
  finally{setBusy(false);}
 }
 async function activate(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");
  if(!account||!userId){setError("ابدأ بطلب رمز تفعيل جديد.");return;}
  if(password.length<8){setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");return;}
  if(password!==confirm){setError("كلمتا المرور غير متطابقتين.");return;}
  setBusy(true);try{await account.createSession({userId,secret:code.trim()});const current=await account.get();
   if(current.email.toLowerCase()!==ADMIN_EMAIL){await account.deleteSession({sessionId:"current"});throw new Error("Unauthorized");}
   await account.updatePassword({password});router.replace("/admin");
  }catch{setError("تعذّر تفعيل الحساب. تأكد من الرمز وأنه لم تنتهِ صلاحيته، ثم حاول مجددًا.");}
  finally{setBusy(false);}
 }
 return <main className="admin-auth-page"><section className="admin-auth-card">
  <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
  <p className="admin-auth-eyebrow">FIRST ADMIN SETUP</p><h1>تفعيل حساب المدير</h1>
  <p className="admin-auth-copy">سنرسل رمز تحقق إلى {ADMIN_EMAIL}، وبعد تأكيده ستنشئ كلمة مرورك الخاصة.</p>
  {step==="email"?<form className="admin-auth-form" onSubmit={sendCode}><button type="submit" disabled={busy}>{busy?"جارٍ إرسال الرمز...":"إرسال رمز التفعيل إلى البريد"}</button></form>:
  <form className="admin-auth-form" onSubmit={activate}>
   <label>رمز التحقق<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required minLength={6}/></label>
   <label>إنشاء كلمة مرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
   <label>تأكيد كلمة المرور<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
   <button type="submit" disabled={busy}>{busy?"جارٍ تفعيل الحساب...":"تأكيد وتفعيل حساب المدير"}</button>
  </form>}
  {error&&<p className="admin-auth-error" role="alert">{error}</p>}
  <Link className="admin-auth-subtle" href="/admin/login">العودة لتسجيل الدخول</Link>
 </section></main>;
}