import {createClient} from 'npm:@supabase/supabase-js@2.110.2';
import {validatedPhotoType} from '../_shared/photoValidation.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const url=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const fields='id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,photos,created_at,updated_at,deleted_at';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
async function limitedForm(req:Request){
  const reader=req.body?.getReader();if(!reader)fail('ไม่พบข้อมูล');const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();fail('ข้อมูลภาพรวมใหญ่เกินไป',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
}
async function photo(entry:FormDataEntryValue|null,max:number){
  if(!(entry instanceof File)||!entry.size||entry.size>max)fail('รูปภาพไม่ถูกต้องหรือเกินขนาด');
  const bytes=new Uint8Array(await entry.arrayBuffer());
  try{return{bytes,...validatedPhotoType(bytes,entry.type)};}catch{fail('รองรับรูปภาพ JPG หรือ WebP เท่านั้น');}
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const uploaded:string[]=[];let reportId='';
  try{
    const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)fail('กรุณาเข้าสู่ระบบ Admin',401);
    const {data:auth,error:authError}=await admin.auth.getUser(token);if(authError||!auth.user)fail('กรุณาเข้าสู่ระบบ Admin',401);
    const {data:profile,error:profileError}=await admin.from('cs_profiles').select('role,active').eq('id',auth.user.id).single();
    if(profileError||profile?.role!=='admin'||!profile.active)fail('บัญชีนี้ไม่มีสิทธิ์ Admin',403);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const form=await limitedForm(req);let p;try{p=JSON.parse(String(form.get('report')));}catch{fail('ข้อมูลไม่ถูกต้อง');}
    if(!p||!['create','update','delete','restore'].includes(p.operation)||!/^[0-9a-f-]{36}$/i.test(p.id||''))fail('ข้อมูลรายงานไม่ถูกต้อง');reportId=p.id;
    let existing=null;
    if(p.operation==='create'){
      const {data,error}=await userClient.from('cs_practice_reports').select(fields).eq('id',p.id).maybeSingle();
      if(error)throw error;if(data&&!data.deleted_at)return reply({report:data});if(data)fail('รายงานนี้ถูกลบแล้ว กรุณากู้คืนก่อน',409);
    }
    if(p.operation!=='create'){
      const {data,error}=await userClient.from('cs_practice_reports').select(fields).eq('id',p.id).single();if(error||!data)fail('ไม่พบรายงาน',404);existing=data;
      if(p.expected_updated_at!==existing.updated_at)fail('มีการเปลี่ยนแปลงรายงานแล้ว กรุณาปิดและเปิดฟอร์มใหม่',409);
    }
    let payload={};
    if(['create','update'].includes(p.operation)){
      if(!/^2026-11-\d{2}$/.test(p.duty_date||'')||p.duty_date<'2026-11-02'||p.duty_date>'2026-11-30'||p.duty_date==='2026-11-07'||!['maen','yaowaman','nipha','piyarat','phanu'].includes(p.team_id))fail('วันที่หรือคณะสีไม่ถูกต้อง');
      if(!Array.isArray(p.teacher_names)||p.teacher_names.length<1||p.teacher_names.length>4||p.teacher_names.some((name:unknown)=>typeof name!=='string'||name.trim().length<2||name.trim().length>120))fail('กรุณาระบุชื่อครู 1–4 คน ชื่อละ 2–120 ตัวอักษร');
      if(!['normal','incident'].includes(p.outcome)||typeof p.details!=='string'||!p.details.trim()||p.details.trim().length>3000||typeof p.action_taken!=='string'||p.action_taken.trim().length>2000||(p.outcome==='incident'&&!p.action_taken.trim()))fail('กรุณากรอกรายละเอียดให้ครบถ้วน');
      const keep=p.keep_photos||[];if(!Array.isArray(keep)||new Set(keep).size!==keep.length||keep.some((full:unknown)=>!existing?.photos.some((image:{full:string})=>image.full===full)))fail('ภาพเดิมไม่ถูกต้อง');
      if(!Number.isInteger(p.photo_count)||p.photo_count<0||keep.length+p.photo_count<1||keep.length+p.photo_count>6)fail('กรุณาแนบภาพ 1–6 ภาพ');
      const newPhotos=[];
      for(let index=0;index<p.photo_count;index++)newPhotos.push({full:await photo(form.get(`full${index}`),524288),thumbnail:await photo(form.get(`thumb${index}`),131072)});
      const photos=(existing?.photos||[]).filter((image:{full:string})=>keep.includes(image.full));
      for(let index=0;index<newPhotos.length;index++){
        const image={full:'',thumbnail:''};
        for(const variant of ['full','thumbnail'] as const){const file=newPhotos[index][variant],path=`${p.duty_date}/${p.team_id}/${p.id}/admin-${crypto.randomUUID()}.${variant==='full'?'full':'thumb'}.${file.extension}`;
          const {error}=await admin.storage.from('practice-duty-photos').upload(path,file.bytes,{contentType:file.contentType,cacheControl:'31536000',upsert:false});if(error)throw error;uploaded.push(path);image[variant]=admin.storage.from('practice-duty-photos').getPublicUrl(path).data.publicUrl;}
        photos.push(image);
      }
      payload={duty_date:p.duty_date,team_id:p.team_id,teacher_names:p.teacher_names.map((name:string)=>name.trim()),outcome:p.outcome,details:p.details.trim(),action_taken:p.action_taken.trim(),photos};
    }
    const {data:report,error}=await userClient.rpc('cs_admin_manage_practice_report',{p_operation:p.operation,p_id:p.id,p_report:payload,p_expected_updated_at:p.expected_updated_at||null});
    if(error){if(error.code==='40001')fail('มีการเปลี่ยนแปลงรายงานแล้ว กรุณาปิดและเปิดฟอร์มใหม่',409);if(error.code==='42501')fail('บัญชีนี้ไม่มีสิทธิ์ Admin',403);throw error;}
    return reply({report});
  }catch(error){
    if(uploaded.length&&reportId){const {data:check,error:checkError}=await admin.from('cs_practice_reports').select('photos').eq('id',reportId).maybeSingle();if(!checkError&&!uploaded.some(path=>JSON.stringify(check?.photos||[]).includes(path)))await admin.storage.from('practice-duty-photos').remove(uploaded);}
    const e=error as Error&{status?:number};console.error('practice-admin',e.status||500,e.status?'validation':e.message);return reply({error:e.status?e.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่'},e.status||500);
  }
});
