import { NextResponse } from "next/server";
import { readPlatformOverview, verifyPlatformOwner } from "@/lib/bade3/platform-owner";
export const runtime="nodejs";
export async function GET(){
 const owner=await verifyPlatformOwner();
 if(!owner) return NextResponse.json({error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await readPlatformOverview(),{headers:{"Cache-Control":"no-store"}});}
 catch{return NextResponse.json({error:"تعذّر تحميل بيانات المنصة."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
