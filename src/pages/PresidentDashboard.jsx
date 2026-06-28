import { useMemo } from 'react';
import { getTeam } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import { todayISO, formatThaiDate, getDutyTeamForDate } from '../utils/dateUtils.js';
import { calculateAllTeamSummaries, getAreasForTeam } from '../utils/scoring.js';

export default function PresidentDashboard({ data, user, navigate }) {
  const today = todayISO();
  const myTeam = getTeam(user.colorTeamId);
  const dutyTeam = getDutyTeamForDate(today);
  const isMyDuty = dutyTeam?.id === myTeam?.id;

  const summaries = useMemo(() => calculateAllTeamSummaries(data, today), [data, today]);
  const mySummary = summaries.find((summary) => summary.teamId === myTeam?.id);
  const areasToScore = data.areas.length;
  const myScoreCount = data.cleanScores.filter((score) =>
    score.recordDate === today &&
    score.evaluatorColorId === myTeam?.id
  ).length;

  const dutyAreas = dutyTeam ? getAreasForTeam(data, dutyTeam.id) : [];
  const dutyRecordCount = dutyTeam
    ? data.dutyRecords.filter((record) => record.recordDate === today && record.dutyColorId === dutyTeam.id).length
    : 0;

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">President Dashboard</span>
          <h2>สวัสดี {user.displayName}</h2>
          <p>{formatThaiDate(today)}</p>
          <div className="badge-row">
            <TeamBadge teamId={myTeam?.id} />
            {dutyTeam ? <TeamBadge teamId={dutyTeam.id} label={`เวรวันนี้: ${dutyTeam.shortName}`} /> : <span className="chip muted">วันนี้ไม่มีเวรคณะสี</span>}
            <span className={`chip ${isMyDuty ? 'success' : 'warning'}`}>
              {isMyDuty ? 'คุณเป็นเวรวันนี้' : 'วันนี้ให้คะแนนความสะอาดเท่านั้น'}
            </span>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="คะแนนคณะของคุณ" value={`${mySummary?.totalScore.toFixed(2) || '0.00'} /30`} hint="คะแนนของวันที่ปัจจุบัน" accent={myTeam?.accentColor} />
        <StatCard label="ข้อมูลการมาทำเวร" value={`${dutyRecordCount}/${dutyAreas.length}`} hint="ของคณะสีเวรวันนี้" accent={dutyTeam?.accentColor || '#0B1F3A'} />
        <StatCard label="คุณให้คะแนนแล้ว" value={`${myScoreCount}/${areasToScore}`} hint="รายการคะแนนวันนี้" accent={myTeam?.accentColor} />
      </div>

      <div className="menu-grid">
        <button className="menu-card" type="button" onClick={() => navigate('/duty-record')}>
          <strong>กรอกข้อมูลการมาทำเวร</strong>
          <p>รูปภาพ จำนวนคน สถานะ และหมายเหตุ</p>
        </button>
        <button className="menu-card" type="button" onClick={() => navigate('/clean-score')}>
          <strong>ให้คะแนนความสะอาด</strong>
          <p>ประธานทั้ง 5 สีให้คะแนน /10</p>
        </button>
        <button className="menu-card" type="button" onClick={() => navigate('/')}>
          <strong>ดูคะแนนสาธารณะ</strong>
          <p>ดูการ์ดคณะสีและรายห้อง</p>
        </button>
      </div>
    </section>
  );
}
