import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

function assertClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase ใน Environment Variables');
  }
}

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data || [];
}

export function bangkokDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function loadPublicOverview(scoreDate = bangkokDate()) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_public_live_overview', { p_date: scoreDate });
  if (error) throw error;
  return {
    date: scoreDate,
    scheduledTeam: data?.scheduledTeam || null,
    score: data?.score || null,
    rooms: data?.rooms || []
  };
}

export async function loadAdminSummary({ startDate, endDate, teamIds = [] }) {
  assertClient();
  const [teamsResult, scoresResult] = await Promise.all([
    supabase.from('cs_teams').select('*').eq('active', true).order('sort_order'),
    supabase.rpc('cs_admin_live_summary', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_team_ids: teamIds.length ? teamIds : null
    })
  ]);
  return {
    teams: throwIfError(teamsResult),
    scores: throwIfError(scoresResult),
    startDate,
    endDate
  };
}

export async function loadWorkspace(scoreDate = bangkokDate()) {
  assertClient();
  const [teamsResult, termResult, areasResult, assignmentsResult, schedulesResult, overridesResult, submissionsResult] = await Promise.all([
    supabase.from('cs_teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_school_terms').select('*').eq('active', true).maybeSingle(),
    supabase.from('cs_areas').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_team_area_assignments').select('*, team:cs_teams(*), area:cs_areas(*)').eq('active', true).order('sort_order'),
    supabase.from('cs_duty_schedules').select('*, team:cs_teams(*)').order('weekday'),
    supabase.from('cs_schedule_overrides').select('*, team:cs_teams(*)').eq('duty_date', scoreDate),
    supabase.from('cs_duty_submissions').select('*, assignment:cs_team_area_assignments(*, team:cs_teams(*), area:cs_areas(*)), photos:cs_submission_photos(*)').eq('duty_date', scoreDate).is('deleted_at', null)
  ]);

  const results = [teamsResult, termResult, areasResult, assignmentsResult, schedulesResult, overridesResult, submissionsResult];
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  const submissions = submissionsResult.data || [];
  const evaluationsResult = await supabase
    .from('cs_evaluations')
    .select('*')
    .eq('duty_date', scoreDate)
    .is('deleted_at', null);
  if (evaluationsResult.error) throw evaluationsResult.error;

  const privatePaths = [...new Set(submissions.flatMap((row) => row.photos || [])
    .filter((photo) => photo.storage_path && !photo.public_url && !photo.legacy_public_url)
    .map((photo) => photo.storage_path))];
  const signedByPath = new Map();
  if (privatePaths.length) {
    const signedResult = await supabase.storage.from('cs-duty-photos').createSignedUrls(privatePaths, 3600);
    if (signedResult.error) throw signedResult.error;
    (signedResult.data || []).forEach((item) => {
      if (item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }

  const submissionsWithPhotos = submissions.map((row) => ({
    ...row,
    photos: (row.photos || []).map((photo) => ({
      ...photo,
      view_url: photo.public_url || photo.legacy_thumbnail_url || photo.legacy_public_url || signedByPath.get(photo.thumbnail_path || photo.storage_path) || signedByPath.get(photo.storage_path) || null,
      full_url: photo.public_url || photo.legacy_public_url || signedByPath.get(photo.storage_path) || null
    }))
  }));

  return {
    date: scoreDate,
    teams: teamsResult.data || [],
    term: termResult.data || null,
    areas: areasResult.data || [],
    assignments: assignmentsResult.data || [],
    schedules: schedulesResult.data || [],
    overrides: overridesResult.data || [],
    submissions: submissionsWithPhotos,
    evaluations: evaluationsResult.data || []
  };
}

export async function saveDutySubmission(input) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_save_live_submission', {
    p_assignment_id: input.assignmentId,
    p_duty_date: input.dutyDate,
    p_duty_status: input.dutyStatus,
    p_student_count: Number(input.studentCount || 0),
    p_note: input.note?.trim() || null
  });
  if (error) throw error;
  return data;
}

