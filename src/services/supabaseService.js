import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { defaultDutyAreas } from '../data/dutyAreas.js';

function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env');
  }
}

export function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-./ก-ฮะ-์]/gi, '-')
    .replace(/-+/g, '-');
}

export function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export async function uploadImageDataUrl(dataUrl, path) {
  assertSupabase();

  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { url: dataUrl || '', path: '' };
  }

  const blob = dataUrlToBlob(dataUrl);
  const cleanPath = sanitizeFileName(path);
  const { error } = await supabase.storage
    .from('area-photos')
    .upload(cleanPath, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg'
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('area-photos')
    .getPublicUrl(cleanPath);

  return {
    url: data?.publicUrl || '',
    path: cleanPath
  };
}

function areaFromRow(row) {
  return {
    id: row.id,
    areaNo: row.area_no,
    areaName: row.area_name,
    roomsByTeam: row.rooms_by_team || {}
  };
}

function areaToRow(area) {
  return {
    id: area.id,
    area_no: Number(area.areaNo || 0),
    area_name: area.areaName,
    rooms_by_team: area.roomsByTeam || {},
    updated_at: new Date().toISOString()
  };
}

function dutyFromRow(row) {
  return {
    id: row.id,
    recordDate: row.record_date,
    areaId: row.area_id,
    room: row.room,
    dutyColorId: row.duty_color_id,
    status: row.status,
    studentCount: row.student_count,
    studentScore: Number(row.student_score || 0),
    photo: row.photo_url || '',
    photoThumb: row.photo_thumb_url || row.photo_url || '',
    photoPath: row.photo_path || '',
    photoThumbPath: row.photo_thumb_path || '',
    photoNote: row.photo_note || '',
    submittedBy: row.submitted_by || '',
    submittedName: row.submitted_name || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function dutyToRow(record) {
  return {
    id: record.id,
    record_date: record.recordDate,
    area_id: record.areaId,
    room: record.room,
    duty_color_id: record.dutyColorId,
    status: record.status,
    student_count: Number(record.studentCount || 0),
    student_score: Number(record.studentScore || 0),
    photo_url: record.photo || '',
    photo_thumb_url: record.photoThumb || record.photo || '',
    photo_path: record.photoPath || '',
    photo_thumb_path: record.photoThumbPath || '',
    photo_note: record.photoNote || '',
    submitted_name: record.submittedName || record.submittedBy || '',
    submitted_at: record.submittedAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function scoreFromRow(row) {
  return {
    id: row.id,
    recordDate: row.record_date,
    areaId: row.area_id,
    room: row.room,
    dutyColorId: row.duty_color_id,
    evaluatorColorId: row.evaluator_color_id,
    cleanScore: Number(row.clean_score || 0),
    scoreNote: row.score_note || '',
    submittedBy: row.submitted_by || '',
    submittedName: row.submitted_name || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function scoreToRow(score) {
  return {
    id: score.id,
    record_date: score.recordDate,
    area_id: score.areaId,
    room: score.room,
    duty_color_id: score.dutyColorId,
    evaluator_color_id: score.evaluatorColorId,
    clean_score: Number(score.cleanScore || 0),
    score_note: score.scoreNote || '',
    submitted_name: score.submittedName || score.submittedBy || '',
    submitted_at: score.submittedAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function logFromRow(row) {
  return {
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    oldData: row.old_data,
    newData: row.new_data,
    editedBy: row.edited_by,
    editedAt: row.edited_at
  };
}

export function logToRow(log) {
  return {
    id: log.id,
    action: log.action,
    table_name: log.tableName,
    record_id: log.recordId,
    old_data: log.oldData || null,
    new_data: log.newData || null,
    edited_by: log.editedBy || '',
    edited_at: log.editedAt || new Date().toISOString()
  };
}

export async function loadRemoteData() {
  assertSupabase();

  const [areasRes, dutyRes, scoreRes, logRes] = await Promise.all([
    supabase.from('duty_areas').select('*').order('area_no', { ascending: true }),
    supabase.from('duty_records').select('*').order('updated_at', { ascending: false }),
    supabase.from('clean_scores').select('*').order('updated_at', { ascending: false }),
    supabase.from('edit_logs').select('*').order('edited_at', { ascending: false }).limit(100)
  ]);

  if (areasRes.error) throw areasRes.error;
  if (dutyRes.error) throw dutyRes.error;
  if (scoreRes.error) throw scoreRes.error;
  if (logRes.error) throw logRes.error;

  return {
    areas: (areasRes.data || []).map(areaFromRow),
    dutyRecords: (dutyRes.data || []).map(dutyFromRow),
    cleanScores: (scoreRes.data || []).map(scoreFromRow),
    editLogs: (logRes.data || []).map(logFromRow)
  };
}

export async function seedDefaultAreasIfEmpty() {
  assertSupabase();
  const { count, error } = await supabase
    .from('duty_areas')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  if (count && count > 0) return false;

  const { error: insertError } = await supabase
    .from('duty_areas')
    .upsert(defaultDutyAreas.map(areaToRow), { onConflict: 'id' });

  if (insertError) throw insertError;
  return true;
}

export async function upsertDutyRecord(record) {
  assertSupabase();
  const { data, error } = await supabase
    .from('duty_records')
    .upsert(dutyToRow(record), { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return dutyFromRow(data);
}

export async function deleteDutyRecordRemote(id) {
  assertSupabase();
  const { error } = await supabase.from('duty_records').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function upsertCleanScore(score) {
  assertSupabase();
  const { data, error } = await supabase
    .from('clean_scores')
    .upsert(scoreToRow(score), { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return scoreFromRow(data);
}

export async function upsertAreas(areas) {
  assertSupabase();
  const { error } = await supabase
    .from('duty_areas')
    .upsert(areas.map(areaToRow), { onConflict: 'id' });

  if (error) throw error;
  return true;
}

export async function insertEditLog(log) {
  assertSupabase();
  const { error } = await supabase
    .from('edit_logs')
    .insert(logToRow(log));

  if (error) throw error;
  return true;
}


async function deleteAllRows(tableName) {
  assertSupabase();
  const { error } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '__never_match_this_id__');

  if (error) throw error;
  return true;
}

async function listStoragePaths(prefix = '') {
  assertSupabase();

  const cleanPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const { data, error } = await supabase
    .storage
    .from('area-photos')
    .list(cleanPrefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) throw error;

  const paths = [];

  for (const item of data || []) {
    const fullPath = cleanPrefix ? `${cleanPrefix}/${item.name}` : item.name;
    const looksLikeFolder = !item.id && !item.metadata;

    if (looksLikeFolder) {
      const childPaths = await listStoragePaths(fullPath);
      paths.push(...childPaths);
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
}

export async function deleteAllAreaPhotos() {
  assertSupabase();

  const paths = await listStoragePaths('');
  if (!paths.length) {
    return { removed: 0 };
  }

  let removed = 0;
  const chunkSize = 100;

  for (let index = 0; index < paths.length; index += chunkSize) {
    const chunk = paths.slice(index, index + chunkSize);
    const { error } = await supabase
      .storage
      .from('area-photos')
      .remove(chunk);

    if (error) throw error;
    removed += chunk.length;
  }

  return { removed };
}

export async function cleanupSelectedData(options = {}) {
  assertSupabase();

  const result = {
    cleanScores: 0,
    dutyRecords: 0,
    editLogs: 0,
    dutyAreas: 0,
    storageFiles: 0
  };

  if (options.cleanScores) {
    await deleteAllRows('clean_scores');
    result.cleanScores = 1;
  }

  if (options.dutyRecords) {
    await deleteAllRows('duty_records');
    result.dutyRecords = 1;
  }

  if (options.editLogs) {
    await deleteAllRows('edit_logs');
    result.editLogs = 1;
  }

  if (options.dutyAreas) {
    await deleteAllRows('duty_areas');
    result.dutyAreas = 1;
  }

  if (options.storageFiles) {
    const storageResult = await deleteAllAreaPhotos();
    result.storageFiles = storageResult.removed;
  }

  return result;
}
