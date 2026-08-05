import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import {
  bangkokDate,
  deleteEvaluation,
  deleteSubmissionPhoto,
  saveDutySubmission,
  saveEvaluation,
  uploadSubmissionPhoto
} from '../../services/v3Service.js';

function scheduledTeam(data) {
  const override = data.overrides?.[0];
  if (override) return override.cancelled ? null : override.team_id;
  const weekday = new Date(`${data.date}T12:00:00+07:00`).getDay();
  return data.schedules.find((row) => row.weekday === weekday)?.team_id || null;
}

function SaveState({ value }) {
  if (!value || value === 'idle') return null;
  const labels = { saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', error: 'บันทึกไม่สำเร็จ' };
  return <span className={`autosave-state ${value}`}>{value === 'saved' ? <Icon name="check" size={13} /> : null}{labels[value]}</span>;
}

function AreaIdentity({ assignment }) {
  return <div className="area-identity">
    <span className="area-code">{assignment.area?.code}</span>
    <h3><small>ห้อง</small>{assignment.room_label}</h3>
    <p><strong>พื้นที่</strong>{assignment.area?.name || 'ยังไม่ระบุพื้นที่'}</p>
  </div>;
}

function EvaluationEditor({ assignment, date, teamId, existing, admin, onChanged }) {
  const [score, setScore] = useState(existing?.score ?? '');
  const [reason, setReason] = useState(existing?.reason || '');
  const [touched, setTouched] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const version = useRef(0);

  useEffect(() => {
    if (touched) return;
    setScore(existing?.score ?? '');
    setReason(existing?.reason || '');
  }, [existing?.id, existing?.reason, existing?.score, existing?.updated_at]);

  useEffect(() => {
    if (!touched) return undefined;
    const numericScore = Number(score);
    if (score === '' || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 10 || (numericScore * 2) % 1 !== 0) {
      setSaveState('error');
      return undefined;
    }
    const currentVersion = ++version.current;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await saveEvaluation({ assignmentId: assignment.id, dutyDate: date, teamId, score: numericScore, reason });
        if (currentVersion === version.current) {
          setSaveState('saved');
          setTouched(false);
          onChanged?.({ background: true });
        }
      } catch {
        if (currentVersion === version.current) setSaveState('error');
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [assignment.id, date, onChanged, reason, score, teamId, touched]);

  async function removeScore() {
    if (!existing?.id || !window.confirm('ยืนยันการลบคะแนนรายการนี้หรือไม่')) return;
    setSaveState('saving');
    try {
      await deleteEvaluation(existing.id);
      setScore(''); setReason(''); setTouched(false); setSaveState('saved'); onChanged?.({ background: true });
    } catch { setSaveState('error'); }
  }

  return <div className={admin ? 'admin-evaluation-row' : 'evaluation-fields'}>
    <label>คะแนน
      <input type="number" min="0" max="10" step="0.5" value={score} placeholder="—" onChange={(event) => { setScore(event.target.value); setTouched(true); }} />
    </label>
    <label className="grow">เหตุผลหรือข้อเสนอแนะ
      <input value={reason} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" onChange={(event) => { setReason(event.target.value); setTouched(true); }} />
    </label>
    <SaveState value={saveState} />
    {admin && existing?.id ? <button className="button button-text danger-text" type="button" onClick={removeScore}>ลบคะแนน</button> : null}
  </div>;
}

function DutyAreaCard({ assignment, current, date, user, teams, evaluations, editable, admin, ownerEvaluation, ownerScoreEditable, onChanged }) {
  const [form, setForm] = useState({
    status: current?.duty_status || 'present',
    studentCount: current?.student_count ?? 0,
    note: current?.note || ''
  });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const version = useRef(0);
  const previewUrls = useRef(new Set());

  useEffect(() => {
    if (dirty) return;
    setForm({
      status: current?.duty_status || 'present',
      studentCount: current?.student_count ?? 0,
      note: current?.note || ''
    });
  }, [current?.duty_status, current?.id, current?.note, current?.student_count, current?.updated_at]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    if (!dirty || !editable) return undefined;
    const currentVersion = ++version.current;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await saveDutySubmission({
          assignmentId: assignment.id,
          dutyDate: date,
          dutyStatus: form.status,
          studentCount: form.status === 'present' ? form.studentCount : 0,
          note: form.note
        });
        if (currentVersion === version.current) {
          setDirty(false); setSaveState('saved'); onChanged?.({ background: true });
        }
      } catch {
        if (currentVersion === version.current) setSaveState('error');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [assignment.id, date, dirty, editable, form, onChanged]);

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'status' && value !== 'present' ? { studentCount: 0 } : {})
    }));
    setDirty(true);
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const queued = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { id: `${Date.now()}-${index}-${file.name}`, file, previewUrl, status: 'queued', error: '' };
    });
    setUploadItems((previous) => [...previous.filter((item) => item.status === 'error'), ...queued]);
    setPhotoBusy(true);
    event.target.value = '';
    for (const item of queued) {
      setUploadItems((previous) => previous.map((row) => row.id === item.id ? { ...row, status: 'uploading' } : row));
      try {
        await uploadSubmissionPhoto({
          submissionId: current?.id,
          assignmentId: assignment.id,
          dutyDate: date,
          userId: user.id,
          file: item.file
        });
        setUploadItems((previous) => previous.map((row) => row.id === item.id ? { ...row, status: 'saved' } : row));
      } catch (error) {
        setUploadItems((previous) => previous.map((row) => row.id === item.id ? { ...row, status: 'error', error: error.message } : row));
      }
    }
    await onChanged?.({ background: true });
    setUploadItems((previous) => {
      previous.filter((item) => item.status !== 'error').forEach((item) => {
        previewUrls.current.delete(item.previewUrl);
        URL.revokeObjectURL(item.previewUrl);
      });
      return previous.filter((item) => item.status === 'error');
    });
    setPhotoBusy(false);
  }

  async function removePhoto(photo) {
    if (!window.confirm('ยืนยันการลบรูปภาพนี้หรือไม่')) return;
    setPhotoBusy(true);
    try { await deleteSubmissionPhoto(photo); await onChanged?.({ background: true }); }
    catch (error) { window.alert(error.message); }
    setPhotoBusy(false);
  }

  return <article className="task-card live-task-card">
    <div className="task-card-head">
      <span />
      <SaveState value={saveState} />
    </div>
    <AreaIdentity assignment={assignment} />
    <div className="field-row">
      <label>สถานะ
        <select value={form.status} disabled={!editable} onChange={(event) => update('status', event.target.value)}>
          <option value="present">เข้าทำเวร</option><option value="absent">ไม่เข้าทำเวร</option><option value="activity">ไปกิจกรรม</option>
        </select>
      </label>
      <label>จำนวนนักเรียน
        <input type="number" min="0" max="1000" value={form.studentCount} disabled={!editable || form.status !== 'present'} onChange={(event) => update('studentCount', event.target.value)} />
      </label>
    </div>
    <label>หมายเหตุ
      <textarea value={form.note} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" disabled={!editable} onChange={(event) => update('note', event.target.value)} />
    </label>

    <div className="task-photo-block">
      <div className="task-photo-list">{(current?.photos || []).map((photo) => <span className="editable-photo" key={photo.id}>
        <a href={photo.full_url || photo.view_url} target="_blank" rel="noreferrer"><img src={photo.view_url || photo.full_url} alt={`รูป ${assignment.room_label}`} /></a>
        {editable ? <button type="button" onClick={() => removePhoto(photo)} aria-label="ลบรูป">×</button> : null}
      </span>)}{uploadItems.map((item) => <span className={`upload-preview ${item.status}`} key={item.id} title={item.error || item.file.name}>
        <img src={item.previewUrl} alt={`ตัวอย่าง ${item.file.name}`} />
        <small>{item.status === 'error' ? 'ไม่สำเร็จ' : item.status === 'saved' ? 'เสร็จแล้ว' : 'กำลังส่ง'}</small>
      </span>)}</div>
      {editable ? <div className="photo-upload-actions">
        <label className="photo-upload-button"><Icon name="image" size={16} /> เลือกรูปจากเครื่อง<input type="file" accept="image/*" multiple aria-label="เลือกรูปจากเครื่อง" onChange={uploadPhotos} disabled={photoBusy} /></label>
        <label className="photo-upload-button camera"><Icon name="camera" size={16} /> ถ่ายรูป<input type="file" accept="image/*" capture="environment" aria-label="ถ่ายรูป" onChange={uploadPhotos} disabled={photoBusy} /></label>
        {photoBusy ? <small>กำลังอัปโหลดทีละรูป…</small> : null}
      </div> : <small>ปิดการแก้ไขแล้ว</small>}
    </div>

    {!admin ? <div className="owner-score-panel">
      <div className="admin-score-heading"><strong>คะแนนความสะอาดของคณะคุณ</strong><small>{ownerScoreEditable ? 'บันทึกอัตโนมัติ' : 'ปิดการแก้ไขแล้ว'}</small></div>
      {ownerScoreEditable ? <EvaluationEditor assignment={assignment} date={date} teamId={user.teamId} existing={ownerEvaluation} onChanged={onChanged} /> : <div className="closed-score"><strong>{ownerEvaluation?.score ?? '—'}</strong><small>คะแนนย้อนหลัง</small></div>}
    </div> : null}

    {admin ? <div className="admin-score-panel">
      <div className="admin-score-heading"><strong>คะแนนความสะอาดรายคณะ</strong><small>แก้ไขแล้วบันทึกอัตโนมัติ</small></div>
      {teams.map((team) => {
        const existing = evaluations.find((row) => row.assignment_id === assignment.id && row.evaluator_team_id === team.id);
        return <div className="admin-team-score" key={team.id} style={{ '--team': team.accent_color }}>
          <span><i />{team.short_name}</span>
          <EvaluationEditor assignment={assignment} date={date} teamId={team.id} existing={existing} admin onChanged={onChanged} />
        </div>;
      })}
    </div> : null}
  </article>;
}

