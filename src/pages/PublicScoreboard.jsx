import { useEffect, useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import MobileCard from '../components/MobileCard.jsx';
import { todayISO, formatThaiDate } from '../utils/dateUtils.js';
import { calculateAllTeamSummaries, calculateTeamSummary } from '../utils/scoring.js';

function getInitialPublicDate() {
  const params = new URLSearchParams(window.location.search);
  return params.get('date') || todayISO();
}

function getIsPdfMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('pdf') === '1';
}

export default function PublicScoreboard({ data, navigate }) {
  const isPdfMode = getIsPdfMode();
  const [selectedDate, setSelectedDate] = useState(getInitialPublicDate());
  const [selectedTeamId, setSelectedTeamId] = useState(colorTeams[0].id);
  const [showPdfLogin, setShowPdfLogin] = useState(false);
  const [pdfForm, setPdfForm] = useState({ username: '', password: '' });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState('');

  const summaries = useMemo(
    () => calculateAllTeamSummaries(data, selectedDate),
    [data, selectedDate]
  );

  const selectedSummary = useMemo(
    () => calculateTeamSummary(data, selectedDate, selectedTeamId),
    [data, selectedDate, selectedTeamId]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pdf') === '1' && params.get('autoprint') === '1') {
      const timer = window.setTimeout(() => {
        window.print();
      }, 1200);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, []);

  const detailSummaries = isPdfMode ? summaries : [selectedSummary];

  function updatePdfField(name, value) {
    setPdfForm((prev) => ({ ...prev, [name]: value }));
  }

  async function createPdf(event) {
    event.preventDefault();
    setPdfBusy(true);
    setPdfMessage('');

    try {
      const response = await fetch('/.netlify/functions/validate-pdf-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: pdfForm.username,
          password: pdfForm.password,
          date: selectedDate
        })
      });

      if (!response.ok) {
        let message = 'ยืนยันตัวตนไม่สำเร็จ';
        try {
          const errorData = await response.json();
          message = errorData.message || message;
        } catch {
          // skip
        }

        throw new Error(message);
      }

      const result = await response.json();
      if (!result.printUrl) {
        throw new Error('ไม่พบลิงก์สำหรับพิมพ์ PDF');
      }

      window.open(result.printUrl, '_blank', 'noopener,noreferrer');

      setPdfMessage('เปิดหน้าสำหรับพิมพ์ PDF แล้ว กรุณาเลือก Save as PDF ในหน้าต่างพิมพ์');
      setShowPdfLogin(false);
      setPdfForm({ username: '', password: '' });
    } catch (error) {
      setPdfMessage(error.message || 'สร้าง PDF ไม่สำเร็จ');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="page-shell public-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Public Scoreboard</span>
          <h2>คะแนนความสะอาดคณะสี</h2>
          <p>ดูคะแนนและรูปภาพพื้นที่รับผิดชอบได้โดยไม่ต้องเข้าสู่ระบบ</p>
        </div>
        <div className="hero-actions print-hide">
          <label>
            เลือกวันที่
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <div className="public-pdf-actions">
            <button className="btn btn-primary" type="button" onClick={() => {
              setPdfMessage('');
              setShowPdfLogin(true);
            }}>
              สร้าง PDF
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/login')}>
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>

      {pdfMessage ? (
        <div className={pdfMessage.includes('ไม่สำเร็จ') || pdfMessage.includes('ไม่ถูกต้อง') ? 'alert danger print-hide' : 'alert success print-hide'}>
          {pdfMessage}
        </div>
      ) : null}

      <div className="section-title">
        <div>
          <h3>คะแนนประจำวันที่ {formatThaiDate(selectedDate)}</h3>
          <p>{isPdfMode ? 'รายงาน PDF แสดงรายละเอียดทุกคณะสี' : 'เลือกคณะสีเพื่อดูการ์ดรายห้องและรูปภาพ Preview'}</p>
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

      {!isPdfMode ? (
        <div className="stat-grid">
          <StatCard label="คณะที่เลือก" value={selectedSummary.team.name} hint={selectedSummary.team.colorName} accent={selectedSummary.team.accentColor} />
          <StatCard label="คะแนนรวม" value={`${selectedSummary.totalScore.toFixed(2)} /30`} hint="คะแนนรวมของคณะสี" accent={selectedSummary.team.accentColor} />
          <StatCard label="ห้องสมบูรณ์" value={`${selectedSummary.completeRooms}/${selectedSummary.totalRooms}`} hint="ข้อมูลครบตามเกณฑ์" accent={selectedSummary.team.accentColor} />
        </div>
      ) : null}

      {detailSummaries.map((summary) => (
        <div key={`detail-${summary.teamId}`} className="public-team-detail-block">
          <div className="section-title">
            <div>
              <h3>รายละเอียดรายห้อง: {summary.team.name}</h3>
              <p>บุคคลทั่วไปดูข้อมูลสรุป รูปภาพ คะแนนสะอาด และเหตุผลการให้คะแนนได้ โดยไม่แสดงว่าใครให้คะแนนเท่าไหร่</p>
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
                  ) : room.scores.some((score) => score.scoreNote?.trim()) ? (
                    <div className="public-reason-list reasons-only">
                      {room.scores
                        .filter((score) => score.scoreNote?.trim())
                        .map((score) => (
                          <div key={score.id} className="public-reason-item">
                            <p>{score.scoreNote}</p>
                          </div>
                        ))}
                    </div>
                  ) : room.scores.length ? (
                    <p>มีการให้คะแนนแล้ว แต่ไม่ได้ระบุเหตุผล</p>
                  ) : (
                    <p>ยังไม่มีการให้คะแนน จึงยังไม่มีเหตุผลการประเมิน</p>
                  )}
                </div>
              </MobileCard>
            ))}
          </div>
        </div>
      ))}

      {showPdfLogin ? (
        <div className="modal-backdrop print-hide">
          <form className="edit-modal pdf-login-modal" onSubmit={createPdf}>
            <h3>ยืนยันตัวตนก่อนสร้าง PDF</h3>
            <p className="muted-text">กรอกชื่อผู้ใช้และรหัสผ่านของระบบก่อนสร้าง PDF สรุปหน้าสาธารณะ</p>

            <label>
              ชื่อผู้ใช้
              <input
                value={pdfForm.username}
                onChange={(event) => updatePdfField('username', event.target.value)}
                placeholder="เช่น admin หรือ maen"
                autoComplete="username"
                required
              />
            </label>

            <label>
              รหัสผ่าน
              <input
                type="password"
                value={pdfForm.password}
                onChange={(event) => updatePdfField('password', event.target.value)}
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                required
              />
            </label>

            {pdfMessage ? <div className="alert danger">{pdfMessage}</div> : null}

            <div className="action-row">
              <button className="btn btn-primary" type="submit" disabled={pdfBusy}>
                {pdfBusy ? 'กำลังตรวจสอบ...' : 'สร้าง PDF'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => {
                setShowPdfLogin(false);
                setPdfMessage('');
              }}>
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
