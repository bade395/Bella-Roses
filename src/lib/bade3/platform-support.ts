import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export const PLATFORM_SUPPORT_COOKIE="bade3_platform_support";
export type SupportClaims={iss:string;aud:"bella-roses";sub:string;tenantId:string;tenantSlug?:string;iat:number;exp:number;jti?:string};
function secret(){const value=process.env.BADE3_SUPPORT_SIGNING_SECRET??"";if(value.length<48)throw new Error("SUPPORT_SECRET_NOT_CONFIGURED");return value;}
function ownerAllowed(id:string){return (process.env.BADE3_PLATFORM_OWNER_USER_IDS??"").split(",").map(x=>x.trim()).filter(Boolean).includes(id);}
export function signSupportClaims(claims:SupportClaims){const payload=Buffer.from(JSON.stringify(claims)).toString("base64url");const sig=createHmac("sha256",secret()).update(payload).digest("base64url");return payload+"."+sig;}
export function verifySupportToken(token:string,issuer:"bade3-platform"|"bella-support"):SupportClaims|null{
 try{
  if(token.length>4096)return null;
  const [payload,signature,extra]=token.split(".");
  if(!payload||!signature||extra)return null;
  const expected=createHmac("sha256",secret()).update(payload).digest();
  const actual=Buffer.from(signature,"base64url");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  const claims=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as SupportClaims;
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==issuer||claims.aud!=="bella-roses"||!ownerAllowed(claims.sub)||!/^[-A-Za-z0-9._]{1,36}$/.test(claims.tenantId)||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.iat>now+30||claims.exp<=now||claims.exp-claims.iat>3600)return null;
  return claims;
 }catch{return null;}
}