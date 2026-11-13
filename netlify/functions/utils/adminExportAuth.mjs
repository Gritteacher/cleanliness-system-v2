import {createClient} from '@supabase/supabase-js';
import {pdfEnvironment} from '../../../shared/pdfRuntime.mjs';

export class ExportAccessError extends Error{
 constructor(message,status){super(message);this.status=status;}
}
export function exportAccessResponse(error){
 return new Response(JSON.stringify({message:error instanceof ExportAccessError?error.message:'ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง'}),{status:error instanceof ExportAccessError?error.status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
export async function requireAdminExport(request,{clientFactory=createClient}={}){
 const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token||token.length>8192)throw new ExportAccessError('กรุณาเข้าสู่ระบบด้วยบัญชี Admin เพื่อส่งออก',401);
 const env=pdfEnvironment(),url=env.VITE_SUPABASE_URL||env.SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new ExportAccessError('ยังไม่ได้ตั้งค่าการตรวจสอบสิทธิ์',503);
 const client=clientFactory(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 // Validate the token with Auth; never decode and trust its client-editable role.
 const {data,error}=await client.auth.getUser(token);
 if(error||!data?.user?.id)throw new ExportAccessError('Session หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',401);
 const profileResult=await client.from('cs_profiles').select('id,role,active').eq('id',data.user.id).maybeSingle().abortSignal(AbortSignal.timeout(10000));
 if(profileResult.error)throw new ExportAccessError('ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง',503);
 const profile=profileResult.data;
 if(profile?.id!==data.user.id||profile?.active!==true||profile?.role!=='admin')throw new ExportAccessError('เฉพาะ Admin เท่านั้นที่ส่งออก PDF หรือรูปภาพได้',403);
 return profile;
}
