import { createClient } from 'npm:@supabase/supabase-js@2.110.2';
import { validatedPhotoType } from './photoValidation.js';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = 'practice-duty-photos';
const fields = 'id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,photos,created_at';
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
async function limitedBody(req: Request) {
  if (Number(req.headers.get('content-length')) > 4 * 1024 * 1024) fail('ข้อมูลภาพรวมใหญ่เกินไป กรุณาลดจำนวนภาพ', 413);
  const reader = req.body?.getReader(); if (!reader) fail('ไม่พบข้อมูลรายงาน');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4 * 1024 * 1024) { await reader.cancel(); fail('ข้อมูลภาพรวมใหญ่เกินไป', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Response(bytes, { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
}
async function uploadedPhoto(file: FormDataEntryValue | null, maxBytes: number) {
  if (!(file instanceof File) || !['image/webp','image/jpeg'].includes(file.type) || !file.size || file.size > maxBytes) fail('รูปภาพไม่ถูกต้องหรือมีขนาดเกินกำหนด');
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { return { bytes, ...validatedPhotoType(bytes, file.type) }; }
  catch { fail('ไฟล์ไม่ใช่ภาพ JPG หรือ WebP ที่รองรับ'); }
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const uploaded: string[] = []; let inserted: string | null = null; let published = false;
  try {
    const form = await limitedBody(req);
    let p; try { p = JSON.parse(String(form.get('report'))); } catch { fail('ข้อมูลรายงานไม่ถูกต้อง'); }
    if (!p || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id || '')) fail('เลขอ้างอิงไม่ถูกต้อง');
    if (!/^2026-11-\d{2}$/.test(p.duty_date || '') || p.duty_date < '2026-11-02' || p.duty_date > '2026-11-30' || p.duty_date === '2026-11-07') fail('วันที่เลือกอยู่นอกช่วงฝึกซ้อมหรือเป็นวันงดซ้อม');
    if (!['maen','yaowaman','nipha','piyarat','phanu'].includes(p.team_id)) fail('คณะสีไม่ถูกต้อง');
    const names = p.teacher_names === undefined ? [p.teacher_name] : p.teacher_names;
    if (!Array.isArray(names) || names.length < 1 || names.length > 3 || names.some(name => typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120)) fail('กรุณาระบุชื่อครู 1–3 คน ชื่อละ 2–120 ตัวอักษร');
    p.teacher_names = names.map(name => name.trim()); p.teacher_name = p.teacher_names[0];
    for (const [name, max, min] of [['teacher_name',120,2],['details',3000,1],['action_taken',2000,0]] as const) {
      if (typeof p[name] !== 'string' || p[name].trim().length < min || p[name].trim().length > max) fail('กรุณากรอกชื่อครูและรายละเอียดให้ครบถ้วนตามกำหนด');
      p[name] = p[name].trim();
    }
    if (!['normal','incident'].includes(p.outcome) || (p.outcome === 'incident' && !p.action_taken)) fail('กรุณาระบุผลการดูแลและการดำเนินการ');
    if (p.confirmed !== true) fail('กรุณายืนยันความถูกต้องของข้อมูล');
    if (!Number.isInteger(p.photo_count) || p.photo_count < 1 || p.photo_count > 6) fail('กรุณาแนบภาพ 1–6 ภาพ');
    const files = [];
    for (let i=0;i<p.photo_count;i++) files.push({ full: await uploadedPhoto(form.get(`full${i}`),524288), thumbnail: await uploadedPhoto(form.get(`thumb${i}`),131072) });
    const { data: existing, error: lookupError } = await admin.from('cs_practice_reports').select(fields+',status').eq('id',p.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) { if (existing.status === 'published') { const { status: _, ...report } = existing; return reply({ report }); } fail('รายงานนี้กำลังประมวลผล กรุณารอสักครู่แล้วลองใหม่',409); }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key+':practice:'+ip)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const { data: allowed, error: rateError } = await admin.rpc('cs_practice_claim_rate',{p_source:hash});
    if (rateError) throw rateError;
    if (!allowed) fail('มีการส่งรายงานถี่เกินไป กรุณารอ 10 นาทีแล้วลองใหม่',429);
    const weekend = [0,6].includes(new Date(p.duty_date+'T12:00:00+07:00').getUTCDay());
    const { error: insertError } = await admin.from('cs_practice_reports').insert({ id:p.id,duty_date:p.duty_date,team_id:p.team_id,teacher_name:p.teacher_name,teacher_names:p.teacher_names,outcome:p.outcome,details:p.details,action_taken:p.outcome==='incident'?p.action_taken:'',confirmed:true,start_time:weekend?'08:00':null,end_time:weekend?'16:00':p.duty_date<='2026-11-15'?'19:00':'20:00' });
    if (insertError) { if (insertError.code === '23505') fail('รายงานนี้กำลังประมวลผล กรุณาลองใหม่อีกครั้ง',409); throw insertError; }
    inserted=p.id;
    const photos: {full:string;thumbnail:string}[]=[];
    for(let i=0;i<files.length;i++) {
      const result={full:'',thumbnail:''};
      for(const variant of ['full','thumbnail'] as const) {
        const file=files[i][variant];
        const path=`${p.duty_date}/${p.team_id}/${p.id}/${i}.${variant==='full'?'full':'thumb'}.${file.extension}`;
        const {error}=await admin.storage.from(bucket).upload(path,file.bytes,{contentType:file.contentType,cacheControl:'31536000',upsert:false});
        if(error)throw error; uploaded.push(path); result[variant]=admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
      photos.push(result);
    }
    const {data:report,error:publishError}=await admin.from('cs_practice_reports').update({photos,status:'published'}).eq('id',p.id).eq('status','pending').select(fields).single();
    if(publishError)throw publishError; published=true;
    return reply({report});
  } catch(error) {
    // Never remove assets when a publish may have committed but its response was lost.
    if(inserted && !published) {
      const {data:check,error:checkError}=await admin.from('cs_practice_reports').select('status').eq('id',inserted).maybeSingle();
      if(!checkError && check?.status==='pending') {
        if(uploaded.length)await admin.storage.from(bucket).remove(uploaded);
        await admin.from('cs_practice_reports').delete().eq('id',inserted).eq('status','pending');
      }
    }
    const e=error as Error & {status?:number};
    console.error('practice-report', e.status || 500, e.status ? 'validation' : e.message);
    return reply({error:e.status?e.message:'ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่'},e.status||500);
  }
});
