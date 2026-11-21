import "server-only";
import { cookies } from "next/headers";

const endpoint=(process.env.APPWRITE_ENDPOINT??process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT??"").replace(/\/+$/,"");
const project=process.env.APPWRITE_PROJECT_ID??process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID??"";
const db=process.env.BADE3_CORE_DATABASE_ID??process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID??"bella_roses";
const key=process.env.APPWRITE_API_KEY;
const cookieName=project? `a_session_${project}`:"";

type Row<T=Record<string,unknown>>={ $id:string; data?:T }&Partial<T>;
type List<T>={ rows?:Row<T>[]; total?:number };
type Tenant={name?:string;slug?:string;status?:string;default_currency?:string;timezone?:string};
type Branch={tenant_id?:string;status?:string;name?:string;code?:string};
type Domain={tenant_id?:string;domain?:string;verification_status?:string;is_active?:boolean;is_primary?:boolean};
type Plan={code?:string;name?:string;is_active?:boolean;branch_limit?:number};
type Subscription={tenant_id?:string;plan_id?:string;status?:string;starts_at?:string;ends_at?:string};

function data<T>(row:Row<T>):T {
 if(row.data&&typeof row.data==="object") return row.data;
 const flattened={...row} as Record<string,unknown>;
 for(const k of ["$id","$sequence","$tableId","$databaseId","$createdAt","$updatedAt","$permissions","data"]) delete flattened[k];
 return flattened as T;
}
async function list<T>(table:string):Promise<Row<T>[]> {
 if(!endpoint||!project||!key) throw new Error("PLATFORM_STORAGE_NOT_CONFIGURED");
 const query=encodeURIComponent(JSON.stringify({method:"limit",values:[100]}));
 const response=await fetch(`${endpoint}/tablesdb/${encodeURIComponent(db)}/tables/${encodeURIComponent(table)}/rows?queries[]=${query}`,{
 headers:{"X-Appwrite-Project":project,"X-Appwrite-Key":key,"Content-Type":"application/json"},cache:"no-store",
 });
 if(!response.ok) throw new Error("PLATFORM_STORAGE_READ_FAILED");
 const payload=await response.json() as List<T>;
 return Array.isArray(payload.rows)?payload.rows:[];
}
export async function verifyPlatformOwner() {
 if(!endpoint||!project||!cookieName||!key) return null;
 const session=(await cookies()).get(cookieName)?.value;
 if(!session) return null;
 const userResponse=await fetch(`${endpoint}/account`,{headers:{"X-Appwrite-Project":project,"X-Appwrite-Session":session},cache:"no-store"}).catch(()=>null);
 if(!userResponse?.ok) return null;
 const user=await userResponse.json() as {$id?:string;email?:string;name?:string};
 if(!user.$id) return null;
 const admins=await list<Record<string,unknown>>("platform_admins").catch(()=>[]);
 const approved=admins.map(data).some(row=>row.user_id===user.$id&&row.role==="platform_owner"&&row.is_active===true);
 return approved?{id:user.$id,email:user.email??"",name:user.name??""}:null;
}
export async function readPlatformOverview() {
 const [tenantRows,branchRows,domainRows,planRows,subscriptionRows]=await Promise.all([
 list<Tenant>("tenants"),list<Branch>("branches"),list<Domain>("tenant_domains"),list<Plan>("plans"),list<Subscription>("subscriptions"),
 ]);
 const tenants=tenantRows.map(row=>({id:row.$id,...data(row)}));
 const branches=branchRows.map(row=>({id:row.$id,...data(row)}));
 const domains=domainRows.map(row=>({id:row.$id,...data(row)}));
 const plans=planRows.map(row=>data(row));
 const subscriptions=subscriptionRows.map(row=>({id:row.$id,...data(row)}));
 const planMap=new Map(plans.map(plan=>[plan.code??"",plan.name??plan.code??"—"]));
 const tenantItems=tenants.map(tenant=>{
  const bs=branches.filter(branch=>branch.tenant_id===tenant.id);
  const ds=domains.filter(domain=>domain.tenant_id===tenant.id&&domain.is_active&&domain.verification_status==="verified");
  const ss=subscriptions.filter(subscription=>subscription.tenant_id===tenant.id).sort((a,b)=>(b.starts_at??b.id).localeCompare(a.starts_at??a.id));
  const sub=ss[0];
  return {id:tenant.id,name:tenant.name??tenant.slug??tenant.id,slug:tenant.slug??"",status:tenant.status??"unknown",branchCount:bs.length,domains:ds.map(d=>({domain:d.domain??"",primary:d.is_primary===true})),plan:sub?planMap.get(sub.plan_id??"")??sub.plan_id??"—":"—",subscriptionStatus:sub?.status??"none",currency:tenant.default_currency??"",timezone:tenant.timezone??""};
 });
 return {stats:{tenants:tenants.length,activeTenants:tenants.filter(t=>t.status==="active").length,suspendedTenants:tenants.filter(t=>t.status==="suspended").length,branches:branches.filter(b=>b.status==="active").length,activeSubscriptions:subscriptions.filter(s=>["active","trial"].includes(s.status??"")).length},tenants:tenantItems};
}
