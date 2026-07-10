import { useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import MobileCard from '../components/MobileCard.jsx';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { calculateAllTeamSummaries, calculateTeamSummary } from '../utils/scoring.js';

export default function PublicScoreboard({ data, navigate }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedTeamId, setSelectedTeamId] = useState(colorTeams[0].id);

  const summaries = useMemo(
    () => calculateAllTeamSummaries(data, selectedDate),
    [data, selectedDate]
  );

  const selectedSummary = useMemo(
    () => calculateTeamSummary(data, selectedDate, selectedTeamId),
    [data, selectedDate, selectedTeamId]
  );

  return (
    <section className="page-shell public-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Public Scoreboard</span>
          <h2>คะแนนความสะอาดคณะสี</h2>
          <p>ดูคะแนนและรูปภาพพื้นที่รับผิดชอบได้โดยไม่ต้องเข้าสู่ระบบ</p>
        </div>
        <div className="hero-actions">
          <label>
            เลือกวันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/login')}>
            เข้าสู่ระบบ
          </button>
        </div>
      </div>

      <div className="section-title">
        <div>
          <h3>คะแนนประจำวันที่ {formatThaiDate(selectedDate)}</h3>
          <p>เลือกคณะสีเพื่อดูการ์ดรายห้องและรูปภาพ Preview</p>
        </div>
      </div>

      <div className="team-card-grid">
        {summaries.map((summary) => (
          <button
            key={summary.teamId}
            className={`team-score-card ${selectedTeamId === summary.teamId ? 'selected' : ''}`}
            style={{ '--accent': summary.team.accentColor, '--soft': summary.team.softColor }}
            type="button"
            onClick={() => setSelectedTeamId(summary.teamId)}
          >
            <TeamBadge teamId={summary.teamId} />
            <strong>{summary.totalScore.toFixed(2)} /30</strong>
            <div className="score-split">
              <span>สะอาด {summary.cleanScore.toFixed(2)}</span>
              <span>คะแนนคน {summary.studentScore.toFixed(2)}</span>
              <span>ห้อง {summary.roomScore.toFixed(2)}</span>
            </div>
            <small>สมบูรณ์ {summary.completeRooms}/{summary.totalRooms} ห้อง</small>
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <StatCard label="คณะที่เลือก" value={selectedSummary.team.name} hint={selectedSummary.team.colorName} accent={selectedSummary.team.accentColor} />
        <StatCard label="คะแนนรวม" value={`${selectedSummary.totalScore.toFixed(2)} /30`} hint="คะแนนรวมของคณะสี" accent={selectedSummary.team.accentColor} />
        <StatCard label="ห้องสมบูรณ์" value={`${selectedSummary.completeRooms}/${selectedSummary.totalRooms}`} hint="ข้อมูลครบตามเกณฑ์" accent={selectedSummary.team.accentColor} />
      </div>

      <div className="section-title">
        <div>
          <h3>รายละเอียดรายห้อง: {selectedSummary.team.name}</h3>
          <p>บุคคลทั่วไปดูข้อมูลสรุป รูปภาพ คะแนนสะอาด และเหตุผลการให้คะแนนได้</p>
        </div>
      </div>

      <div className="room-card-grid">
        {selectedSummary.rooms.map((room) => (
          <MobileCard
            key={`${room.area.id}-${room.teamId}`}
            title={`ห้อง ${room.room}`}
            subtitle={room.area.areaName}
            accent={selectedSummary.team.accentColor}
          >
            <PhotoPreview
              src={room.record?.photo}
              thumb={room.record?.photoThumb}
              alt={`รูปพื้นที่ ${room.area.areaName}`}
            />
            <div className="detail-list">
              <div><span>คณะสี</span><TeamBadge teamId={room.teamId} size="small" /></div>
              <div><span>สถานะ</span><b>{room.statusText}</b></div>
              <div><span>คะแนนจำนวนคน</span><b>{room.isActivity ? 'ยกเว้น' : `${room.studentScore.toFixed(2)} /10`}</b></div>
              <div><span>คะแนนสะอาด</span><b>{room.isActivity ? 'ยกเว้น' : `${room.cleanAverage.toFixed(2)} /10`}</b></div>
            </div>

            <div className="public-reason-box">
              <strong>เหตุผลการให้คะแนน</strong>
              {room.isActivity ? (
                <p>ห้องนี้ไปกิจกรรม จึงไม่นำมาคำนวณคะแนนและไม่ต้องให้เหตุผลการประเมิน</p>
              ) : room.scores.length ? (
                <div className="public-reason-list">
                  {room.scores.map((score) => (
                    <div key={score.id} className="public-reason-item">
                      <div className="public-reason-head">
                        <TeamBadge teamId={score.evaluatorColorId} size="small" />
                        <b>{Number(score.cleanScore || 0).toFixed(2)} /10</b>
                      </div>
                      <p>{score.scoreNote || 'ไม่ได้ระบุเหตุผล'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>ยังไม่มีการให้คะแนน จึงยังไม่มีเหตุผลการประเมิน</p>
              )}
            </div>
          </MobileCard>
        ))}
      </div>
    </section>
  );
}
