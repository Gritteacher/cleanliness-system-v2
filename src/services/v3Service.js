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
  const [teamsResult, scoresResult, roomsResult] = await Promise.all([
    supabase.from('cs_teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_daily_team_scores').select('*, team:cs_teams(*)').eq('score_date', scoreDate).order('total_score', { ascending: false }),
    supabase.from('cs_published_room_results').select('*, team:cs_teams(*)').eq('score_date', scoreDate).order('room_label')
  ]);

  return {
    date: scoreDate,
    teams: throwIfError(teamsResult),
    scores: throwIfError(scoresResult),
    rooms: throwIfError(roomsResult)
  };
}

export async function loadWorkspace(scoreDate = bangkokDate()) {
  assertClient();
  const [teamsResult, termResult, areasResult, assignmentsResult, schedulesResult, overridesResult, submissionsResult, evaluationsResult] = await Promise.all([
    supabase.from('cs_teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_school_terms').select('*').eq('active', true).maybeSingle(),
    supabase.from('cs_areas').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_team_area_assignments').select('*, team:cs_teams(*), area:cs_areas(*)').eq('active', true).order('sort_order'),
    supabase.from('cs_duty_schedules').select('*, team:cs_teams(*)').order('weekday'),
    supabase.from('cs_schedule_overrides').select('*, team:cs_teams(*)').eq('duty_date', scoreDate),
    supabase.from('cs_duty_submissions').select('*, assignment:cs_team_area_assignments(*, team:cs_teams(*), area:cs_areas(*)), photos:cs_submission_photos(*)').eq('duty_date', scoreDate).is('deleted_at', null),
    supabase.from('cs_evaluations').select('*').is('deleted_at', null)
  ]);

  const results = [teamsResult, termResult, areasResult, assignmentsResult, schedulesResult, overridesResult, submissionsResult, evaluationsResult];
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  return {
    date: scoreDate,
    teams: teamsResult.data || [],
    term: termResult.data || null,
    areas: areasResult.data || [],
    assignments: assignmentsResult.data || [],
    schedules: schedulesResult.data || [],
    overrides: overridesResult.data || [],
    submissions: submissionsResult.data || [],
    evaluations: evaluationsResult.data || []
  };
}

export async function saveDutySubmission(input) {
  assertClient();
  const payload = {
    assignment_id: input.assignmentId,
    duty_date: input.dutyDate,
    duty_status: input.dutyStatus,
    student_count: Number(input.studentCount || 0),
    note: input.note?.trim() || null,
    workflow_status: input.submit ? 'submitted' : 'draft'
  };

  const query = input.id
    ? supabase.from('cs_duty_submissions').update(payload).eq('id', input.id)
    : supabase.from('cs_duty_submissions').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function saveEvaluation(input) {
  assertClient();
  const payload = {
    submission_id: input.submissionId,
    evaluator_team_id: input.teamId,
    score: Number(input.score),
    reason: input.reason?.trim() || null
  };
  const query = input.id
    ? supabase.from('cs_evaluations').update(payload).eq('id', input.id)
    : supabase.from('cs_evaluations').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function uploadSubmissionPhoto({ submissionId, userId, file }) {
  assertClient();
  const safeName = `${Date.now()}-${file.name || 'photo.jpg'}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${submissionId}/${userId}/${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('cs-duty-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('cs_submission_photos')
    .insert({ submission_id: submissionId, storage_path: path })
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function publishDailyResults(scoreDate) {
  assertClient();
  const { data, error } = await supabase.rpc('cs_admin_publish_day', { p_score_date: scoreDate });
  if (error) throw error;
  return data?.[0] || { team_count: 0, room_count: 0 };
}
