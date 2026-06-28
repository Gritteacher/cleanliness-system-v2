import { useEffect, useMemo, useState } from 'react';
import { colorTeams, getTeam } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import { todayISO, getDutyTeamForDate, formatThaiDate, getDayLabel } from '../utils/dateUtils.js';
import { calculateStudentScore, getAreasForTeam, getDutyRecord } from '../utils/scoring.js';
import { resizeImage } from '../utils/imageResize.js';
import { addLog } from '../utils/storage.js';
import { uploadImageDataUrl, upsertDutyRecord, insertEditLog } from '../services/supabaseService.js';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'มาทำเวร' },
  { value: 'ABSENT', label: 'ไม่มาทำเวร' },
  { value: 'ACTIVITY', label: 'ไปกิจกรรม / ไม่นำมาคำนวณ' }
];

const defaultForm = {
  status: 'PRESENT',
  studentCount: 15,
  photo: '',
  photoThumb: '',
  photoNote: '',
  photoPath: '',
  photoThumbPath: ''
};

function getInitialDutyColorId(dateString, isAdmin) {
  const team = getDutyTeamForDate(dateString);
  if (team) return team.id;
  return isAdmin ? colorTeams[0].id : '';
}

export default function DutyRecord({ data, setData, user, navigate, refreshData }) {
  const isAdmin = user.role === 'ADMIN';
  const [recordDate, setRecordDate] = useState(todayISO());
  const [adminDutyColorId, setAdminDutyColorId] = useState(getInitialDutyColorId(todayISO(), isAdmin));
  const dateDutyTeam = getDutyTeamForDate(recordDate);
  const dutyColorId = isAdmin ? adminDutyColorId : dateDutyTeam?.id;
  const dutyTeam = getTeam(dutyColorId);
  const isOwnerDuty = Boolean(dutyTeam) && (isAdmin || (user.role === 'PRESIDENT' && user.colorTeamId === dutyTeam.id));
  const areas = useMemo(() => isOwnerDuty ? getAreasForTeam(data, dutyTeam.id) : [], [data, dutyTeam?.id, isOwnerDuty]);
  const [areaId, setAreaId] = useState('');
  const area = areas.find((item) => item.id === areaId) || areas[0];
  const selectedAreaId = area?.id || '';
  const existing = area && dutyTeam ? getDutyRecord(data, recordDate, area.id, dutyTeam.id) : null;

  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        status: existing.status,
        studentCount: existing.studentCount,
        photo: existing.photo || '',
        photoThumb: existing.photoThumb || '',
        photoPath: existing.photoPath || '',
        photoThumbPath: existing.photoThumbPath || '',
        photoNote: existing.photoNote || ''
      });
    } else {
      setForm(defaultForm);
    }
    setMessage('');
  }, [existing?.id, recordDate, selectedAreaId, dutyTeam?.id]);

  function handleDateChange(value) {
    setRecordDate(value);
    setAreaId('');

    if (!isAdmin) return;

    const nextTeam = getInitialDutyColorId(value, true);
    setAdminDutyColorId(nextTeam);
  }

  async function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      setForm((prev) => ({
        ...prev,
        photo: resized.image,
        photoThumb: resized.thumb,
        photoPath: '',
        photoThumbPath: ''
      }));
      setMessage('ลดขนาดรูปและเตรียมบันทึกแล้ว');
    } catch (error) {
      setMessage(error.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isOwnerDuty || !dutyTeam || !area) return;

    setBusy(true);
    setMessage('');

    try {
      const recordId = `${recordDate}-${area.id}-${dutyTeam.id}`;
      const oldRecord = getDutyRecord(data, recordDate, area.id, dutyTeam.id);
      const room = area.roomsByTeam[dutyTeam.id];
      const studentCount = form.status === 'PRESENT' ? Number(form.studentCount || 0) : 0;
      const studentScore = calculateStudentScore(studentCount);

      let photoUrl = form.photo;
      let photoThumbUrl = form.photoThumb;
      let photoPath = form.photoPath || oldRecord?.photoPath || '';
      let photoThumbPath = form.photoThumbPath || oldRecord?.photoThumbPath || '';

      if (form.photo?.startsWith('data:')) {
        const uploaded = await uploadImageDataUrl(
          form.photo,
          `${recordDate}/${dutyTeam.id}/${area.id}-${room}-main.jpg`
        );
        photoUrl = uploaded.url;
        photoPath = uploaded.path;
      }

      if (form.photoThumb?.startsWith('data:')) {
        const uploadedThumb = await uploadImageDataUrl(
          form.photoThumb,
          `${recordDate}/${dutyTeam.id}/${area.id}-${room}-thumb.jpg`
        );
        photoThumbUrl = uploadedThumb.url;
        photoThumbPath = uploadedThumb.path;
      }

      const nextRecord = {
        id: recordId,
        recordDate,
        areaId: area.id,
        room,
        dutyColorId: dutyTeam.id,
        status: form.status,
        studentCount,
        studentScore,
        photo: photoUrl,
        photoThumb: photoThumbUrl,
        photoPath,
        photoThumbPath,
        photoNote: form.photoNote,
        submittedBy: user.id,
        submittedName: isAdmin ? `${user.displayName} (แทน${dutyTeam.shortName})` : user.displayName,
        submittedAt: oldRecord?.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await upsertDutyRecord(nextRecord);

      const log = {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        action: oldRecord ? 'UPDATE_DUTY_RECORD' : 'CREATE_DUTY_RECORD',
        tableName: 'dutyRecords',
        recordId,
        oldData: oldRecord || null,
        newData: nextRecord,
        editedBy: isAdmin ? `${user.displayName} ใช้สิทธิ์แทน${dutyTeam.shortName}` : user.displayName
      };
      try {
        await insertEditLog(log);
      } catch {
        // ไม่ให้ log ทำให้การบันทึกหลักล้มเหลว
      }

      const nextRecords = oldRecord
        ? data.dutyRecords.map((record) => record.id === oldRecord.id ? nextRecord : record)
        : [nextRecord, ...data.dutyRecords];

      let nextData = { ...data, dutyRecords: nextRecords };
      nextData = addLog(nextData, log);
      setData(nextData);

      try {
        await refreshData();
      } catch {
        // ใช้ cache ต่อได้
      }

      setMessage(isAdmin
        ? `Admin บันทึกข้อมูลแทน${dutyTeam.shortName}ในระบบเรียบร้อยแล้ว`
        : 'บันทึกข้อมูลการมาทำเวรในระบบเรียบร้อยแล้ว'
      );
    } catch (error) {
      setMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const studentScore = calculateStudentScore(form.studentCount);

  return (
    <section className="page-shell duty-record-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Duty Record</span>
          <h2>กรอกข้อมูลการมาทำเวร</h2>
          <p>{formatThaiDate(recordDate)} • {getDayLabel(recordDate)}</p>
          {dutyTeam ? <TeamBadge teamId={dutyTeam.id} label={`คณะสีที่บันทึก: ${dutyTeam.name}`} /> : <span className="chip muted">วันนี้ไม่มีเวรคณะสี</span>}
          {isAdmin && dateDutyTeam ? <TeamBadge teamId={dateDutyTeam.id} label={`เวรตามวันจริง: ${dateDutyTeam.shortName}`} /> : null}
          {isAdmin ? (
            <div className="alert info compact-alert">
              Admin สามารถเลือกคณะสีและอัปโหลดรูปแทนหัวหน้าคณะสีได้
            </div>
          ) : null}
        </div>
        <div className="hero-actions">
          <label>
            เลือกวันที่
            <input type="date" value={recordDate} onChange={(e) => handleDateChange(e.target.value)} />
          </label>
          {isAdmin ? (
            <label>
              Admin เลือกคณะสี
              <select value={adminDutyColorId} onChange={(e) => {
                setAdminDutyColorId(e.target.value);
                setAreaId('');
              }}>
                {colorTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {!isOwnerDuty ? (
        <div className="empty-state owner-only-state">
          <h2>หน้านี้แสดงเฉพาะประธานคณะสีเจ้าของเวรเท่านั้น</h2>
          <p>
            วันที่เลือกเป็นเวรของ {dateDutyTeam?.name || 'ไม่มีคณะสี'}
            ผู้ใช้งานที่ไม่ใช่เจ้าของเวรจะไม่สามารถดูหรือกรอกข้อมูลหน้านี้ได้
          </p>
          <div className="action-row">
            <button className="btn btn-primary" type="button" onClick={() => navigate('/clean-score')}>
              ไปหน้าให้คะแนนความสะอาด
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/dashboard')}>
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      ) : (
        <>
          {message ? <div className={message.includes('ไม่สำเร็จ') ? 'alert danger' : 'alert success'}>{message}</div> : null}

          <form className="form-card" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                ห้องเรียน / พื้นที่
                <select value={selectedAreaId} onChange={(e) => setAreaId(e.target.value)}>
                  {areas.map((item) => (
                    <option key={item.id} value={item.id}>
                      ห้อง {item.roomsByTeam[dutyTeam.id]} — {item.areaName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {area && dutyTeam ? (
              <div className="info-panel">
                <strong>{isAdmin ? `Admin กำลังบันทึกแทน${dutyTeam.shortName}` : 'พื้นที่รับผิดชอบ'}</strong>
                <p>{area.areaName}</p>
                <span>ห้อง {area.roomsByTeam[dutyTeam.id]}</span>
              </div>
            ) : null}

            <div className="form-grid">
              <label>
                สถานะ
                <select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                  {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label>
                จำนวนคนที่มาทำเวร
                <input
                  type="number"
                  min="0"
                  value={form.studentCount}
                  onChange={(e) => updateField('studentCount', e.target.value)}
                  disabled={form.status !== 'PRESENT'}
                />
              </label>
            </div>

            <div className="score-preview">
              คะแนนจำนวนคน: <strong>{studentScore.toFixed(2)} /10</strong>
              <small>สูตร (จำนวนคน ÷ 15) × 10 ไม่เกิน 10 คะแนน</small>
            </div>

            <div className="photo-upload-grid">
              <label className="upload-box">
                ถ่ายภาพจากกล้อง
                <input type="file" accept="image/*" capture="environment" onChange={handleImage} disabled={busy} />
              </label>
              <label className="upload-box">
                เลือกรูปจากอัลบั้ม
                <input type="file" accept="image/*" onChange={handleImage} disabled={busy} />
              </label>
            </div>

            <PhotoPreview src={form.photo} thumb={form.photoThumb} />

            <label>
              หมายเหตุภาพ
              <textarea
                value={form.photoNote || ''}
                onChange={(e) => updateField('photoNote', e.target.value)}
                placeholder="บันทึกหมายเหตุ เช่น มีนักเรียนไปกิจกรรมบางส่วน"
              />
            </label>

            <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>
              {busy ? 'กำลังบันทึก...' : isAdmin ? `บันทึกและอัปโหลดรูปแทน${dutyTeam.shortName}` : 'บันทึกข้อมูลการมาทำเวร'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
