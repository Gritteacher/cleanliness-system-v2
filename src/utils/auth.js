import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const AUTH_KEY = 'cleanliness_v2_auth';
const USERNAME_EMAIL_DOMAIN = 'tsn.local';

function usernameToEmail(username) {
  const clean = String(username || '').trim();
  if (clean.includes('@')) return clean;
  return `${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

async function fetchProfile(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    colorTeamId: data.color_team_id
  };
}

export async function login(username, password) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env' };
  }

  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { ok: false, message: 'Username หรือ Password ไม่ถูกต้อง หรือยังไม่ได้สร้างผู้ใช้ใน Supabase Auth' };
  }

  try {
    const profile = await fetchProfile(data.user.id);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
    return { ok: true, user: profile };
  } catch (profileError) {
    await supabase.auth.signOut();
    return { ok: false, message: 'เข้าสู่ระบบได้ แต่ยังไม่พบข้อมูลสิทธิ์ในตาราง profiles' };
  }
}

export async function logout() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(AUTH_KEY);
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured || !supabase) {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }

  try {
    const profile = await fetchProfile(data.session.user.id);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function isAdmin(user) {
  return user?.role === 'ADMIN';
}

export function isPresident(user) {
  return user?.role === 'PRESIDENT';
}
