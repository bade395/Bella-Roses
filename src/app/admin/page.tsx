"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Models } from "appwrite";
import { account,ADMIN_EMAIL } from "@/lib/appwrite";
export default function AdminHomePage(){
 const router=useRouter();const [user,setUser]=useState<Models.User<Models.Preferences>|null>(null);const [checking,setChecking]=useState(true);
 useEffect(()=>{let active=true;async function verify(){if(!account){router.replace("/admin/login");return;}
  try{const current=await account.get();if(current.email.toLowerCase()!==ADMIN_EMAIL){await account.deleteSession({sessionId:"current"});router.replace("/admin/login");return;}if(active)setUser(current);}
  catch{router.replace("/admin/login");}finally{if(active)setChecking(false);}}
  void verify();return()=>{active=false;};
 },[router]);
 async function logout(){if(account)await account.deleteSession({sessionId:"current"}).catch(()=>undefined);router.replace("/admin/login");}
 if(checking||!user)return <main className="admin-auth-page"><p className="admin-auth-copy">جارٍ التحقق من صلاحيات الدخول...</p></main>;
 return <main className="admin-dashboard"><header className="admin-dashboard-header"><Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link><button onClick={logout} className="admin-logout">تسجيل الخروج</button></header>
  <section className="admin-dashboard-content"><p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p><h1>أهلًا بك في لوحة الإدارة</h1><p>تم تسجيل الدخول بصفتك {user.email}.</p>
   <div className="admin-coming-soon"><span>✿</span><h2>لوحة التحكم قيد التجهيز</h2><p>سيتم إضافة إدارة التصنيفات والمنتجات والأسعار والصور والطلبات في الخطوات التالية.</p></div>
  </section></main>;
}