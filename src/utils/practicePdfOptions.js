import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS } from './practiceSchedule.js';

export function practicePdfOptions(input) {
  const { start, end, teamIds } = input || {};
  if (![start,end].every(value => typeof value === 'string' && /^2026-11-\d{2}$/.test(value) && value >= PRACTICE_START && value <= PRACTICE_END)) throw new Error('กรุณาเลือกวันที่ระหว่าง 2–30 พฤศจิกายน 2569');
  if (start > end) throw new Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
  if (!Array.isArray(teamIds) || !teamIds.length || teamIds.length > 5 || new Set(teamIds).size !== teamIds.length || teamIds.some(id => !PRACTICE_TEAMS.some(t => t.id === id))) throw new Error('กรุณาเลือกคณะสีอย่างน้อย 1 สี');
  const teams = PRACTICE_TEAMS.filter(t => teamIds.includes(t.id));
  const days = [];
  for (let day = Number(start.slice(-2)); day <= Number(end.slice(-2)); day++) days.push(`2026-11-${String(day).padStart(2,'0')}`);
  return { start, end, teamIds: teams.map(t => t.id), teams, days };
}
