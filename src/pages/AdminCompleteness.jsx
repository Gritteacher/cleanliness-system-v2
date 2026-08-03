import { useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { todayISO, getDutyTeamForDate, formatThaiDate } from '../utils/dateUtils.js';
import {
  getAreasForTeam,
  getDutyRecord,
  getScoreByEvaluator
} from '../utils/scoring.js';

function getActiveDutyTeams(data, selectedDate) {
  const scheduledTeam = getDutyTeamForDate(selectedDate);
  const teamIds = new Set();

  if (scheduledTeam) {
    teamIds.add(scheduledTeam.id);
  }

  (data.dutyRecords || []).forEach((record) => {
    if (record.recordDate === selectedDate) {
      teamIds.add(record.dutyColorId);
    }
  });

  (data.cleanScores || []).forEach((score) => {
    if (score.recordDate === selectedDate) {
      teamIds.add(score.dutyColorId);
    }
  });

  return colorTeams.filter((team) => teamIds.has(team.id));
}

export default function AdminCompleteness({ data }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const activeDutyTeams = useMemo(
    () => getActiveDutyTeams(data, selectedDate),
    [data, selectedDate]
  );

  const dutyCompleteness = useMemo(() => activeDutyTeams.map((team) => {
    const areas = getAreasForTeam(data, team.id);
    const submitted = areas.filter((area) =>
      Boolean(getDutyRecord(data, selectedDate, area.id, team.id))
    ).length;

    return {
      team,
      total: areas.length,
      submitted,
      missing: Math.max(areas.length - submitted, 0),
      percent: areas.length ? (submitted / areas.length) * 100 : 0
    };
  }), [data, selectedDate, activeDutyTeams]);

  const scoreCompleteness = useMemo(() => colorTeams.map((evaluatorTeam) => {
    const expectedRooms = activeDutyTeams.flatMap((ownerTeam) => (
      getAreasForTeam(data, ownerTeam.id)
        .filter((area) => {
          const record = getDutyRecord(data, selectedDate, area.id, ownerTeam.id);
          return record?.status !== 'ACTIVITY';
        })
        .map((area) => ({
          area,
          ownerTeam
        }))
    ));

    const submitted = expectedRooms.filter(({ area, ownerTeam }) => (
      Boolean(getScoreByEvaluator(
        data,
        selectedDate,
        area.id,
        ownerTeam.id,
        evaluatorTeam.id
      ))
    )).length;

    return {
      team: evaluatorTeam,
      total: expectedRooms.length,
      submitted,
      missing: Math.max(expectedRooms.length - submitted, 0),
      percent: expectedRooms.length ? (submitted / expectedRooms.length) * 100 : 0
    };
  }), [data, selectedDate, activeDutyTeams]);

  const scheduledTeam = getDutyTeamForDate(selectedDate);
  const activeLabel = activeDutyTeams.length
    ? activeDutyTeams.map((team) => team.shortName).join(', ')
    : 'ไม่มีคณะสีเวรหรือข้อมูลในวันที่เลือก';

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Completeness</span>
          <h2>ตรวจสอบความครบถ้วน</h2>
          <p>{formatThaiDate(selectedDate)}</p>
          <div className="alert info compact-alert">
            คณะสีเวรที่นำมาตรวจ: {activeLabel}
            {scheduledTeam ? ` • เวรตามตาราง: ${scheduledTeam.shortName}` : ''}
          </div>
        </div>
        <div className="hero-actions">
          <label>
            วันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
        </div>
      </div>

      {!activeDutyTeams.length ? (
        <div className="empty-state">
          <h2>ไม่มีข้อมูลสำหรับวันที่เลือก</h2>
          <p>ระบบจะตรวจเฉพาะคณะสีเวรตามวัน และคณะสีที่ Admin บันทึกข้อมูลเพิ่มในวันนั้น</p>
        </div>
      ) : (
        <>
          <CompletenessTable
            title="ความครบถ้วนของข้อมูลการมาทำเวร"
            rows={dutyCompleteness}
            totalLabel="พื้นที่ของคณะสีเวร"
          />
          <CompletenessTable
            title="ความครบถ้วนการให้คะแนนของประธาน"
            rows={scoreCompleteness}
            totalLabel="ห้องที่ต้องให้คะแนน"
          />
          <div className="alert info">
            ห้องที่เลือก “ไปกิจกรรม” จะไม่ถูกนับเป็นห้องที่ต้องให้คะแนน และไม่ถูกนำไปคำนวณคะแนนทุกประเภท
          </div>
        </>
      )}
    </section>
  );
}

function CompletenessTable({ title, rows, totalLabel }) {
  return (
    <div className="table-card">
      <div className="section-title">
        <h3>{title}</h3>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>คณะสี / ประธานสี</th>
              <th>{totalLabel}</th>
              <th>ทำแล้ว</th>
              <th>ยังไม่ทำ</th>
              <th>ความครบถ้วน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team.id}>
                <td><TeamBadge teamId={row.team.id} /></td>
                <td>{row.total}</td>
                <td>{row.submitted}</td>
                <td>{row.missing}</td>
                <td><ProgressBar value={row.submitted} max={row.total} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
