import { defaultDutyAreas } from '../data/dutyAreas.js';
import { createInitialData } from '../data/mockData.js';
import { todayISO } from './dateUtils.js';

const STORAGE_KEY = 'cleanliness_v2_app_data';

export function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.areas) parsed.areas = defaultDutyAreas;
      if (!parsed.dutyRecords) parsed.dutyRecords = [];
      if (!parsed.cleanScores) parsed.cleanScores = [];
      if (!parsed.editLogs) parsed.editLogs = [];
      return parsed;
    }
  } catch {
    // fallback to fresh empty data
  }

  const fresh = createInitialData(todayISO(), defaultDutyAreas);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetDemoData() {
  const fresh = createInitialData(todayISO(), defaultDutyAreas);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function addLog(data, log) {
  const next = {
    ...data,
    editLogs: [
      {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        ...log
      },
      ...(data.editLogs || [])
    ]
  };
  saveAppData(next);
  return next;
}
