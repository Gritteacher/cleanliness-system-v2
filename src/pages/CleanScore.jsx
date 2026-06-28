import { useMemo, useState } from 'react';
import { colorTeams, getTeam } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import { todayISO, formatThaiDate, getDutyTeamForDate, getDayLabel } from '../utils/dateUtils.js';
import { getAreasForTeam, getDutyRecord, getScoreByEvaluator, getScores } from '../utils/scoring.js';
import { addLog } from '../utils/storage.js';
import { upsertCleanScore, insertEditLog } from '../services/supabaseService.js';

function getInitialDutyTeamId(dateString) {
  return getDutyTeamForDate(dateString)?.id || colorTeams[0].id;
}

export default function CleanScore({ data, setData, user, refreshData }) {
  const initialDate = todayISO();
  const isAdmin = user.role === 'ADMIN';
  const [recordDate, setRecordDate] = useState(initialDate);
  const [dutyColorId, setDutyColorId] = useState(getInitialDutyTeamId(initialDate));
  const [adminEvaluatorColorId, setAdminEvaluatorColorId] = useState(colorTeams[0].id);
  const areas = useMemo(() => getAreasForTeam(data, dutyColorId), [data, dutyColorId]);
  const [areaId, setAreaId] = useState('');
  const area = areas.find((item) => item.id === areaId) || areas[0];
  const selectedAreaId = area?.id || '';
  const [scoreValue, setScoreValue] = useState('');
  const [scoreNote, setScoreNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const evaluatorColorId = isAdmin ? adminEvaluatorColorId : user.colorTeamId;
  const dutyTeam = getTeam(dutyColorId);
  const evaluatorTeam = getTeam(evaluatorColorId);
  const record = area ? getDutyRecord(data, recordDate, area.id, dutyColorId) : null;
  const scores = area ? getScores(data, recordDate, area.id, dutyColorId) : [];
  const existingScore = area ? getScoreByEvaluator(data, recordDate, area.id, dutyColorId, evaluatorColorId) : null;

  function handleDateChange(value) {
    const teamIdFromDate = getInitialDutyTeamId(value);
    setRecordDate(value);
    setDutyColorId(teamIdFromDate);
    setAreaId('');
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!area || !evaluatorColorId) return;

    setBusy(true);
    setMessage('');

    try {
      const cleanScore = Math.max(0, Math.min(10, Number(scoreValue || 0)));
      const scoreId = `${recordDate}-${area.id}-${dutyColorId}-${evaluatorColorId}`;
      const oldScore = existingScore;
      const nextScore = {
        id: scoreId,
        recordDate,
        areaId: area.id,
        room: area.roomsByTeam[dutyColorId],
        dutyColorId,
        evaluatorColorId,
        cleanScore,
        scoreNote,
        submittedBy: user.id,
        submittedName: isAdmin ? `${user.displayName} (แทน${evaluatorTeam?.shortName || evaluatorColorId})` : user.displayName,
        submittedAt: oldScore?.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await upsertCleanScore(nextScore);

      const log = {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        action: oldScore ? 'UPDATE_CLEAN_SCORE' : 'CREATE_CLEAN_SCORE',
        tableName: 'cleanScores',
        recordId: scoreId,
        oldData: oldScore || null,
        newData: nextScore,
        editedBy: isAdmin ? `${user.displayName} ใช้สิทธิ์แทน${evaluatorTeam?.shortName || evaluatorColorId}` : user.displayName
      };

      try {
        await insertEditLog(log);
      } catch {
        // ไม่ให้ log ทำให้การบันทึกหลักล้มเหลว
      }

      const nextScores = oldScore
        ? data.cleanScores.map((score) => score.id === oldScore.id ? nextScore : score)
        : [nextScore, ...data.cleanScores];

      let nextData = { ...data, cleanScores: nextScores };
      nextData = addLog(nextData, log);
      setData(nextData);

      try {
        await refreshData();
      } catch {
        // ใช้ cache ต่อได้
      }

      setMessage(isAdmin
        ? `Admin บันทึกคะแนนแทน${evaluatorTeam?.shortName || evaluatorColorId}ลง Supabase เรียบร้อยแล้ว`
        : 'บันทึกคะแนนความสะอาดลง Supabase เรียบร้อยแล้ว'
      );
    } catch (error) {
      setMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const average = scores.length
    ? scores.reduce((sum, item) => sum + Number(item.cleanScore || 0), 0) / scores.length
    : 0;

  return (
    <section className="page-shell clean-score-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Clean Score</span>
          <h2>ให้คะแนนความสะอาด</h2>
          <p>เลือกวันที่แล้วระบบจะแสดงคณะสีเวรของวันนั้นอัตโนมัติ</p>
          <div className="badge-row">
            <TeamBadge teamId={evaluatorTeam?.id} label={`ผู้ประเมิน: ${evaluatorTeam?.shortName || 'Admin'}`} />
            {dutyTeam ? <TeamBadge teamId={dutyTeam.id} label={`เวรที่ตรวจ: ${dutyTeam.shortName}`} /> : null}
          </div>
          {isAdmin ? (
            <div className="alert info compact-alert">
              Admin สามารถเลือกใช้สิทธิ์แทนหัวหน้าคณะสีใดก็ได้ในการให้คะแนน
            </div>
          ) : null}
        </div>
      </div>

      {message ? <div className={message.includes('ไม่สำเร็จ') ? 'alert danger' : 'alert success'}>{message}</div> : null}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            วันที่
            <input type="date" value={recordDate} onChange={(e) => handleDateChange(e.target.value)} />
          </label>

          <label>
            คณะสีเวรตามวันที่
            <select value={dutyColorId} disabled>
              {colorTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>

          {isAdmin ? (
            <label>
              Admin ใช้สิทธิ์แทนหัวหน้าคณะสี
              <select value={adminEvaluatorColorId} onChange={(e) => {
                setAdminEvaluatorColorId(e.target.value);
                setMessage('');
              }}>
                {colorTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          ) : null}

          <label>
            ห้องเรียน / พื้นที่
            <select value={selectedAreaId} onChange={(e) => setAreaId(e.target.value)}>
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  ห้อง {item.roomsByTeam[dutyColorId]} — {item.areaName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="info-panel">
          <strong>วันที่เลือก: {formatThaiDate(recordDate)} • {getDayLabel(recordDate)}</strong>
          <p>
            {isAdmin
              ? `Admin กำลังใช้สิทธิ์ประเมินแทน${evaluatorTeam?.shortName || ''}`
              : 'ระบบล็อกคณะสีเวรตามวันที่โดยอัตโนมัติ เพื่อให้การให้คะแนนตรงกับเวรประจำวัน'}
          </p>
        </div>

        {area ? (
          <div className="info-panel">
            <TeamBadge teamId={dutyTeam?.id} />
            <strong>ห้อง {area.roomsByTeam[dutyColorId]}</strong>
            <p>{area.areaName}</p>
            <div className="mini-grid">
              <span>สถานะ: {record ? record.status : 'ยังไม่มีข้อมูลการมาทำเวร'}</span>
              <span>จำนวนคน: {record?.studentCount ?? '-'} คน</span>
              <span>คะแนนประธาน: {scores.length}/5 สี</span>
              <span>เฉลี่ยปัจจุบัน: {average.toFixed(2)} /10</span>
            </div>
          </div>
        ) : null}

        <div className="score-photo-box">
          <PhotoPreview src={record?.photo} thumb={record?.photoThumb} compact />
        </div>

        <label>
          คะแนนความสะอาด /10
          <input
            type="number"
            min="0"
            max="10"
            step="0.25"
            value={scoreValue}
            onChange={(e) => setScoreValue(e.target.value)}
            placeholder="กรอกคะแนน 0-10"
            required
          />
        </label>

        <label>
          หมายเหตุการให้คะแนน
          <textarea value={scoreNote} onChange={(e) => setScoreNote(e.target.value)} placeholder="เช่น พื้นที่สะอาดดี แต่ยังมีเศษใบไม้เล็กน้อย" />
        </label>

        {existingScore ? <div className="alert info">มีคะแนนของสีนี้แล้ว หากบันทึกอีกครั้ง ระบบจะอัปเดตคะแนนเดิม</div> : null}

        <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : isAdmin ? `บันทึกคะแนนแทน${evaluatorTeam?.shortName || ''}` : 'บันทึกคะแนนความสะอาด'}
        </button>
      </form>
    </section>
  );
}