export default function WorkspacePage({ user, data, loading, date, onDateChange, onRefresh, navigate }) {
  const teamId = scheduledTeam(data || { schedules: [], overrides: [] });
  const isAdmin = user.role === 'admin';
  const isToday = date === bangkokDate();
  const assignments = useMemo(() => (data?.assignments || []).filter((row) => row.team_id === teamId), [data, teamId]);
  const submissions = data?.submissions || [];
  const evaluations = data?.evaluations || [];
  const ownerCanEdit = isAdmin || (isToday && user.teamId === teamId);
  const myScores = evaluations.filter((row) => row.evaluator_team_id === user.teamId).length;

  if (loading) return <div className="page-container"><div className="loading-panel">กำลังเตรียมพื้นที่ทำงาน…</div></div>;
  if (!data?.term) return <div className="page-container"><div className="empty-panel tall"><span className="empty-icon"><Icon name="calendar" /></span><h2>ยังไม่ได้เปิดภาคเรียน</h2><p>{isAdmin ? 'ตั้งค่าภาคเรียนและพื้นที่ก่อนเริ่มใช้งาน' : 'กรุณารอผู้ดูแลระบบตั้งค่าภาคเรียน'}</p>{isAdmin ? <button className="button button-primary" onClick={() => navigate('/admin')}>ไปตั้งค่าระบบ</button> : null}</div></div>;

  return <div className="page-container workspace-page">
    <section className="workspace-heading">
      <div><span className="eyebrow">{data.term.name}</span><h1>{isAdmin ? 'แก้ไขข้อมูลรายพื้นที่' : `สวัสดี, ${user.displayName}`}</h1><p>{isAdmin ? 'ข้อมูลทุกการ์ดบันทึกและคำนวณผลแบบ Real-time' : user.team?.name}</p></div>
      <label className="date-control"><Icon name="calendar" /><input type="date" value={date} onInput={(event) => onDateChange(event.currentTarget.value)} onChange={(event) => onDateChange(event.target.value)} /></label>
    </section>

    <div className="workspace-summary">
      <article><span className="summary-icon green"><Icon name="clipboard" /></span><div><small>พื้นที่ในเวรวันนี้</small><strong>{assignments.length}</strong></div></article>
      <article><span className="summary-icon yellow"><Icon name="check" /></span><div><small>มีข้อมูลแล้ว</small><strong>{submissions.filter((row) => row.assignment?.team_id === teamId).length}</strong></div></article>
      <article><span className="summary-icon cream"><Icon name="chart" /></span><div><small>{isAdmin ? 'คะแนนทั้งหมด' : 'คะแนนของฉัน'}</small><strong>{isAdmin ? evaluations.length : myScores}</strong></div></article>
    </div>

    <section className="workspace-section">
      <div className="section-heading"><div><span className="eyebrow">เวรประจำวัน</span><h2>ข้อมูลและรูปภาพรายพื้นที่</h2></div><span className="team-duty-pill">{teamId ? data.teams.find((team) => team.id === teamId)?.short_name || teamId : 'งดเวร'}</span></div>
      {!teamId ? <div className="empty-panel compact"><h3>วันนี้ไม่มีคณะเข้าเวร</h3><p>อาจเป็นวันหยุดหรือมีการตั้งค่างดเวรไว้</p></div>
        : !isAdmin && user.teamId !== teamId ? <div className="empty-panel compact"><h3>วันนี้ไม่ใช่เวรของคณะคุณ</h3><p>พื้นที่สำหรับร่วมประเมินแสดงอยู่ด้านล่างทันที</p></div>
          : assignments.length ? <div className="form-grid">{assignments.map((assignment) => <DutyAreaCard
            key={`${date}-${assignment.id}`}
            assignment={assignment}
            current={submissions.find((row) => row.assignment_id === assignment.id)}
            date={date}
            user={user}
            teams={data.teams}
            evaluations={evaluations}
            editable={ownerCanEdit}
            admin={isAdmin}
            ownerEvaluation={evaluations.find((row) => row.assignment_id === assignment.id && row.evaluator_team_id === user.teamId)}
            ownerScoreEditable={isToday && user.teamId === teamId}
            onChanged={onRefresh}
          />)}</div> : <div className="empty-panel compact"><h3>ยังไม่ได้กำหนดพื้นที่ให้คณะนี้</h3><p>ผู้ดูแลระบบสามารถเพิ่มพื้นที่ได้ในหน้าจัดการระบบ</p></div>}
    </section>

    {!isAdmin && user.teamId !== teamId ? <section className="workspace-section">
      <div className="section-heading"><div><span className="eyebrow">ร่วมประเมินแบบ Real-time</span><h2>ประเมินความสะอาดประจำวัน</h2></div><span className="count-badge">{assignments.length} พื้นที่</span></div>
      {!teamId ? <div className="empty-panel compact"><p>ไม่มีพื้นที่ประเมินในวันที่เลือก</p></div> : assignments.length ? <div className="evaluation-list">{assignments.map((assignment) => {
        const existing = evaluations.find((row) => row.assignment_id === assignment.id && row.evaluator_team_id === user.teamId);
        return <article className="evaluation-card live-evaluation-card" key={`${date}-${assignment.id}`}>
          <AreaIdentity assignment={assignment} />
          {isToday ? <EvaluationEditor assignment={assignment} date={date} teamId={user.teamId} existing={existing} onChanged={onRefresh} /> : <div className="closed-score"><strong>{existing?.score ?? '—'}</strong><small>ปิดการแก้ไขแล้ว</small></div>}
        </article>;
      })}</div> : <div className="empty-panel compact"><p>ยังไม่ได้กำหนดพื้นที่สำหรับคณะเวรนี้</p></div>}
    </section> : null}
  </div>;
}
