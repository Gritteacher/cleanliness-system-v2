import { useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { todayISO } from '../utils/dateUtils.js';
import { calculateTeamSummary, getAreasForTeam } from '../utils/scoring.js';

export default function AdminCompleteness({ data }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const dutyCompleteness = useMemo(() => colorTeams.map((team) => {
    const areas = getAreasForTeam(data, team.id);
    const submitted = data.dutyRecords.filter((record) =>
      record.recordDate === selectedDate && record.dutyColorId === team.id
    ).length;
    return {
      team,
      total: areas.length,
      submitted,
      missing: Math.max(areas.length - submitted, 0),
      percent: areas.length ? (submitted / areas.length) * 100 : 0
    };
  }), [data, selectedDate]);

  const scoreCompleteness = useMemo(() => colorTeams.map((team) => {
    const totalNeed = data.areas.reduce((sum, area) => {
      return sum + colorTeams.filter((owner) => area.roomsByTeam?.[owner.id]).length;
    }, 0);
    const submitted = data.cleanScores.filter((score) =>
      score.recordDate === selectedDate && score.evaluatorColorId === team.id
    ).length;
    return {
      team,
      total: totalNeed,
      submitted,
      missing: Math.max(totalNeed - submitted, 0),
      percent: totalNeed ? (submitted / totalNeed) * 100 : 0
    };
  }), [data, selectedDate]);

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Completeness</span>
          <h2>ตรวจสอบความครบถ้วน</h2>
          <p>ข้อมูลการมาทำเวรและการให้คะแนนของประธาน 5 สี</p>
        </div>
        <div className="hero-actions">
          <label>
            วันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
        </div>
      </div>

      <CompletenessTable title="ความครบถ้วนของข้อมูลการมาทำเวร" rows={dutyCompleteness} totalLabel="จำนวนพื้นที่ทั้งหมด" />
      <CompletenessTable title="ความครบถ้วนการให้คะแนนของประธาน" rows={scoreCompleteness} totalLabel="ต้องให้คะแนนทั้งหมด" />
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
