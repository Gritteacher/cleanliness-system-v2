import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const USERNAME_EMAIL_DOMAIN = 'tsn.local';

export function usernameToEmail(username) {
  const clean = String(username || '').trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

function normalizeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    teamId: row.team_id,
    active: row.active,
    team: row.team || null
  };
}

async function fetchProfile(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  const { data, error } = await supabase
    .from('cs_profiles')
    .select('*, team:cs_teams(*)')
    .eq('id', userId)
    .single();

  if (error) throw error;
  if (!data.active) throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  return normalizeProfile(data);
}

export async function login(username, password) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า Supabase ใน Environment Variables' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });

  if (error) {
    return { ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  try {
    const profile = await fetchProfile(data.user.id);
    return { ok: true, user: profile };
  } catch (profileError) {
    await supabase.auth.signOut();
    return { ok: false, message: profileError.message || 'ไม่พบสิทธิ์ผู้ใช้ในระบบ V3' };
  }
}

export async function logout() {
  if (supabase) await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? fetchProfile(data.session.user.id) : null;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isPresident(user) {
  return user?.role === 'president';
}
