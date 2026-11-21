import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveTenantForHost } from "@/lib/bade3/appwrite-platform-store";
import { PLATFORM_SUPPORT_COOKIE, signSupportClaims, verifySupportToken } from "@/lib/bade3/platform-support";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const token=new URL(request.url).searchParams.get("token")??"";
 const claims=verifySupportToken(token,"bade3-platform");
 if(!claims)return NextResponse.json({error:"رابط الدخول الإداري غير صالح أو انتهت صلاحيته."},{status:401,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 try{
  const tenant=await resolveTenantForHost(request.headers.get("host"));
  if(!tenant||tenant.id!==claims.tenantId||tenant.status!=="active")return NextResponse.json({error:"الشركة غير نشطة أو لا يتطابق نطاقها مع رابط الدخول."},{status:403,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  const now=Math.floor(Date.now()/1000);
  const session=signSupportClaims({iss:"bella-support",aud:"bella-roses",sub:claims.sub,tenantId:claims.tenantId,tenantSlug:tenant.slug,iat:now,exp:now+1800,jti:randomUUID()});
  const response=NextResponse.redirect(new URL("/admin",request.url),303);
  response.cookies.set(PLATFORM_SUPPORT_COOKIE,session,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:1800});
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
 }catch{
  return NextResponse.json({error:"تعذّر التحقق من الشركة."},{status:503,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }
}