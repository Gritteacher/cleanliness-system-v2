import { colorTeams, getTeam } from '../data/colorTeams.js';

export const STATUS_LABELS = {
  PRESENT: 'มาทำเวร',
  ABSENT: 'ไม่มาทำเวร',
  ACTIVITY: 'ไปกิจกรรม / ไม่นำมาคำนวณ'
};

export const STATUS_BADGE = {
  PRESENT: 'success',
  ABSENT: 'danger',
  ACTIVITY: 'warning',
  NO_RECORD: 'muted',
  WAITING: 'warning',
  COMPLETE: 'success'
};

export function calculateStudentScore(studentCount) {
  const count = Number(studentCount || 0);
  return round2(Math.min((count / 15) * 10, 10));
}

export function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function getAreas(data) {
  return data?.areas || [];
}

export function getAreasForTeam(data, teamId) {
  return getAreas(data).filter((area) => Boolean(area.roomsByTeam?.[teamId]));
}

export function getDutyRecord(data, recordDate, areaId, dutyColorId) {
  return data.dutyRecords.find((record) =>
    record.recordDate === recordDate &&
    record.areaId === areaId &&
    record.dutyColorId === dutyColorId
  );
}

export function getScores(data, recordDate, areaId, dutyColorId) {
  return data.cleanScores.filter((score) =>
    score.recordDate === recordDate &&
    score.areaId === areaId &&
    score.dutyColorId === dutyColorId
  );
}

export function getScoreByEvaluator(data, recordDate, areaId, dutyColorId, evaluatorColorId) {
  return data.cleanScores.find((score) =>
    score.recordDate === recordDate &&
    score.areaId === areaId &&
    score.dutyColorId === dutyColorId &&
    score.evaluatorColorId === evaluatorColorId
  );
}

export function calculateAreaStatus(record, scoreCount) {
  if (!record) return 'ยังไม่มีข้อมูลการมาทำเวร';
  if (record.status === 'ACTIVITY') return 'ไปกิจกรรม / ไม่นำมาคำนวณ';
  if (record.status === 'ABSENT') return 'ไม่มาทำเวร';
  if (!record.photo) return 'ยังไม่มีรูป';
  if (scoreCount < 5) return 'รอคะแนน';
  return 'สมบูรณ์';
}

export function isCompleteRoom(record, scoreCount) {
  if (!record) return false;
  if (record.status !== 'PRESENT') return false;
  return Boolean(record.photo) &&
    record.studentCount !== '' &&
    record.studentCount !== null &&
    record.studentCount !== undefined &&
    scoreCount >= 5;
}

export function calculateRoomSummary(data, recordDate, area, teamId) {
  const team = getTeam(teamId);
  const room = area.roomsByTeam?.[teamId] || '-';
  const record = getDutyRecord(data, recordDate, area.id, teamId);
  const scores = getScores(data, recordDate, area.id, teamId);
  const scoreCount = scores.length;
  const submittedTotal = scores.reduce((sum, item) => sum + Number(item.cleanScore || 0), 0);
  const cleanAverage = scoreCount > 0 ? submittedTotal / scoreCount : 0;
  const allFiveAverage = scoreCount >= 5 ? submittedTotal / 5 : cleanAverage;

  return {
    area,
    team,
    teamId,
    room,
    record,
    scores,
    scoreCount,
    cleanAverage: round2(cleanAverage),
    allFiveAverage: round2(allFiveAverage),
    studentScore: round2(record?.studentScore || 0),
    isActivity: record?.status === 'ACTIVITY',
    complete: isCompleteRoom(record, scoreCount),
    statusText: calculateAreaStatus(record, scoreCount)
  };
}

export function calculateTeamSummary(data, recordDate, teamId) {
  const areas = getAreasForTeam(data, teamId);
  const roomSummaries = areas.map((area) => calculateRoomSummary(data, recordDate, area, teamId));
  const eligibleRooms = roomSummaries.filter((item) => !item.isActivity);
  const eligibleCount = eligibleRooms.length || 1;
  const completeCount = eligibleRooms.filter((item) => item.complete).length;

  const roomScore = round2(Math.min(((completeCount / eligibleCount) / 0.8) * 10, 10));
  const cleanScore = round2(
    eligibleRooms.reduce((sum, item) => sum + Number(item.cleanAverage || 0), 0) / eligibleCount
  );
  const studentScore = round2(
    eligibleRooms.reduce((sum, item) => sum + Number(item.studentScore || 0), 0) / eligibleCount
  );

  return {
    team: getTeam(teamId),
    teamId,
    totalRooms: areas.length,
    eligibleRooms: eligibleRooms.length,
    completeRooms: completeCount,
    waitingRooms: eligibleRooms.filter((item) => item.statusText === 'รอคะแนน').length,
    missingRecords: eligibleRooms.filter((item) => !item.record).length,
    fullScoreRooms: eligibleRooms.filter((item) => item.scoreCount >= 5).length,
    roomScore,
    cleanScore,
    studentScore,
    totalScore: round2(roomScore + cleanScore + studentScore),
    rooms: roomSummaries
  };
}

export function calculateAllTeamSummaries(data, recordDate) {
  return colorTeams
    .map((team) => calculateTeamSummary(data, recordDate, team.id))
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function getOverallStats(data, recordDate) {
  const summaries = calculateAllTeamSummaries(data, recordDate);
  const rooms = summaries.flatMap((summary) => summary.rooms);
  return {
    summaries,
    bestTeam: summaries[0],
    highestScore: summaries[0]?.totalScore || 0,
    completeRooms: rooms.filter((room) => room.complete).length,
    waitingRooms: rooms.filter((room) => room.statusText === 'รอคะแนน').length,
    missingRecords: rooms.filter((room) => !room.record).length,
    fullScoreRooms: rooms.filter((room) => room.scoreCount >= 5).length
  };
}
