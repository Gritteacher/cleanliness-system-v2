import { useMemo, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import TeamBadge from '../components/TeamBadge.jsx';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { calculateAllTeamSummaries, getOverallStats } from '../utils/scoring.js';

export default function AdminSummary({ data }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const summaries = useMemo(() => calculateAllTeamSummaries(data, selectedDate), [data, selectedDate]);
  const stats = useMemo(() => getOverallStats(data, selectedDate), [data, selectedDate]);

  function printReport() {
    window.print();
  }

  return (
    <section className="page-shell">
      <div className="hero-card print-hide">
        <div>
          <span className="eyebrow">Admin Summary</span>
          <h2>สรุปคะแนนสำหรับ Admin</h2>
          <p>{formatThaiDate(selectedDate)}</p>
        </div>
        <div className="hero-actions">
          <label>
            วันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="button" onClick={printReport}>ส่งออก PDF</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="อันดับ 1 วันนี้" value={stats.bestTeam?.team?.shortName || '-'} hint={`${stats.highestScore.toFixed(2)} /30`} accent={stats.bestTeam?.team?.accentColor} />
        <StatCard label="ห้องสมบูรณ์" value={stats.completeRooms} hint="ข้อมูลครบและคะแนนครบ 5 สี" />
        <StatCard label="รอคะแนน" value={stats.waitingRooms} hint="ยังไม่ครบ 5 สี" />
        <StatCard label="ยังไม่มีข้อมูล" value={stats.missingRecords} hint="ยังไม่กรอกการมาทำเวร" />
      </div>

      <div className="table-card">
        <div className="section-title">
          <div>
            <h3>ตารางจัดอันดับคณะสี</h3>
            <p>คะแนนรวมเต็ม 30 คะแนน</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>คณะสี</th>
                <th>ห้องทั้งหมด</th>
                <th>คะแนนจำนวนห้อง</th>
                <th>คะแนนความสะอาด</th>
                <th>คะแนนจำนวนคน</th>
                <th>รวม /30</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary, index) => (
                <tr key={summary.teamId}>
                  <td>#{index + 1}</td>
                  <td><TeamBadge teamId={summary.teamId} /></td>
                  <td>{summary.totalRooms}</td>
                  <td>{summary.roomScore.toFixed(2)}</td>
                  <td>{summary.cleanScore.toFixed(2)}</td>
                  <td>{summary.studentScore.toFixed(2)}</td>
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
