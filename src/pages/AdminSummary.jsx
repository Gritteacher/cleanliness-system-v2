import { useMemo, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import { colorTeams } from '../data/colorTeams.js';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { calculateTeamSummary } from '../utils/scoring.js';

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

function getTeamActiveDates(data, allDates, teamId, forceSingleDay = false) {
  if (forceSingleDay) return allDates;

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

function buildRangeSummaries(data, startDate, endDate, forceSingleDay = false) {
  const allDates = getDaysInRange(startDate, endDate);

  return colorTeams.map((team) => {
    const activeDates = getTeamActiveDates(data, allDates, team.id, forceSingleDay);
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
      totalRooms: firstSummary.totalRooms,
      eligibleRooms: firstSummary.eligibleRooms,
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

export default function AdminSummary({ data }) {
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

  const range = useMemo(() => {
    if (reportType === 'day') {
      return {
        start: selectedDate,
        end: selectedDate,
        label: formatThaiDate(selectedDate),
        forceSingleDay: true
      };
    }

    if (reportType === 'month') {
      const bounds = getMonthBounds(selectedMonth);
      return {
        start: bounds.start,
        end: bounds.end,
        label: getMonthLabel(selectedMonth),
        forceSingleDay: false
      };
    }

    if (reportType === 'monthRange') {
      const startBounds = getMonthBounds(startMonth);
      const endBounds = getMonthBounds(endMonth);
      return {
        start: startBounds.start <= endBounds.start ? startBounds.start : endBounds.start,
        end: startBounds.start <= endBounds.start ? endBounds.end : startBounds.end,
        label: `${getMonthLabel(startMonth)} - ${getMonthLabel(endMonth)}`,
        forceSingleDay: false
      };
    }

    if (reportType === 'year') {
      const bounds = getYearBounds(selectedYear);
      return {
        start: bounds.start,
        end: bounds.end,
        label: `ปี ${Number(selectedYear) + 543}`,
        forceSingleDay: false
      };
    }

    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;

    return {
      start,
      end,
      label: getRangeLabel(start, end),
      forceSingleDay: start === end
    };
  }, [reportType, selectedDate, selectedMonth, startMonth, endMonth, selectedYear, startDate, endDate]);

  const summaries = useMemo(
    () => buildRangeSummaries(data, range.start, range.end, range.forceSingleDay),
    [data, range.start, range.end, range.forceSingleDay]
  );

  const cleanRanking = useMemo(() => (
    [...summaries].sort((a, b) => b.cleanScore - a.cleanScore)
  ), [summaries]);

  const managementRanking = useMemo(() => (
    [...summaries].sort((a, b) => b.managementScore - a.managementScore)
  ), [summaries]);

  const stats = useMemo(() => {
    const totalActiveDays = summaries.reduce((sum, item) => sum + Number(item.activeDateCount || 0), 0);
    const bestTeam = summaries[0];

    return {
      bestTeam,
      highestScore: bestTeam?.totalScore || 0,
      totalActiveDays,
      completeRooms: summaries.reduce((sum, item) => sum + Number(item.completeRooms || 0), 0),
      waitingRooms: summaries.reduce((sum, item) => sum + Number(item.waitingRooms || 0), 0),
      missingRecords: summaries.reduce((sum, item) => sum + Number(item.missingRecords || 0), 0)
    };
  }, [summaries]);

  function printReport() {
    window.print();
  }

  return (
    <section className="page-shell">
      <div className="hero-card print-hide">
        <div>
          <span className="eyebrow">Admin Summary</span>
          <h2>สรุปคะแนนสำหรับ Admin</h2>
          <p>{range.label}</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={printReport}>ส่งออก PDF</button>
        </div>
      </div>

      <div className="filter-card summary-filter-card print-hide">
        <label>
          รูปแบบสรุป
          <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
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
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        ) : null}

        {reportType === 'month' ? (
          <label>
            เลือกเดือน
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </label>
        ) : null}

        {reportType === 'monthRange' ? (
          <>
            <label>
              เดือนเริ่มต้น
              <input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} />
            </label>
            <label>
              เดือนสิ้นสุด
              <input type="month" value={endMonth} onChange={(event) => setEndMonth(event.target.value)} />
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
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              วันสิ้นสุด
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </>
        ) : null}

        <div className="range-preview">
          <strong>ช่วงที่แสดงผล</strong>
          <span>{range.label}</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="อันดับ 1 ในช่วงนี้" value={stats.bestTeam?.team?.shortName || '-'} hint={`${stats.highestScore.toFixed(2)} /30`} accent={stats.bestTeam?.team?.accentColor} />
        <StatCard label="จำนวนวันประเมิน" value={stats.totalActiveDays} hint="รวมวันประเมินของทุกคณะสี" />
        <StatCard label="ห้องสมบูรณ์รวม" value={stats.completeRooms} hint="รวมทุกวันที่อยู่ในช่วง" />
        <StatCard label="ยังไม่มีข้อมูลรวม" value={stats.missingRecords} hint="รวมทุกวันที่อยู่ในช่วง" />
      </div>

      <div className="table-card">
        <div className="section-title">
          <div>
            <h3>1. ตารางสรุปคะแนนความสะอาด</h3>
            <p>เรียงลำดับจากคะแนนมากไปน้อย เฉลี่ยตามช่วงวันที่เลือก เต็ม 10 คะแนน</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>คณะสี</th>
                <th>จำนวนวัน</th>
                <th>คะแนนความสะอาด /10</th>
                <th>ห้องสมบูรณ์รวม</th>
                <th>รอคะแนนรวม</th>
              </tr>
            </thead>
            <tbody>
              {cleanRanking.map((summary, index) => (
                <tr key={summary.teamId}>
                  <td>{index + 1}</td>
                  <td><TeamBadge teamId={summary.teamId} /></td>
                  <td>{summary.activeDateCount}</td>
                  <td><strong>{summary.cleanScore.toFixed(2)}</strong></td>
                  <td>{summary.completeRooms}</td>
                  <td>{summary.waitingRooms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <div className="section-title">
          <div>
            <h3>2. ตารางสรุปคะแนนการบริหารจัดการ</h3>
            <p>คำนวณจากคะแนนจำนวนคน + คะแนนจำนวนห้อง เฉลี่ยตามช่วงวันที่เลือก เต็ม 20 คะแนน</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>คณะสี</th>
                <th>จำนวนวัน</th>
                <th>คะแนนจำนวนคน /10</th>
                <th>คะแนนจำนวนห้อง /10</th>
                <th>รวมการบริหารจัดการ /20</th>
              </tr>
            </thead>
            <tbody>
              {managementRanking.map((summary, index) => (
                <tr key={summary.teamId}>
                  <td>{index + 1}</td>
                  <td><TeamBadge teamId={summary.teamId} /></td>
                  <td>{summary.activeDateCount}</td>
                  <td>{summary.studentScore.toFixed(2)}</td>
                  <td>{summary.roomScore.toFixed(2)}</td>
                  <td><strong>{summary.managementScore.toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <div className="section-title">
          <div>
            <h3>ตารางรวมคะแนนทั้งหมด</h3>
            <p>คะแนนรวมเต็ม 30 คะแนน เฉลี่ยตามช่วงวันที่เลือก</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>คณะสี</th>
                <th>จำนวนวัน</th>
                <th>คะแนนความสะอาด</th>
                <th>คะแนนจำนวนคน</th>
                <th>คะแนนจำนวนห้อง</th>
                <th>รวม /30</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary, index) => (
                <tr key={summary.teamId}>
                  <td>{index + 1}</td>
                  <td><TeamBadge teamId={summary.teamId} /></td>
                  <td>{summary.activeDateCount}</td>
                  <td>{summary.cleanScore.toFixed(2)}</td>
                  <td>{summary.studentScore.toFixed(2)}</td>
                  <td>{summary.roomScore.toFixed(2)}</td>
                  <td><strong>{summary.totalScore.toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
