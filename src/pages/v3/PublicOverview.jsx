import Icon from '../../components/Icon.jsx';

function thaiDate(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`));
}

function scoreForTeam(scores, teamId) {
  return scores.find((score) => score.team_id === teamId);
}

export default function PublicOverview({ data, loading, date, onDateChange, onRefresh, navigate }) {
  const teams = data?.teams || [];
  const scores = data?.scores || [];
  const rooms = data?.rooms || [];
  const ranked = [...teams].sort((a, b) => Number(scoreForTeam(scores, b.id)?.total_score || 0) - Number(scoreForTeam(scores, a.id)?.total_score || 0));

  return (
    <div className="page-container public-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> พื้นที่สาธารณะ</span>
          <h1>โรงเรียนสะอาด<br /><em>เริ่มจากพวกเราทุกคน</em></h1>
          <p>ติดตามผลการดูแลพื้นที่ของแต่ละคณะอย่างโปร่งใส เข้าใจง่าย และเป็นกำลังใจให้กันทุกวัน</p>
          <div className="hero-actions">
            <label className="date-control">
              <Icon name="calendar" />
              <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
            </label>
            <button className="button button-secondary" type="button" onClick={onRefresh}><Icon name="refresh" /> รีเฟรช</button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="sun-orb" />
          <div className="leaf leaf-one" />
          <div className="leaf leaf-two" />
          <div className="hero-score"><small>ประจำวันที่</small><strong>{thaiDate(date)}</strong><span>{rooms.length} พื้นที่เผยแพร่แล้ว</span></div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">ภาพรวม 5 คณะ</span><h2>คะแนนวันนี้</h2></div>
          <p>คะแนนที่แสดงเป็นผลซึ่งผ่านการตรวจสอบและเผยแพร่แล้ว</p>
        </div>

        {loading ? <div className="skeleton-grid">{teams.concat([1, 2, 3, 4, 5]).slice(0, 5).map((_, index) => <div className="skeleton-card" key={index} />)}</div> : (
          <div className="team-grid">
            {ranked.map((team, index) => {
              const score = scoreForTeam(scores, team.id);
              return (
                <article className="team-card" key={team.id} style={{ '--team': team.accent_color, '--team-soft': team.soft_color }}>
                  <div className="team-card-top"><span className="team-swatch" /><span className="rank">#{score ? index + 1 : '–'}</span></div>
                  <h3>{team.short_name}</h3><p>{team.color_name}</p>
                  <div className="score-line"><strong>{score ? Number(score.total_score).toFixed(1) : '—'}</strong><span>/ 30</span></div>
                  <div className="score-meter"><i style={{ width: `${Math.min(100, (Number(score?.total_score || 0) / 30) * 100)}%` }} /></div>
                  <div className="score-parts"><span>สะอาด {score ? Number(score.cleanliness_score).toFixed(1) : '–'}</span><span>เวร {score ? Number(score.attendance_score).toFixed(1) : '–'}</span></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section-block results-section">
        <div className="section-heading"><div><span className="eyebrow">รายละเอียด</span><h2>ผลรายพื้นที่</h2></div><span className="count-badge">{rooms.length} รายการ</span></div>
        {rooms.length ? (
          <div className="result-list">
            {rooms.map((room) => (
              <article className="result-row" key={room.id}>
                <span className="result-team" style={{ background: room.team?.accent_color }} />
                {room.photo_public_urls?.[0] || room.legacy_thumbnail_url || room.legacy_public_url ? <img className="result-thumb" src={room.photo_public_urls?.[0] || room.legacy_thumbnail_url || room.legacy_public_url} alt={`ภาพพื้นที่ ${room.room_label}`} loading="lazy" /> : <span className="result-thumb placeholder">ไม่มีรูป</span>}
                <div><strong>{room.room_label}</strong><small>{room.team?.short_name || 'ไม่ระบุคณะ'}</small></div>
                <span className={`status-chip ${room.duty_status}`}>{room.duty_status === 'present' ? 'เข้าทำเวร' : room.duty_status === 'activity' ? 'ไปกิจกรรม' : 'ไม่เข้าทำเวร'}</span>
                <strong className="result-score">{room.cleanliness_score == null ? '—' : Number(room.cleanliness_score).toFixed(1)}</strong>
                <p>{room.reason_summary || 'ยังไม่มีหมายเหตุ'}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel"><span className="empty-icon"><Icon name="sparkle" size={28} /></span><h3>ยังไม่มีผลเผยแพร่ในวันนี้</h3><p>เมื่อผู้ดูแลตรวจสอบข้อมูลแล้ว ผลคะแนนรายพื้นที่จะแสดงที่นี่</p><button className="button button-text" type="button" onClick={() => navigate('/login')}>เข้าสู่พื้นที่ทำงาน <Icon name="arrow" /></button></div>
        )}
      </section>
    </div>
  );
}
