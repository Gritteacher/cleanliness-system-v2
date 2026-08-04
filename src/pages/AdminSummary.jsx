import { useMemo, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import { colorTeams, getTeam } from '../data/colorTeams.js';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { calculateTeamSummary } from '../utils/scoring.js';
import { addLog } from '../utils/storage.js';
import {
  upsertCleanScores,
  insertEditLogs
} from '../services/supabaseService.js';

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม'
];

const DAY_TO_DUTY = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday'
};

const DETAIL_CONTEXT = {
  clean: {
    title: 'รายละเอียดคะแนนความสะอาด',
    description: 'แสดงห้องและสิทธิ์ประธานที่ยังไม่ได้ให้คะแนน'
  },
  management: {
    title: 'รายละเอียดคะแนนการบริหารจัดการ',
    description: 'แสดงข้อมูลการทำเวรที่ยังขาด และคะแนนประธานที่ทำให้ห้องยังไม่สมบูรณ์'
  },
  total: {
    title: 'รายละเอียดคะแนนรวมทั้งหมด',
    description: 'แสดงทั้งคะแนนความสะอาดและข้อมูลการบริหารจัดการที่ยังไม่ครบ'
  }
};

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function getDaysInRange(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getMonthBounds(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getYearBounds(yearValue) {
  return {
    start: `${yearValue}-01-01`,
    end: `${yearValue}-12-31`
  };
}

function getMonthLabel(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function getRangeLabel(startDate, endDate) {
  if (startDate === endDate) return formatThaiDate(startDate);
  return `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
}

function getDateHasTeamData(data, date, teamId) {
  const hasDutyRecord = data.dutyRecords.some((record) =>
    record.recordDate === date && record.dutyColorId === teamId
  );

  const hasScore = data.cleanScores.some((score) =>
    score.recordDate === date && score.dutyColorId === teamId
  );

  return hasDutyRecord || hasScore;
}

function getTeamActiveDates(data, allDates, teamId) {
  const team = colorTeams.find((item) => item.id === teamId);
  const scheduledDates = allDates.filter((date) => {
    const day = parseLocalDate(date).getDay();
    return DAY_TO_DUTY[day] === team?.dutyDay;
  });

  const extraDates = allDates.filter((date) => getDateHasTeamData(data, date, teamId));

  return Array.from(new Set([...scheduledDates, ...extraDates])).sort();
}

function average(items, field) {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  return total / items.length;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function buildRangeSummaries(data, startDate, endDate) {
  const allDates = getDaysInRange(startDate, endDate);

  return colorTeams.map((team) => {
    const activeDates = getTeamActiveDates(data, allDates, team.id);
    const dailySummaries = activeDates.map((date) => calculateTeamSummary(data, date, team.id));
    const firstSummary = dailySummaries[0] || calculateTeamSummary(data, startDate, team.id);

    const cleanScore = round2(average(dailySummaries, 'cleanScore'));
    const studentScore = round2(average(dailySummaries, 'studentScore'));
    const roomScore = round2(average(dailySummaries, 'roomScore'));
    const managementScore = round2(studentScore + roomScore);
    const totalScore = round2(cleanScore + managementScore);

    return {
      ...firstSummary,
      team,
      teamId: team.id,
      activeDateCount: activeDates.length,
      activeDates,
      totalRooms: activeDates.length ? firstSummary.totalRooms : 0,
      eligibleRooms: activeDates.length ? firstSummary.eligibleRooms : 0,
      completeRooms: dailySummaries.reduce((sum, item) => sum + Number(item.completeRooms || 0), 0),
      waitingRooms: dailySummaries.reduce((sum, item) => sum + Number(item.waitingRooms || 0), 0),
      missingRecords: dailySummaries.reduce((sum, item) => sum + Number(item.missingRecords || 0), 0),
      fullScoreRooms: dailySummaries.reduce((sum, item) => sum + Number(item.fullScoreRooms || 0), 0),
      cleanScore,
      studentScore,
      roomScore,
      managementScore,
      totalScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

function getMissingEvaluatorTeams(room) {
  if (room.isActivity) return [];

  const submittedIds = new Set(
    room.scores.map((score) => score.evaluatorColorId)
  );

  return colorTeams.filter((team) => !submittedIds.has(team.id));
}

function getManagementIssues(room) {
  if (room.isActivity) return [];

  if (!room.record) {
    return ['ยังไม่มีข้อมูลการมาทำเวร'];
  }

  if (room.record.status === 'ABSENT') {
    return ['สถานะไม่มาทำเวร'];
  }

  if (room.record.status !== 'PRESENT') {
    return ['สถานะยังไม่พร้อมนำมาคำนวณ'];
  }

  const issues = [];

  if (
    room.record.studentCount === '' ||
    room.record.studentCount === null ||
    room.record.studentCount === undefined
  ) {
    issues.push('ยังไม่ได้กรอกจำนวนคน');
  }

  if (!room.record.photo) {
    issues.push('ยังไม่มีรูปภาพ');
  }

  const missingEvaluators = getMissingEvaluatorTeams(room);
  if (missingEvaluators.length) {
    issues.push(`คะแนนประธานยังไม่ครบ ${room.scoreCount}/5 สี`);
  }

  return issues;
}

function makePendingKey(date, room, evaluatorId) {
  return `${date}::${room.area.id}::${room.teamId}::${evaluatorId}`;
}

export default function AdminSummary({
  data,
  setData,
  user,
  refreshData,
  navigate
}) {
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);

  const [reportType, setReportType] = useState('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [detailSelection, setDetailSelection] = useState(null);
  const [pendingScores, setPendingScores] = useState({});
  const [bulkScore, setBulkScore] = useState('');
  const [detailMessage, setDetailMessage] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);

  const range = useMemo(() => {
    if (reportType === 'day') {
      return {
        start: selectedDate,
        end: selectedDate,
        label: formatThaiDate(selectedDate)
      };
    }

    if (reportType === 'month') {
      const bounds = getMonthBounds(selectedMonth);
      return {
        start: bounds.start,
        end: bounds.end,
        label: getMonthLabel(selectedMonth)
      };
    }

    if (reportType === 'monthRange') {
      const startBounds = getMonthBounds(startMonth);
      const endBounds = getMonthBounds(endMonth);
      return {
        start: startBounds.start <= endBounds.start ? startBounds.start : endBounds.start,
        end: startBounds.start <= endBounds.start ? endBounds.end : startBounds.end,
        label: `${getMonthLabel(startMonth)} - ${getMonthLabel(endMonth)}`
      };
    }

    if (reportType === 'year') {
      const bounds = getYearBounds(selectedYear);
      return {
        start: bounds.start,
        end: bounds.end,
        label: `ปี ${Number(selectedYear) + 543}`
      };
    }

    const safeStart = startDate <= endDate ? startDate : endDate;
    const safeEnd = startDate <= endDate ? endDate : startDate;

    return {
      start: safeStart,
      end: safeEnd,
      label: getRangeLabel(safeStart, safeEnd)
    };
  }, [
    reportType,
    selectedDate,
    selectedMonth,
    startMonth,
    endMonth,
    selectedYear,
    startDate,
    endDate
  ]);

  const summaries = useMemo(
    () => buildRangeSummaries(data, range.start, range.end),
    [data, range.start, range.end]
  );

  const cleanRanking = useMemo(() => (
    [...summaries].sort((a, b) => b.cleanScore - a.cleanScore)
  ), [summaries]);

  const managementRanking = useMemo(() => (
    [...summaries].sort((a, b) => b.managementScore - a.managementScore)
  ), [summaries]);

  const stats = useMemo(() => {
    const totalActiveDays = summaries.reduce(
      (sum, item) => sum + Number(item.activeDateCount || 0),
      0
    );
    const bestTeam = summaries[0];

    return {
      bestTeam,
      highestScore: bestTeam?.totalScore || 0,
      totalActiveDays,
      completeRooms: summaries.reduce(
        (sum, item) => sum + Number(item.completeRooms || 0),
        0
      ),
      missingRecords: summaries.reduce(
        (sum, item) => sum + Number(item.missingRecords || 0),
        0
      )
    };
  }, [summaries]);

  const selectedSummary = useMemo(() => {
    if (!detailSelection) return null;
    return summaries.find((item) => item.teamId === detailSelection.teamId) || null;
  }, [detailSelection, summaries]);

  const detailRows = useMemo(() => {
    if (!selectedSummary || !detailSelection) return [];

    const rows = selectedSummary.activeDates.flatMap((date) => {
      const dailySummary = calculateTeamSummary(data, date, selectedSummary.teamId);

      return dailySummary.rooms.map((room) => {
        const missingEvaluators = getMissingEvaluatorTeams(room);
        const managementIssues = getManagementIssues(room);

        return {
          date,
          room,
          missingEvaluators,
          managementIssues
        };
      });
    });

    return rows.filter((item) => {
      if (item.room.isActivity) return false;

      if (detailSelection.context === 'clean') {
        return item.missingEvaluators.length > 0;
      }

      if (detailSelection.context === 'management') {
        return item.managementIssues.length > 0;
      }

      return (
        item.missingEvaluators.length > 0 ||
        item.managementIssues.length > 0
      );
    });
  }, [data, detailSelection, selectedSummary]);

  const missingScoreEntries = useMemo(() => (
    detailRows.flatMap((item) => (
      item.missingEvaluators.map((evaluatorTeam) => ({
        ...item,
        evaluatorTeam,
        key: makePendingKey(item.date, item.room, evaluatorTeam.id)
      }))
    ))
  ), [detailRows]);

  const filledPendingCount = useMemo(() => (
    missingScoreEntries.filter((entry) => {
      const value = pendingScores[entry.key]?.score;
      return value !== '' && value !== undefined && value !== null;
    }).length
  ), [missingScoreEntries, pendingScores]);

  function openDetail(teamId, context) {
    setDetailSelection({ teamId, context });
    setPendingScores({});
    setBulkScore('');
    setDetailMessage('');
  }

  function closeDetail() {
    if (detailBusy) return;
    setDetailSelection(null);
    setPendingScores({});
    setBulkScore('');
    setDetailMessage('');
  }

  function updatePendingScore(key, field, value) {
    setPendingScores((current) => ({
      ...current,
      [key]: {
        score: current[key]?.score ?? '',
        note: current[key]?.note ?? '',
        [field]: value
      }
    }));
  }

  function applyBulkScore() {
    const score = Number(bulkScore);

    if (!Number.isFinite(score) || score < 0 || score > 10) {
      setDetailMessage('กรุณากรอกคะแนนรวมระหว่าง 0–10');
      return;
    }

    if (!missingScoreEntries.length) {
      setDetailMessage('ไม่มีรายการคะแนนที่ยังขาด');
      return;
    }

    setPendingScores((current) => {
      const next = { ...current };

      missingScoreEntries.forEach((entry) => {
        next[entry.key] = {
          score: String(score),
          note: next[entry.key]?.note ?? ''
        };
      });

      return next;
    });

    setDetailMessage(
      `ใส่คะแนน ${score} ให้รายการที่ยังขาด ${missingScoreEntries.length} รายการแล้ว`
    );
  }

  async function saveMissingScores(event) {
    event.preventDefault();

    const filledEntries = missingScoreEntries.filter((entry) => {
      const value = pendingScores[entry.key]?.score;
      return value !== '' && value !== undefined && value !== null;
    });

    if (!filledEntries.length) {
      setDetailMessage('กรุณากรอกคะแนนอย่างน้อย 1 รายการ');
      return;
    }

    const invalidEntry = filledEntries.find((entry) => {
      const score = Number(pendingScores[entry.key]?.score);
      return !Number.isFinite(score) || score < 0 || score > 10;
    });

    if (invalidEntry) {
      setDetailMessage(
        `คะแนนห้อง ${invalidEntry.room.room} ของ${invalidEntry.evaluatorTeam.shortName}ต้องอยู่ระหว่าง 0–10`
      );
      return;
    }

    setDetailBusy(true);
    setDetailMessage('');

    try {
      const timestamp = new Date().toISOString();
      const nextScores = filledEntries.map((entry) => {
        const evaluatorTeam = getTeam(entry.evaluatorTeam.id);
        const score = Number(pendingScores[entry.key].score);
        const note = String(pendingScores[entry.key].note || '').trim();
        const scoreId =
          `${entry.date}-${entry.room.area.id}-${entry.room.teamId}-${entry.evaluatorTeam.id}`;

        return {
          id: scoreId,
          recordDate: entry.date,
          areaId: entry.room.area.id,
          room: entry.room.room,
          dutyColorId: entry.room.teamId,
          evaluatorColorId: entry.evaluatorTeam.id,
          cleanScore: score,
          scoreNote: note,
          submittedBy: user.id,
          submittedName:
            `${user.displayName} (แทน${evaluatorTeam?.shortName || entry.evaluatorTeam.id})`,
          submittedAt: timestamp,
          updatedAt: timestamp
        };
      });

      const logs = nextScores.map((score, index) => ({
        id: `log-${Date.now()}-${index}`,
        editedAt: timestamp,
        action: 'ADMIN_FILL_MISSING_SCORE_FROM_SUMMARY',
        tableName: 'cleanScores',
        recordId: score.id,
        oldData: null,
        newData: score,
        editedBy: user.displayName
      }));

      await upsertCleanScores(nextScores);

      try {
        await insertEditLogs(logs);
      } catch {
        // ไม่ให้ประวัติการแก้ไขทำให้การบันทึกคะแนนหลักล้มเหลว
      }

      const scoreMap = new Map(
        (data.cleanScores || []).map((score) => [score.id, score])
      );

      nextScores.forEach((score) => {
        scoreMap.set(score.id, score);
      });

      let nextData = {
        ...data,
        cleanScores: Array.from(scoreMap.values())
      };

      logs.forEach((log) => {
        nextData = addLog(nextData, log);
      });

      setData(nextData);
      setPendingScores({});
      setBulkScore('');
      setDetailMessage(`บันทึกคะแนนที่ยังขาดเรียบร้อย ${nextScores.length} รายการ`);

      try {
        await refreshData();
      } catch {
        // ใช้ข้อมูลในหน้าจอต่อได้
      }
    } catch (error) {
      setDetailMessage(`บันทึกคะแนนไม่สำเร็จ: ${error.message}`);
    } finally {
      setDetailBusy(false);
    }
  }

  function printReport() {
    window.print();
  }

  const detailConfig = detailSelection
    ? DETAIL_CONTEXT[detailSelection.context]
    : null;

  return (
    <section className="page-shell">
      <div className="hero-card print-hide">
        <div>
          <span className="eyebrow">Admin Summary</span>
          <h2>สรุปคะแนนสำหรับ Admin</h2>
          <p>{range.label}</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={printReport}>
            ส่งออก PDF
          </button>
        </div>
      </div>

      <div className="filter-card summary-filter-card print-hide">
        <label>
          รูปแบบสรุป
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            <option value="day">รายวัน</option>
            <option value="month">รายเดือน</option>
            <option value="monthRange">ช่วงเดือน</option>
            <option value="year">รายปี</option>
            <option value="dateRange">ช่วงวันที่</option>
          </select>
        </label>

        {reportType === 'day' ? (
          <label>
            เลือกวัน
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        ) : null}

        {reportType === 'month' ? (
          <label>
            เลือกเดือน
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
        ) : null}

        {reportType === 'monthRange' ? (
          <>
            <label>
              เดือนเริ่มต้น
              <input
                type="month"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
              />
            </label>
            <label>
              เดือนสิ้นสุด
              <input
                type="month"
                value={endMonth}
                onChange={(event) => setEndMonth(event.target.value)}
              />
            </label>
          </>
        ) : null}

        {reportType === 'year' ? (
          <label>
            เลือกปี ค.ศ.
            <input
              type="number"
              min="2024"
              max="2099"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            />
          </label>
        ) : null}

        {reportType === 'dateRange' ? (
          <>
            <label>
              วันเริ่มต้น
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              วันสิ้นสุด
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </>
        ) : null}

        <div className="range-preview">
          <strong>ช่วงที่แสดงผล</strong>
          <span>{range.label}</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="อันดับ 1 ในช่วงนี้"
          value={stats.bestTeam?.team?.shortName || '-'}
          hint={`${stats.highestScore.toFixed(2)} /30`}
          accent={stats.bestTeam?.team?.accentColor}
        />
        <StatCard
          label="จำนวนวันประเมิน"
          value={stats.totalActiveDays}
          hint="รวมวันประเมินของทุกคณะสี"
        />
        <StatCard
          label="ห้องสมบูรณ์รวม"
          value={stats.completeRooms}
          hint="รวมทุกวันที่อยู่ในช่วง"
        />
        <StatCard
          label="ยังไม่มีข้อมูลรวม"
          value={stats.missingRecords}
          hint="รวมทุกวันที่อยู่ในช่วง"
        />
      </div>

      <SummaryTableCard
        title="1. ตารางสรุปคะแนนความสะอาด"
        description="เรียงลำดับจากคะแนนมากไปน้อย เฉลี่ยตามช่วงวันที่เลือก เต็ม 10 คะแนน • คลิกแถวเพื่อดูจุดที่คะแนนยังไม่ครบและกรอกคะแนนได้"
        rows={cleanRanking}
        context="clean"
        onOpen={openDetail}
        columns={[
          { label: 'คะแนนความสะอาด /10', render: (summary) => <strong>{summary.cleanScore.toFixed(2)}</strong> },
          { label: 'ห้องสมบูรณ์รวม', render: (summary) => summary.completeRooms },
          { label: 'รอคะแนนจริง', render: (summary) => summary.waitingRooms }
        ]}
      />

      <SummaryTableCard
        title="2. ตารางสรุปคะแนนการบริหารจัดการ"
        description="คำนวณจากคะแนนจำนวนคน + คะแนนจำนวนห้อง เฉลี่ยตามช่วงวันที่เลือก เต็ม 20 คะแนน • คลิกแถวเพื่อดูข้อมูลที่ยังไม่ครบและกรอกคะแนนที่ขาด"
        rows={managementRanking}
        context="management"
        onOpen={openDetail}
        columns={[
          { label: 'คะแนนจำนวนคน /10', render: (summary) => summary.studentScore.toFixed(2) },
          { label: 'คะแนนจำนวนห้อง /10', render: (summary) => summary.roomScore.toFixed(2) },
          { label: 'รวมการบริหารจัดการ /20', render: (summary) => <strong>{summary.managementScore.toFixed(2)}</strong> }
        ]}
      />

      <SummaryTableCard
        title="ตารางรวมคะแนนทั้งหมด"
        description="คะแนนรวมเต็ม 30 คะแนน เฉลี่ยตามช่วงวันที่เลือก • คลิกแถวเพื่อดูรายละเอียดทุกส่วนที่ยังไม่ครบและกรอกคะแนนได้"
        rows={summaries}
        context="total"
        onOpen={openDetail}
        columns={[
          { label: 'คะแนนความสะอาด', render: (summary) => summary.cleanScore.toFixed(2) },
          { label: 'คะแนนจำนวนคน', render: (summary) => summary.studentScore.toFixed(2) },
          { label: 'คะแนนจำนวนห้อง', render: (summary) => summary.roomScore.toFixed(2) },
          { label: 'รวม /30', render: (summary) => <strong>{summary.totalScore.toFixed(2)}</strong> }
        ]}
      />

      {detailSelection && selectedSummary ? (
        <div className="modal-backdrop summary-detail-backdrop print-hide">
          <form
            className="edit-modal summary-detail-modal"
            onSubmit={saveMissingScores}
          >
            <div className="summary-detail-header">
              <div>
                <span className="eyebrow">{detailConfig?.title}</span>
                <h3>{selectedSummary.team.name}</h3>
                <p>{detailConfig?.description}</p>
                <small>{range.label}</small>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closeDetail}
              >
                ปิด
              </button>
            </div>

            <div className="summary-detail-stats">
              <div>
                <span>วันที่ประเมิน</span>
                <strong>{selectedSummary.activeDateCount}</strong>
              </div>
              <div>
                <span>ห้องสมบูรณ์</span>
                <strong>{selectedSummary.completeRooms}</strong>
              </div>
              <div>
                <span>คะแนนที่ยังขาด</span>
                <strong>{missingScoreEntries.length}</strong>
              </div>
              <div>
                <span>รายการที่ต้องตรวจ</span>
                <strong>{detailRows.length}</strong>
              </div>
            </div>

            {detailMessage ? (
              <div className={
                detailMessage.includes('ไม่สำเร็จ') ||
                detailMessage.includes('กรุณา') ||
                detailMessage.includes('ต้องอยู่')
                  ? 'alert danger'
                  : 'alert success'
              }>
                {detailMessage}
              </div>
            ) : null}

            {missingScoreEntries.length ? (
              <div className="summary-bulk-score">
                <label>
                  คะแนนเดียวสำหรับรายการที่ยังขาดทั้งหมด
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.25"
                    value={bulkScore}
                    onChange={(event) => setBulkScore(event.target.value)}
                    placeholder="0-10"
                  />
                </label>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={applyBulkScore}
                >
                  ใส่คะแนนทุกช่อง
                </button>
              </div>
            ) : null}

            <div className="summary-detail-scroll">
              {detailRows.map((item) => {
                const showManagementIssues =
                  detailSelection.context === 'management' ||
                  detailSelection.context === 'total';

                return (
                  <article
                    key={`${item.date}-${item.room.area.id}-${item.room.teamId}`}
                    className="summary-issue-card"
                  >
                    <div className="summary-issue-head">
                      <div>
                        <span>{formatThaiDate(item.date)}</span>
                        <h4>ห้อง {item.room.room}</h4>
                        <p>{item.room.area.areaName}</p>
                      </div>
                      <TeamBadge
                        teamId={item.room.teamId}
                        size="small"
                      />
                    </div>

                    <div className="summary-issue-meta">
                      <span>
                        คะแนนประธาน {item.room.scoreCount}/5 สี
                      </span>
                      <span>
                        สถานะ {item.room.statusText}
                      </span>
                    </div>

                    {showManagementIssues && item.managementIssues.length ? (
                      <div className="summary-management-issues">
                        <strong>ข้อมูลที่ยังไม่ครบ</strong>
                        <ul>
                          {item.managementIssues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                        {item.managementIssues.some((issue) => (
                          issue.includes('ข้อมูลการมาทำเวร') ||
                          issue.includes('จำนวนคน') ||
                          issue.includes('รูปภาพ') ||
                          issue.includes('สถานะ')
                        )) ? (
                          <button
                            className="btn btn-ghost btn-small"
                            type="button"
                            onClick={() => navigate('/duty-record')}
                          >
                            ไปกรอกข้อมูลการทำเวร
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {item.missingEvaluators.length ? (
                      <div className="summary-missing-score-list">
                        <strong>กรอกคะแนนประธานที่ยังขาด</strong>

                        {item.missingEvaluators.map((evaluatorTeam) => {
                          const key = makePendingKey(
                            item.date,
                            item.room,
                            evaluatorTeam.id
                          );

                          return (
                            <div
                              key={evaluatorTeam.id}
                              className="summary-missing-score-row"
                            >
                              <TeamBadge
                                teamId={evaluatorTeam.id}
                                size="small"
                              />

                              <label>
                                คะแนน /10
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.25"
                                  value={pendingScores[key]?.score ?? ''}
                                  onChange={(event) => updatePendingScore(
                                    key,
                                    'score',
                                    event.target.value
                                  )}
                                  placeholder="0-10"
                                />
                              </label>

                              <label>
                                เหตุผล / หมายเหตุ
                                <input
                                  value={pendingScores[key]?.note ?? ''}
                                  onChange={(event) => updatePendingScore(
                                    key,
                                    'note',
                                    event.target.value
                                  )}
                                  placeholder="ระบุเหตุผล"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="alert success compact-alert">
                        คะแนนประธานครบ 5 สีแล้ว
                      </div>
                    )}
                  </article>
                );
              })}

              {!detailRows.length ? (
                <div className="empty-state summary-detail-empty">
                  <h3>ข้อมูลครบแล้ว</h3>
                  <p>ไม่พบรายการคะแนนหรือข้อมูลที่ยังขาดในช่วงที่เลือก</p>
                </div>
              ) : null}
            </div>

            <div className="summary-detail-actions">
              <div>
                <span>กรอกคะแนนแล้ว</span>
                <strong>{filledPendingCount}/{missingScoreEntries.length} รายการ</strong>
              </div>
              <div className="action-row">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={detailBusy || !filledPendingCount}
                >
                  {detailBusy
                    ? 'กำลังบันทึก...'
                    : `บันทึก ${filledPendingCount} คะแนน`}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={detailBusy}
                  onClick={closeDetail}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function SummaryTableCard({
  title,
  description,
  rows,
  context,
  onOpen,
  columns
}) {
  return (
    <div className="table-card">
      <div className="section-title">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>อันดับ</th>
              <th>คณะสี</th>
              <th>จำนวนวัน</th>
              {columns.map((column) => (
                <th key={column.label}>{column.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((summary, index) => (
              <tr
                key={summary.teamId}
                className="summary-click-row"
                role="button"
                tabIndex="0"
                title="คลิกเพื่อดูรายละเอียดคะแนนที่ยังไม่ครบ"
                onClick={() => onOpen(summary.teamId, context)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(summary.teamId, context);
                  }
                }}
              >
                <td>{index + 1}</td>
                <td>
                  <TeamBadge teamId={summary.teamId} />
                  <small className="summary-row-hint">
                    คลิกดูรายละเอียด
                  </small>
                </td>
                <td>{summary.activeDateCount}</td>
                {columns.map((column) => (
                  <td key={column.label}>
                    {column.render(summary)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
