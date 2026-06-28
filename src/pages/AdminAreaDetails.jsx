import { useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import MobileCard from '../components/MobileCard.jsx';
import { todayISO } from '../utils/dateUtils.js';
import { calculateTeamSummary } from '../utils/scoring.js';

export default function AdminAreaDetails({ data }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [teamId, setTeamId] = useState(colorTeams[0].id);
  const summary = useMemo(() => calculateTeamSummary(data, selectedDate, teamId), [data, selectedDate, teamId]);

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Area Details</span>
          <h2>รายละเอียดรายพื้นที่ / รายห้อง</h2>
          <p>ดูรูปภาพ คะแนน และสถานะแต่ละห้อง</p>
        </div>
        <div className="hero-actions">
          <label>
            วันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <label>
            คณะสี
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {colorTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="room-card-grid">
        {summary.rooms.map((room) => (
          <MobileCard
            key={`${room.area.id}-${room.teamId}`}
            title={`ห้อง ${room.room}`}
            subtitle={room.area.areaName}
            accent={summary.team.accentColor}
          >
            <PhotoPreview src={room.record?.photo} thumb={room.record?.photoThumb} />
            <div className="detail-list">
              <div><span>คณะสี</span><TeamBadge teamId={room.teamId} size="small" /></div>
              <div><span>สถานะ</span><b>{room.statusText}</b></div>
              <div><span>จำนวนคน</span><b>{room.record?.studentCount ?? '-'} คน</b></div>
              <div><span>คะแนนคน</span><b>{room.studentScore.toFixed(2)} /10</b></div>
              <div><span>คะแนนสะอาดเฉลี่ย</span><b>{room.cleanAverage.toFixed(2)} /10</b></div>
              <div><span>คะแนนประธาน</span><b>{room.scoreCount}/5 สี</b></div>
            </div>
          </MobileCard>
        ))}
      </div>
    </section>
  );
}
