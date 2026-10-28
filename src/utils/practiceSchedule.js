export const PRACTICE_START = '2026-11-02';
export const PRACTICE_END = '2026-11-30';
export const PRACTICE_TEAMS = [
  { id: 'maen', name: 'แม้นนฤมิตร', color: 'สีม่วง', accent: '#7C3AED', soft: '#F3E8FF' },
  { id: 'yaowaman', name: 'เยาวมาลย์อุทิศ', color: 'สีน้ำเงิน', accent: '#2563EB', soft: '#DBEAFE' },
  { id: 'nipha', name: 'นิภานภดล', color: 'สีแสด', accent: '#F97316', soft: '#FFEDD5' },
  { id: 'piyarat', name: 'ปิยราชบพิตร', color: 'สีชมพู', accent: '#EC4899', soft: '#FCE7F3' },
  { id: 'phanu', name: 'ภาณุรังษี', color: 'สีแดง', accent: '#DC2626', soft: '#FEE2E2' }
];

export function practiceSchedule(date) {
  if (!/^2026-11-\d{2}$/.test(date || '') || date < PRACTICE_START || date > PRACTICE_END) return { enabled: false, label: 'นอกช่วงรายงาน 2–30 พฤศจิกายน 2569' };
  if (date === '2026-11-07') return { enabled: false, label: 'งดซ้อม — 7 พฤศจิกายน 2569' };
  const day = new Date(`${date}T12:00:00+07:00`).getUTCDay();
  if (day === 0 || day === 6) return { enabled: true, start: '08:00', end: '16:00', label: '08.00–16.00 น.' };
  const end = date <= '2026-11-15' ? '19:00' : '20:00';
  return { enabled: true, start: null, end, label: `สิ้นสุด ${end.replace(':', '.')} น.` };
}

export function practiceDefaultDate(today) { return today < PRACTICE_START ? PRACTICE_START : today > PRACTICE_END ? PRACTICE_END : today; }
export function practiceDateLabel(date) { return new Intl.DateTimeFormat('th-TH', { dateStyle: 'full', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
