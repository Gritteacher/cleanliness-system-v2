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
  const [teamsResult, scoresResult, roomsResult, scheduledResult] = await Promise.all([
    supabase.from('cs_teams').select('*').eq('active', true).order('sort_order'),
    supabase.from('cs_daily_team_scores').select('*, team:cs_teams(*)').eq('score_date', scoreDate).order('total_score', { ascending: false }),
    supabase.from('cs_published_room_results').select('*, team:cs_teams(*)').eq('score_date', scoreDate).order('room_label'),
    supabase.rpc('cs_public_scheduled_team', { p_date: scoreDate })
  ]);

  const teams = throwIfError(teamsResult);
  const allScores = throwIfError(scoresResult);
  const allRooms = throwIfError(roomsResult);
  const scheduledTeamId = scheduledResult.error
    ? allScores[0]?.team_id || allRooms[0]?.team_id || null
    : scheduledResult.data || allScores[0]?.team_id || allRooms[0]?.team_id || null;

  return {
    date: scoreDate,
    teams,
    scheduledTeam: teams.find((team) => team.id === scheduledTeamId) || null,
    scores: scheduledTeamId ? allScores.filter((score) => score.team_id === scheduledTeamId) : [],
    rooms: scheduledTeamId ? allRooms.filter((room) => room.team_id === scheduledTeamId) : []
  };
}

export async function loadAdminSummary({ startDate, endDate, teamIds = [] }) {
  assertClient();
  const teamsQuery = supabase.from('cs_teams').select('*').eq('active', true).order('sort_order');
  let scoresQuery = supabase
    .from('cs_daily_team_scores')
    .select('score_date, team_id, cleanliness_score, attendance_score, published_at')
    .gte('score_date', startDate)
    .lte('score_date', endDate)
    .not('published_at', 'is', null)
    .order('score_date');

  if (teamIds.length) scoresQuery = scoresQuery.in('team_id', teamIds);

  const [teamsResult, scoresResult] = await Promise.all([teamsQuery, scoresQuery]);
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
  const submissionIds = submissions.map((row) => row.id);
  const evaluationsResult = submissionIds.length
    ? await supabase.from('cs_evaluations').select('*').in('submission_id', submissionIds).is('deleted_at', null)
    : { data: [], error: null };
  if (evaluationsResult.error) throw evaluationsResult.error;

  const privatePaths = [...new Set(submissions.flatMap((row) => row.photos || [])
    .filter((photo) => photo.storage_path && !photo.legacy_public_url)
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
      view_url: photo.legacy_thumbnail_url || photo.legacy_public_url || signedByPath.get(photo.thumbnail_path || photo.storage_path) || signedByPath.get(photo.storage_path) || null,
      full_url: photo.legacy_public_url || signedByPath.get(photo.storage_path) || null
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
  if (!file?.type?.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  if (file.size > 10 * 1024 * 1024) throw new Error('รูปภาพต้องมีขนาดไม่เกิน 10 MB');
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
  if (error) {
    await supabase.storage.from('cs-duty-photos').remove([path]);
    throw error;
  }
  return data;
}

async function publishPhotoCopies(scoreDate) {
  const roomsResult = await supabase
    .from('cs_published_room_results')
    .select('id, photo_ids, legacy_public_url, legacy_thumbnail_url')
    .eq('score_date', scoreDate)
    .not('published_at', 'is', null);
  if (roomsResult.error) throw roomsResult.error;

  const clearResult = await supabase
    .from('cs_published_room_results')
    .update({ photo_public_urls: [] })
    .eq('score_date', scoreDate)
    .not('published_at', 'is', null);
  if (clearResult.error) throw clearResult.error;

  const photoIds = [...new Set((roomsResult.data || []).flatMap((room) => room.photo_ids || []))];
  if (!photoIds.length) return 0;
  const photosResult = await supabase
    .from('cs_submission_photos')
    .select('id, storage_path, legacy_public_url, legacy_thumbnail_url')
    .in('id', photoIds)
    .is('deleted_at', null);
  if (photosResult.error) throw photosResult.error;
  const photoById = new Map((photosResult.data || []).map((photo) => [photo.id, photo]));

  let copied = 0;
  for (const room of roomsResult.data || []) {
    const photo = (room.photo_ids || []).map((id) => photoById.get(id)).find(Boolean);
    if (!photo || photo.legacy_public_url) continue;
    const download = await supabase.storage.from('cs-duty-photos').download(photo.storage_path);
    if (download.error) throw download.error;
    const filename = photo.storage_path.split('/').pop() || `${photo.id}.jpg`;
    const publicPath = `${scoreDate}/${room.id}/${filename}`;
    const upload = await supabase.storage.from('cs-published-photos').upload(publicPath, download.data, {
      cacheControl: '31536000',
      contentType: download.data.type || 'image/jpeg',
      upsert: true
    });
    if (upload.error) throw upload.error;
    const publicUrl = supabase.storage.from('cs-published-photos').getPublicUrl(publicPath).data.publicUrl;
    const update = await supabase.from('cs_published_room_results').update({ photo_public_urls: [publicUrl] }).eq('id', room.id);
    if (update.error) throw update.error;
    copied += 1;
  }
  return copied;
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
  const photo_count = await publishPhotoCopies(scoreDate);
  return { ...(data?.[0] || { team_count: 0, room_count: 0 }), photo_count };
}
