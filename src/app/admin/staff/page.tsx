"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Staff = { id:string; email:string; name:string; role:string; membershipId:string; confirm?:boolean; joined?:string|null };
const roles = [
  {value:"manager",label:"مدير"},
  {value:"cashier",label:"كاشير"},
  {value:"kitchen",label:"المطبخ"},
  {value:"service",label:"مقدم خدمة"},
] as const;
const roleName = (role:string) => roles.find(item=>item.value===role)?.label ?? role;

export default function StaffManagementPage() {
  const router=useRouter();
  const [role,setRole]=useState("owner");
  const [canManage,setCanManage]=useState(false);
  const [teamReady,setTeamReady]=useState(false);
  const [rows,setRows]=useState<Staff[]>([]);
  const [email,setEmail]=useState("");
  const [name,setName]=useState("");
  const [newRole,setNewRole]=useState("cashier");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const request=useCallback(async(url:string,init?:RequestInit)=>{
    const response=await fetch(url,{cache:"no-store",...init});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error ?? "تعذّر تنفيذ العملية.");
    return data;
  },[]);

  const load=useCallback(async()=>{
    setError("");
    try {
      const me=await request("/api/admin/me");
      setRole(me.staff?.role ?? "staff");
      setCanManage((me.staff?.permissions ?? []).includes("staff.manage"));
      if((me.staff?.permissions ?? []).includes("staff.manage")){
        const data=await request("/api/admin/staff");
        setRows(data.memberships ?? []);
        setTeamReady(true);
      }
    } catch(e) {
      const message=e instanceof Error?e.message:"تعذّر تحميل البيانات.";
      if(message==="Unauthorized") router.replace("/admin/login");
      else setError(message);
    }
  },[request,router]);

  useEffect(()=>{void load();},[load]);

  async function bootstrap(){
    setBusy(true);setError("");setNotice("");
    try { await request("/api/admin/staff/bootstrap",{method:"POST"});setNotice("تم تجهيز فريق الموظفين. يمكنك الآن إرسال الدعوات.");await load(); }
    catch(e){setError(e instanceof Error?e.message:"تعذّر تجهيز الفريق.");}
    finally{setBusy(false);}
  }

  async function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      await request("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,name,role:newRole})});
      setEmail("");setName("");setNotice("تم إرسال دعوة الانضمام بالبريد الإلكتروني.");await load();
    } catch(e){setError(e instanceof Error?e.message:"تعذّر إرسال الدعوة.");}
    finally{setBusy(false);}
  }

  async function changeRole(member:Staff,next:string){
    setBusy(true);setError("");setNotice("");
    try { await request("/api/admin/staff",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({membershipId:member.$id ?? member.membershipId,role:next})});setNotice("تم تحديث دور الموظف.");await load(); }
    catch(e){setError(e instanceof Error?e.message:"تعذّر تحديث الدور.");}
    finally{setBusy(false);}
  }

  async function remove(member:Staff){
    if(!window.confirm("سيتم إلغاء عضوية هذا الموظف ومنعه من دخول لوحة الإدارة. متابعة؟"))return;
    setBusy(true);setError("");setNotice("");
    try { await request(`/api/admin/staff?membershipId=${encodeURIComponent(member.$id ?? member.membershipId)}`,{method:"DELETE"});setNotice("تم إيقاف عضوية الموظف.");await load(); }
    catch(e){setError(e instanceof Error?e.message:"تعذّر إيقاف العضوية.");}
    finally{setBusy(false);}
  }

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const userId=params.get("userId"),secret=params.get("secret"),membershipId=params.get("membershipId"),teamId=params.get("teamId");
    if(!userId||!secret||!membershipId||!teamId)return;
    setBusy(true);
    request("/api/admin/staff/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,secret,membershipId,teamId})})
      .then(()=>{setNotice("تم قبول الدعوة بنجاح. مرحبًا بك في فريق Bella Roses.");window.history.replaceState({}, "", "/admin/staff");})
      .catch(e=>setError(e instanceof Error?e.message:"تعذّر قبول الدعوة."))
      .finally(()=>setBusy(false));
  },[request]);

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header">
      <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
      <div className="admin-header-actions"><Link className="admin-tables-link" href="/admin">إدارة المنيو</Link><Link className="admin-tables-link" href="/admin/orders">الطلبات</Link><Link className="admin-tables-link" href="/admin/reports">التقارير</Link></div>
    </header>
    <section className="admin-dashboard-content admin-menu-content">
      <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
      <h1>إدارة الموظفين والصلاحيات</h1>
      <p>تحكم في أعضاء الفريق والأدوار الممنوحة لكل موظف.</p>
      {error?<p className="admin-error-banner" role="alert">{error}</p>:null}
      {notice?<p className="admin-notice" role="status">{notice}</p>:null}
      {!canManage ? <div className="admin-empty-state">دورك الحالي: {roleName(role)}. لا تملك صلاحية إدارة الموظفين.</div> : <>
        {!teamReady ? <div className="admin-editor">
          <h2>إعداد فريق الموظفين</h2>
          <p>أنشئ فريق Appwrite الخاص بـ Bella Roses. سيصبح حساب المالك الحالي مالك الفريق، ولن تتغير بيانات الطلبات أو المنيو.</p>
          <button className="admin-primary-button" disabled={busy} onClick={()=>void bootstrap()}>{busy?"جارٍ التجهيز...":"تجهيز فريق الموظفين"}</button>
        </div> : <>
          <form className="admin-editor" onSubmit={invite}>
            <h2>إضافة موظف جديد</h2>
            <div className="admin-form-grid">
              <label>البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@example.com" dir="ltr"/></label>
              <label>اسم الموظف<input maxLength={128} value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الموظف"/></label>
              <label>الدور<select value={newRole} onChange={e=>setNewRole(e.target.value)}>{roles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            </div>
            <div className="admin-editor-actions"><button className="admin-primary-button" disabled={busy}>إرسال دعوة بالبريد</button></div>
          </form>
          <div className="admin-tables-heading"><h2>أعضاء الفريق</h2><button className="admin-secondary-button" disabled={busy} onClick={()=>void load()}>↻ تحديث</button></div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>الموظف</th><th>الدور</th><th>حالة الدعوة</th><th>الإجراءات</th></tr></thead>
            <tbody>{rows.map(member=><tr key={member.$id ?? member.membershipId}>
              <td><strong>{member.userName ?? member.name ?? "موظف"}</strong><small dir="ltr">{member.userEmail ?? member.email ?? ""}</small></td>
              <td><select value={member.roles?.[0] ?? "cashier"} disabled={busy || (member.roles?.[0]==="owner")} onChange={e=>void changeRole(member,e.target.value)}>{roles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></td>
              <td>{member.confirm===false?"بانتظار القبول":member.joined?"نشط":"معلّق"}</td>
              <td><button className="admin-logout" disabled={busy || (member.roles?.[0]==="owner")} onClick={()=>void remove(member)}>إيقاف العضوية</button></td>
            </tr>)}</tbody>
          </table></div>
          {rows.length===0?<div className="admin-empty-state">لا يوجد موظفون بعد. أرسل أول دعوة من النموذج أعلاه.</div>:null}
        </>}
      </>}
      <p className="admin-data-note">الأدوار: المدير لإدارة التشغيل، الكاشير للطلبات والتقارير، المطبخ لمراحل التحضير، ومقدم الخدمة لمتابعة الطلبات والتسليم. لا يمكن منح دور المالك من هذه الشاشة.</p>
    </section>
  </main>;
}
