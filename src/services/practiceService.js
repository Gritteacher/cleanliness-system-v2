import { supabase } from '../lib/supabase.js';

export async function loadPracticeReports(date, endDate = date) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อระบบรายงาน กรุณาลองใหม่ภายหลัง');
  const results = [];
  // Page explicitly: a busy day/range must not silently lose records at the API row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('cs_practice_reports').select('id,duty_date,team_id,teacher_name,outcome,details,action_taken,start_time,end_time,photos,created_at').eq('status', 'published').gte('duty_date', date).lte('duty_date', endDate).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw new Error('โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง');
    results.push(...data);
    if (data.length < 500) return results;
  }
}

export async function sendPracticeReport(payload, photos) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อระบบรายงาน');
  const form = new FormData();
  form.append('report', JSON.stringify({ ...payload, photo_count: photos.length }));
  photos.forEach((photo, index) => { form.append(`full${index}`, photo.full, `photo-${index}.webp`); form.append(`thumb${index}`, photo.thumbnail, `thumb-${index}.webp`); });
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
