import { DAY_LABELS, getTeamByDutyDay } from '../data/colorTeams.js';

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatThaiDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long'
  }).format(date);
}

export function getDayKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const map = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday'
  };
  return map[day] || 'weekend';
}

export function getDayLabel(dateString) {
  const key = getDayKey(dateString);
  return DAY_LABELS[key] || 'วันหยุด';
}

export function getDutyTeamForDate(dateString) {
  return getTeamByDutyDay(getDayKey(dateString));
}

export function nowText() {
  return new Date().toLocaleString('th-TH');
}

export function nextWeekdayDate(dayKey) {
  const targetMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
  const target = targetMap[dayKey] ?? 1;
  const date = new Date();
  const diff = (target - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}
