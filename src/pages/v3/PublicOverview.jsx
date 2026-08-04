import { useState } from 'react';
import Icon from '../../components/Icon.jsx';

function thaiDate(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`));
}

function statusLabel(status) {
  if (status === 'present') return 'เข้าทำเวร';
  if (status === 'activity') return 'ไปกิจกรรม';
  if (status === 'absent') return 'ไม่เข้าทำเวร';
  return 'รอข้อมูลเวร';
}

function displayScore(value) {
  return value == null ? '—' : Number(value).toFixed(1);
}

export default function PublicOverview({ data, loading, date, onDateChange, onRefresh, navigate }) {
  const [activePhoto, setActivePhoto] = useState(null);
  const dutyTeam = data?.scheduledTeam || null;
  const score = data?.score || null;
  const rooms = data?.rooms || [];
  const combinedScore = score?.cleanliness_score == null || score?.attendance_score == null ? null : Number(score.cleanliness_score) + Number(score.attendance_score);

  return (
    <div className="page-container public-page">
      <section className="hero-panel public-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> ผลเวรประจำวัน</span>
          <h1>{dutyTeam ? <><span>เวรของ</span><br /><em>{dutyTeam.short_name}</em></> : <>เลือกวันที่<br /><em>เพื่อตรวจสอบเวร</em></>}</h1>
          <p>{dutyTeam ? `ติดตามข้อมูล รูปภาพ และผลประเมินของ${dutyTeam.name}ที่อัปเดตแบบ Real-time` : 'ระบบจะแสดงคณะสีและพื้นที่ตามตารางเวรของวันที่เลือก'}</p>
          <div className="hero-actions">
            <label className="date-control">
              <Icon name="calendar" />
              <input type="date" value={date} onInput={(event) => onDateChange(event.currentTarget.value)} onChange={(event) => onDateChange(event.target.value)} />
            </label>
            <button className="button button-secondary" type="button" onClick={onRefresh}><Icon name="refresh" /> รีเฟรช</button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="sun-orb" />
          <div className="leaf leaf-one" />
          <div className="leaf leaf-two" />
          <div className="hero-score"><small>ประจำวันที่</small><strong>{thaiDate(date)}</strong><span>{dutyTeam ? `${dutyTeam.short_name} · ${rooms.length} พื้นที่ · อัปเดตสด` : 'ไม่มีคณะเข้าเวรตามตาราง'}</span></div>
        </div>
      </section>

      {loading ? <div className="room-card-grid public-loading-grid">{[1, 2, 3].map((item) => <div className="room-card-skeleton" key={item} />)}</div> : dutyTeam ? <>
        <section className="duty-overview" style={{ '--team': dutyTeam.accent_color, '--team-soft': dutyTeam.soft_color }}>
          <div className="duty-team-copy"><span className="duty-team-mark" /><div><small>คณะสีที่เข้าเวร</small><h2>{dutyTeam.short_name}</h2><p>{dutyTeam.color_name}</p></div></div>
          <div className="duty-score-strip">
            <span><small>ความสะอาด</small><strong>{displayScore(score?.cleanliness_score)}<i>/10</i></strong></span>
            <span><small>การบริหารจัดการ</small><strong>{displayScore(score?.attendance_score)}<i>/10</i></strong></span>
            <span className="total"><small>รวม</small><strong>{displayScore(combinedScore)}<i>/20</i></strong></span>
          </div>
        </section>

        <section className="section-block results-section photo-results-section">
          <div className="section-heading"><div><span className="eyebrow">ภาพผลการปฏิบัติงาน</span><h2>พื้นที่ในความรับผิดชอบ</h2></div><span className="count-badge">{rooms.length} พื้นที่</span></div>
          {rooms.length ? <div className="room-card-grid">
            {rooms.map((room) => {
              const imageUrl = room.photo_public_urls?.[0] || room.legacy_public_url || room.legacy_thumbnail_url || null;
              const roomCombined = room.cleanliness_score == null || room.attendance_score == null ? null : Number(room.cleanliness_score) + Number(room.attendance_score);
              return <article className="room-result-card" key={room.id} style={{ '--team': dutyTeam.accent_color, '--team-soft': dutyTeam.soft_color }}>
                {imageUrl ? <button className="room-photo-frame" type="button" onClick={() => setActivePhoto({ url: imageUrl, label: room.room_label })} aria-label={`ดูภาพ ${room.room_label} ขนาดใหญ่`}><img src={imageUrl} alt={`ภาพพื้นที่ ${room.room_label}`} loading="lazy" /><span><Icon name="sparkle" size={16} /> กดเพื่อดูภาพใหญ่</span></button> : <div className="room-photo-frame room-photo-placeholder"><span className="empty-icon"><Icon name="sparkle" /></span><strong>ยังไม่มีรูปภาพ</strong></div>}
                <div className="room-result-body">
                  <div className="room-card-title"><div><span className="area-code">{room.team?.short_name || dutyTeam.short_name}</span><h3>{room.room_label}</h3></div><span className={`status-chip ${room.duty_status}`}>{statusLabel(room.duty_status)}</span></div>
                  <div className="room-score-row"><span><small>ความสะอาด</small><strong>{displayScore(room.cleanliness_score)}</strong></span><span><small>บริหารจัดการ</small><strong>{displayScore(room.attendance_score)}</strong></span><span className="total"><small>รวม</small><strong>{displayScore(roomCombined)}</strong></span></div>
                  <p>{room.reason_summary || room.note || 'ไม่มีหมายเหตุเพิ่มเติม'}</p>
                </div>
              </article>;
            })}
          </div> : <div className="empty-panel"><span className="empty-icon"><Icon name="sparkle" size={28} /></span><h3>ยังไม่ได้กำหนดพื้นที่</h3><p>ผู้ดูแลระบบสามารถกำหนดพื้นที่รับผิดชอบให้คณะเวรได้ในหน้าจัดการระบบ</p><button className="button button-text" type="button" onClick={() => navigate('/login')}>เข้าสู่พื้นที่ทำงาน <Icon name="arrow" /></button></div>}
        </section>
      </> : <section className="section-block"><div className="empty-panel tall"><span className="empty-icon"><Icon name="calendar" /></span><h2>วันนี้ไม่มีคณะเข้าเวร</h2><p>อาจเป็นวันหยุด วันเสาร์–อาทิตย์ หรือมีการตั้งค่างดเวรสำหรับวันที่เลือก</p></div></section>}

      {activePhoto ? <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`ภาพพื้นที่ ${activePhoto.label}`} onClick={() => setActivePhoto(null)}>
        <button className="photo-lightbox-close" type="button" onClick={() => setActivePhoto(null)} aria-label="ปิดภาพขนาดใหญ่">×</button>
        <figure onClick={(event) => event.stopPropagation()}><img src={activePhoto.url} alt={`ภาพพื้นที่ ${activePhoto.label}`} /><figcaption>{activePhoto.label}</figcaption></figure>
      </div> : null}
    </div>
  );
}
