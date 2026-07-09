import { useMemo, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import { colorTeams } from '../data/colorTeams.js';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { STATUS_LABELS, STATUS_BADGE, calculateRoomSummary } from '../utils/scoring.js';

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

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const safeStart = start <= end ? start : end;
  const safeEnd = start <= end ? end : start;
  const dates = [];
  const cursor = new Date(safeStart);

  while (cursor <= safeEnd) {
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

function getTeamHasDataOnDate(data, date, teamId) {
  const hasDutyRecord = data.dutyRecords.some((record) =>
    record.recordDate === date && record.dutyColorId === teamId
  );

  const hasScore = data.cleanScores.some((score) =>
    score.recordDate === date && score.dutyColorId === teamId
  );

  return hasDutyRecord || hasScore;
}

function getTeamDates(data, allDates, team, forceEveryTeam = false) {
  if (forceEveryTeam) return allDates;

  const scheduledDates = allDates.filter((date) => {
    const day = parseLocalDate(date).getDay();
    return DAY_TO_DUTY[day] === team.dutyDay;
  });

  const extraDates = allDates.filter((date) => getTeamHasDataOnDate(data, date, team.id));

  return Array.from(new Set([...scheduledDates, ...extraDates])).sort();
}

function buildReportRows(data, allDates, teamFilter, statusFilter, forceEveryTeam) {
  const teams = teamFilter === 'all'
    ? colorTeams
    : colorTeams.filter((team) => team.id === teamFilter);

  const rows = [];

  teams.forEach((team) => {
    const teamDates = getTeamDates(data, allDates, team, forceEveryTeam);

    teamDates.forEach((date) => {
      const areas = data.areas.filter((area) => Boolean(area.roomsByTeam?.[team.id]));

      areas.forEach((area) => {
        const summary = calculateRoomSummary(data, date, area, team.id);
        const record = summary.record;
        const status = record?.status || 'NO_RECORD';
        const isActivity = status === 'ACTIVITY';
        const photoStatus = record?.photo ? 'มีรูปแล้ว' : 'ไม่มีรูป';
        const scoreStatus = isActivity
          ? 'ยกเว้น'
          : `${summary.scoreCount}/5 สี`;
        const cleanAverageText = isActivity
          ? 'ยกเว้น'
          : summary.scoreCount ? summary.cleanAverage.toFixed(2) : '-';
        const studentScoreText = isActivity
          ? 'ยกเว้น'
          : record ? Number(record.studentScore || 0).toFixed(2) : '-';
        const countedText = isActivity ? 'ไม่นำมาคำนวณทุกคะแนน' : 'นำมาคำนวณ';
        const completeText = isActivity
          ? 'ยกเว้นการประเมิน'
          : summary.complete ? 'สมบูรณ์' : summary.statusText;

        const row = {
          id: `${date}-${team.id}-${area.id}`,
          date,
          team,
          teamId: team.id,
          area,
          room: area.roomsByTeam?.[team.id] || '-',
          record,
          status,
          statusLabel: STATUS_LABELS[status] || 'ยังไม่กรอกข้อมูล',
          photoStatus,
          scoreStatus,
          scoreCount: summary.scoreCount,
          cleanAverageText,
          studentScoreText,
          countedText,
          completeText,
          note: record?.photoNote || '',
          submittedName: record?.submittedName || '-',
          submittedAt: record?.submittedAt || '',
          isActivity,
          complete: summary.complete
        };

        if (statusFilter === 'all' || row.status === statusFilter) {
          rows.push(row);
        }
      });
    });
  });

  return rows.sort((a, b) => (
    a.date.localeCompare(b.date) ||
    a.team.name.localeCompare(b.team.name, 'th') ||
    Number(a.area.areaNo || 0) - Number(b.area.areaNo || 0)
  ));
}

export default function AdminSubmissionReport({ data }) {
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
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const range = useMemo(() => {
    if (reportType === 'day') {
      return {
        start: selectedDate,
        end: selectedDate,
        label: formatThaiDate(selectedDate),
        forceEveryTeam: true
      };
    }

    if (reportType === 'month') {
      const bounds = getMonthBounds(selectedMonth);
      return {
        start: bounds.start,
        end: bounds.end,
        label: getMonthLabel(selectedMonth),
        forceEveryTeam: false
      };
    }

    if (reportType === 'monthRange') {
      const startBounds = getMonthBounds(startMonth);
      const endBounds = getMonthBounds(endMonth);

      return {
        start: startBounds.start <= endBounds.start ? startBounds.start : endBounds.start,
        end: startBounds.start <= endBounds.start ? endBounds.end : startBounds.end,
        label: `${getMonthLabel(startMonth)} - ${getMonthLabel(endMonth)}`,
        forceEveryTeam: false
      };
    }

    if (reportType === 'year') {
      const bounds = getYearBounds(selectedYear);
      return {
        start: bounds.start,
        end: bounds.end,
        label: `ปี ${Number(selectedYear) + 543}`,
        forceEveryTeam: false
      };
    }

    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;

    return {
      start,
      end,
      label: getRangeLabel(start, end),
      forceEveryTeam: start === end
    };
  }, [reportType, selectedDate, selectedMonth, startMonth, endMonth, selectedYear, startDate, endDate]);

  const allDates = useMemo(() => getDaysInRange(range.start, range.end), [range.start, range.end]);

  const rows = useMemo(
    () => buildReportRows(data, allDates, teamFilter, statusFilter, range.forceEveryTeam),
    [data, allDates, teamFilter, statusFilter, range.forceEveryTeam]
  );

  const stats = useMemo(() => {
    const filled = rows.filter((row) => row.record).length;
    const missing = rows.filter((row) => !row.record).length;
    const activity = rows.filter((row) => row.isActivity).length;
    const complete = rows.filter((row) => row.complete).length;

    return {
      filled,
      missing,
      activity,
      complete
    };
  }, [rows]);

  function printReport() {
    window.print();
  }

  return (
    <section className="page-shell admin-report-page">
      <div className="hero-card print-hide">
        <div>
          <span className="eyebrow">Submission Report</span>
          <h2>รายงานการกรอกข้อมูล</h2>
          <p>{range.label}</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={printReport}>ส่งออก PDF</button>
        </div>
      </div>

      <div className="filter-card summary-filter-card print-hide">
        <label>
          รูปแบบรายงาน
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

        <label>
          คณะสี
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="all">ทุกคณะสี</option>
            {colorTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </label>

        <label>
          สถานะ
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="PRESENT">มาทำเวร</option>
            <option value="ABSENT">ไม่มาทำเวร</option>
            <option value="ACTIVITY">ไปกิจกรรม / ยกเว้นการคำนวณ</option>
            <option value="NO_RECORD">ยังไม่กรอกข้อมูล</option>
          </select>
        </label>

        <div className="range-preview">
          <strong>ช่วงที่แสดงผล</strong>
          <span>{range.label}</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="รายการที่กรอกแล้ว" value={stats.filled} hint="มีข้อมูลการมาทำเวร" />
        <StatCard label="ยังไม่กรอก" value={stats.missing} hint="ยังไม่มีข้อมูลในช่วงที่เลือก" />
        <StatCard label="ไปกิจกรรม" value={stats.activity} hint="ไม่นำมาคำนวณทุกคะแนน" />
        <StatCard label="สมบูรณ์" value={stats.complete} hint="ข้อมูลครบและคะแนนครบ 5 สี" />
      </div>

      <div className="table-card">
        <div className="section-title">
          <div>
            <h3>รายละเอียดการกรอกข้อมูล</h3>
            <p>
              ห้องที่เลือกสถานะไปกิจกรรมจะแสดงว่า “ไม่นำมาคำนวณทุกคะแนน” และจะไม่ถูกนับในจำนวนห้อง คะแนนจำนวนคน คะแนนจำนวนห้อง หรือคะแนนความสะอาด
            </p>
          </div>
        </div>

        <div className="responsive-table report-table-wrap">
          <table className="submission-report-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>คณะสี</th>
                <th>ห้อง</th>
                <th>พื้นที่</th>
                <th>สถานะ</th>
                <th>จำนวนคน</th>
                <th>คะแนนคน</th>
                <th>รูป</th>
                <th>คะแนนสะอาด</th>
                <th>ผู้ให้คะแนน</th>
                <th>การคำนวณ</th>
                <th>ผู้กรอก</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActivity ? 'activity-row' : ''}>
                  <td>{formatThaiDate(row.date)}</td>
                  <td><TeamBadge teamId={row.teamId} size="small" /></td>
                  <td>{row.room}</td>
                  <td>{row.area.areaName}</td>
                  <td>
                    <span className={`chip ${STATUS_BADGE[row.status] || 'muted'}`}>
                      {row.statusLabel}
                    </span>
                    <small className="status-note">{row.completeText}</small>
                  </td>
                  <td>{row.isActivity ? 'ยกเว้น' : row.record?.studentCount ?? '-'}</td>
                  <td>{row.studentScoreText}</td>
                  <td>
                    <div className="report-photo-cell">
                      <span>{row.photoStatus}</span>
                      {row.record?.photo ? <PhotoPreview src={row.record.photo} thumb={row.record.photoThumb} compact /> : null}
                    </div>
                  </td>
                  <td>{row.cleanAverageText}</td>
                  <td>{row.scoreStatus}</td>
                  <td>{row.countedText}</td>
                  <td>
                    <span>{row.submittedName}</span>
                    {row.submittedAt ? <small>{new Date(row.submittedAt).toLocaleString('th-TH')}</small> : null}
                  </td>
                  <td>{row.note || '-'}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan="13">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