export async function ensureDutySubmission(assignmentId, dutyDate) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_ensure_live_submission', {
    p_assignment_id: assignmentId,
    p_duty_date: dutyDate
  });
  if (error) throw error;
  return data;
}

export async function saveEvaluation(input) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_save_live_evaluation', {
    p_assignment_id: input.assignmentId,
    p_duty_date: input.dutyDate,
    p_evaluator_team_id: input.teamId,
    p_score: Number(input.score),
    p_reason: input.reason?.trim() || null
  });
  if (error) throw error;
  return data;
}

export async function deleteEvaluation(evaluationId) {
  assertClient();
  const { error } = await supabase.rpc('cs_admin_delete_live_evaluation', { p_evaluation_id: evaluationId });
  if (error) throw error;
}

export async function uploadSubmissionPhoto({ submissionId, assignmentId, dutyDate, userId, file }) {
  assertClient();
  if (!file?.type?.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  if (file.size > 10 * 1024 * 1024) throw new Error('รูปภาพต้องมีขนาดไม่เกิน 10 MB');
  let activeSubmissionId = submissionId;
  if (!activeSubmissionId) {
    const submission = await ensureDutySubmission(assignmentId, dutyDate);
    activeSubmissionId = submission.id;
  }
  const safeName = `${Date.now()}-${file.name || 'photo.jpg'}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${dutyDate}/${assignmentId}/${userId}/${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('cs-published-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage.from('cs-published-photos').getPublicUrl(path).data.publicUrl;

  const { data, error } = await supabase
    .from('cs_submission_photos')
    .insert({ submission_id: activeSubmissionId, storage_path: path, public_url: publicUrl })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('cs-published-photos').remove([path]);
    throw error;
  }
  return data;
}

export async function deleteSubmissionPhoto(photo) {
  assertClient();
  const { data: path, error } = await supabase.rpc('cs_delete_live_photo', { p_photo_id: photo.id });
  if (error) throw error;
  if (photo.public_url && path) await supabase.storage.from('cs-published-photos').remove([path]);
}

export async function saveSchoolTerm(input) {
  assertClient();
  const payload = {
    academic_year: Number(input.academicYear),
    semester: Number(input.semester),
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    active: Boolean(input.active)
  };
  const query = input.id
    ? supabase.from('cs_school_terms').update(payload).eq('id', input.id)
    : supabase.from('cs_school_terms').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function saveArea(input) {
  assertClient();
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    sort_order: Number(input.sortOrder || 0),
    active: true
  };
  const query = input.id
    ? supabase.from('cs_areas').update(payload).eq('id', input.id)
    : supabase.from('cs_areas').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function saveAreaAssignment(input) {
  assertClient();
  const { data, error } = await supabase
    .from('cs_team_area_assignments')
    .upsert({
      term_id: input.termId,
      team_id: input.teamId,
      area_id: input.areaId,
      room_label: input.roomLabel.trim(),
      sort_order: Number(input.sortOrder || 0),
      active: true
    }, { onConflict: 'term_id,team_id,area_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveDutySchedule(input) {
  assertClient();
  const { data, error } = await supabase
    .from('cs_duty_schedules')
    .upsert({
      term_id: input.termId,
      weekday: Number(input.weekday),
      team_id: input.teamId
    }, { onConflict: 'term_id,weekday' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyDisplayName(displayName) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_update_my_profile', { p_display_name: displayName });
  if (error) throw error;
  return data;
}

export async function loadAdminAccounts() {
  assertClient();
  const { data, error } = await supabase.rpc('cs_admin_accounts');
  if (error) throw error;
  return data || [];
}

export function subscribeLiveUpdates(callback, dutyDate = null) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const config = { event: '*', schema: 'public', table: 'cs_live_updates' };
  if (dutyDate) config.filter = `duty_date=eq.${dutyDate}`;
  const channel = supabase
    .channel(`cs-live-${dutyDate || 'all'}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', config, (payload) => callback(payload.new?.duty_date || payload.old?.duty_date || null))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
