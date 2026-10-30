import { supabase } from '../lib/supabase.js';
import { photoExtension } from '../utils/photoInput.js';

export async function loadPracticeRoster(date) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อระบบตารางเวร');
  const { data, error } = await supabase.from('cs_practice_duty_roster')
    .select('duty_date,team_id,teacher_names').eq('duty_date', date).order('team_id');
  if (error) throw new Error('โหลดรายชื่อครูตามตารางเวรไม่สำเร็จ');
  return data;
}

export async function loadPracticeReports(date, endDate = date, deleted = false) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อระบบรายงาน กรุณาลองใหม่ภายหลัง');
  const results = [];
  // Page explicitly: a busy day/range must not silently lose records at the API row limit.
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('cs_practice_reports').select('id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,photos,created_at,updated_at,deleted_at').eq('status', 'published').gte('duty_date', date).lte('duty_date', endDate);
    query = deleted ? query.not('deleted_at','is',null) : query.is('deleted_at',null);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw new Error('โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง');
    results.push(...data);
    if (data.length < 500) return results;
  }
}

export async function managePracticeReport(payload, photos = []) {
  if(!supabase)throw new Error('ยังไม่ได้เชื่อมต่อระบบรายงาน');
  const form=new FormData();form.append('report',JSON.stringify({...payload,photo_count:photos.length}));
  photos.forEach((photo,index)=>{form.append(`full${index}`,photo.full,`photo-${index}.${photoExtension(photo.full)}`);form.append(`thumb${index}`,photo.thumbnail,`thumb-${index}.${photoExtension(photo.thumbnail)}`);});
  const {data,error}=await supabase.functions.invoke('practice-admin',{body:form});
  if(error){let message='บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง';try{const detail=await error.context?.json();if(detail?.error)message=detail.error;}catch{}throw new Error(message);}
  return data.report;
}

export async function sendPracticeReport(payload, photos) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อระบบรายงาน');
  const form = new FormData();
  form.append('report', JSON.stringify({ ...payload, photo_count: photos.length }));
  photos.forEach((photo, index) => { form.append(`full${index}`, photo.full, `photo-${index}.${photoExtension(photo.full)}`); form.append(`thumb${index}`, photo.thumbnail, `thumb-${index}.${photoExtension(photo.thumbnail)}`); });
  const { data, error } = await supabase.functions.invoke('practice-report', { body: form });
  if (error) {
    let message = 'ส่งรายงานไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง';
    try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch { /* Keep the safe fallback. */ }
    throw new Error(message);
  }
  return data.report;
}

export function watchPracticeReports(date, callback) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`practice-${date}-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'cs_practice_reports', filter: `duty_date=eq.${date}` }, callback).subscribe();
  return () => { supabase.removeChannel(channel); };
}
