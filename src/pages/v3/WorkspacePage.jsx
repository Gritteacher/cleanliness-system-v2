import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { saveDutySubmission, saveEvaluation, uploadSubmissionPhoto } from '../../services/v3Service.js';

const workflowLabels = { draft: 'ฉบับร่าง', submitted: 'ส่งแล้ว', locked: 'เผยแพร่แล้ว', void: 'ยกเลิก' };

function scheduledTeam(data) {
  const override = data.overrides?.[0];
  if (override) return override.cancelled ? null : override.team_id;
  const weekday = new Date(`${data.date}T12:00:00+07:00`).getDay();
  return data.schedules.find((row) => row.weekday === weekday)?.team_id || null;
}

export default function WorkspacePage({ user, data, loading, date, onDateChange, onRefresh, navigate }) {
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const teamId = scheduledTeam(data || { schedules: [], overrides: [] });
  const isAdmin = user.role === 'admin';
  const assignments = useMemo(() => (data?.assignments || []).filter((row) => row.team_id === teamId), [data, teamId]);
  const submissions = data?.submissions || [];
  const evaluationQueue = submissions.filter((row) => row.workflow_status === 'submitted' && row.duty_status === 'present');

  async function submitDuty(event, assignment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = submissions.find((row) => row.assignment_id === assignment.id);
    setBusyId(assignment.id); setNotice('');
    try {
      await saveDutySubmission({ id: existing?.id, assignmentId: assignment.id, dutyDate: date, dutyStatus: form.get('status'), studentCount: form.get('studentCount'), note: form.get('note'), submit: form.get('action') === 'submit' });
      setNotice('บันทึกข้อมูลการทำเวรแล้ว'); await onRefresh();
    } catch (error) { setNotice(error.message); }
    setBusyId('');
  }

  async function submitScore(event, submission) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = data.evaluations.find((row) => row.submission_id === submission.id && row.evaluator_team_id === user.teamId);
    setBusyId(`score-${submission.id}`); setNotice('');
    try {
      await saveEvaluation({ id: existing?.id, submissionId: submission.id, teamId: user.teamId, score: form.get('score'), reason: form.get('reason') });
      setNotice('บันทึกคะแนนแล้ว'); await onRefresh();
    } catch (error) { setNotice(error.message); }
    setBusyId('');
  }

  async function uploadPhoto(event, submission) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyId(`photo-${submission.id}`); setNotice('');
    try {
      await uploadSubmissionPhoto({ submissionId: submission.id, userId: user.id, file });
      setNotice('อัปโหลดรูปภาพแล้ว'); await onRefresh();
    } catch (error) { setNotice(error.message); }
    event.target.value = '';
    setBusyId('');
  }

  if (loading) return <div className="page-container"><div className="loading-panel">กำลังเตรียมพื้นที่ทำงาน…</div></div>;
  if (!data?.term) return <div className="page-container"><div className="empty-panel tall"><span className="empty-icon"><Icon name="calendar" /></span><h2>ยังไม่ได้เปิดภาคเรียน</h2><p>{isAdmin ? 'ตั้งค่าภาคเรียนและพื้นที่ก่อนเริ่มใช้งาน' : 'กรุณารอผู้ดูแลระบบตั้งค่าภาคเรียน'}</p>{isAdmin ? <button className="button button-primary" onClick={() => navigate('/admin')}>ไปตั้งค่าระบบ</button> : null}</div></div>;

  return (
    <div className="page-container workspace-page">
      <section className="workspace-heading">
        <div><span className="eyebrow">{data.term.name}</span><h1>สวัสดี, {user.displayName}</h1><p>{user.role === 'admin' ? 'ภาพรวมการปฏิบัติงานประจำวัน' : user.team?.name}</p></div>
        <label className="date-control"><Icon name="calendar" /><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
      </section>
      {notice ? <div className="notice-bar">{notice}</div> : null}
      <div className="workspace-summary">
        <article><span className="summary-icon green"><Icon name="clipboard" /></span><div><small>พื้นที่ในเวรวันนี้</small><strong>{assignments.length}</strong></div></article>
        <article><span className="summary-icon yellow"><Icon name="check" /></span><div><small>บันทึกแล้ว</small><strong>{submissions.filter((s) => s.assignment?.team_id === teamId).length}</strong></div></article>
        <article><span className="summary-icon cream"><Icon name="chart" /></span><div><small>รอประเมิน</small><strong>{evaluationQueue.length}</strong></div></article>
      </div>

      <section className="workspace-section">
        <div className="section-heading"><div><span className="eyebrow">เวรประจำวัน</span><h2>บันทึกการดูแลพื้นที่</h2></div><span className="team-duty-pill">{teamId ? data.assignments.find((a) => a.team_id === teamId)?.team?.short_name || teamId : 'งดเวร'}</span></div>
        {!teamId ? <div className="empty-panel compact"><h3>วันนี้ไม่มีคณะเข้าเวร</h3><p>อาจเป็นวันหยุดหรือมีการตั้งค่างดเวรไว้</p></div> : !isAdmin && user.teamId !== teamId ? <div className="empty-panel compact"><h3>วันนี้ไม่ใช่เวรของคณะคุณ</h3><p>คุณยังสามารถประเมินพื้นที่ที่ส่งข้อมูลแล้วได้ด้านล่าง</p></div> : assignments.length ? (
          <div className="form-grid">{assignments.map((assignment) => { const current = submissions.find((row) => row.assignment_id === assignment.id); const locked = current?.workflow_status === 'locked'; return (
            <form className="task-card" key={assignment.id} onSubmit={(event) => submitDuty(event, assignment)}>
              <div className="task-card-head"><span className="area-code">{assignment.area?.code}</span><span className={`status-chip ${current?.workflow_status || 'draft'}`}>{workflowLabels[current?.workflow_status] || workflowLabels.draft}</span></div>
              <h3>{assignment.room_label}</h3><p>{assignment.area?.name}</p>
              <div className="field-row"><label>สถานะ<select name="status" defaultValue={current?.duty_status || 'present'} disabled={locked}><option value="present">เข้าทำเวร</option><option value="absent">ไม่เข้าทำเวร</option><option value="activity">ไปกิจกรรม</option></select></label><label>จำนวนนักเรียน<input name="studentCount" type="number" min="0" defaultValue={current?.student_count || 0} disabled={locked} /></label></div>
              <label>หมายเหตุ<textarea name="note" defaultValue={current?.note || ''} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" disabled={locked} /></label>
              <div className="task-photo-block">
                <div className="task-photo-list">{(current?.photos || []).map((photo) => <a href={photo.full_url || photo.view_url} target="_blank" rel="noreferrer" key={photo.id}><img src={photo.view_url || photo.full_url} alt={`รูป ${assignment.room_label}`} /></a>)}</div>
                {!current ? <small>บันทึกร่างก่อนจึงจะเพิ่มรูปได้</small> : locked ? <small>รูปถูกล็อกพร้อมผลที่เผยแพร่แล้ว</small> : <label className="photo-upload-button">{busyId === `photo-${current.id}` ? 'กำลังอัปโหลด…' : 'เพิ่มรูปภาพ'}<input type="file" accept="image/*" capture="environment" onChange={(event) => uploadPhoto(event, current)} disabled={busyId === `photo-${current.id}`} /></label>}
              </div>
              <div className="task-actions"><button className="button button-secondary" name="action" value="draft" disabled={locked || busyId === assignment.id}>บันทึกร่าง</button><button className="button button-primary" name="action" value="submit" disabled={locked || busyId === assignment.id}>ยืนยันส่งข้อมูล</button></div>
            </form>); })}</div>
        ) : <div className="empty-panel compact"><h3>ยังไม่ได้กำหนดพื้นที่ให้คณะนี้</h3><p>ผู้ดูแลระบบสามารถเพิ่มพื้นที่ได้ในหน้าจัดการระบบ</p></div>}
      </section>

      {!isAdmin ? <section className="workspace-section"><div className="section-heading"><div><span className="eyebrow">ร่วมประเมิน</span><h2>พื้นที่ที่รอให้คะแนน</h2></div><span className="count-badge">{evaluationQueue.length}</span></div>{evaluationQueue.length ? <div className="evaluation-list">{evaluationQueue.map((submission) => { const mine = data.evaluations.find((row) => row.submission_id === submission.id && row.evaluator_team_id === user.teamId); return <form className="evaluation-card" key={submission.id} onSubmit={(event) => submitScore(event, submission)}><div><span className="area-code">{submission.assignment?.area?.code}</span><h3>{submission.assignment?.room_label}</h3><p>{submission.assignment?.team?.short_name}</p></div><label>คะแนน<input name="score" type="number" min="0" max="10" step="0.5" defaultValue={mine?.score ?? 8} required /></label><label className="grow">เหตุผล<input name="reason" defaultValue={mine?.reason || ''} placeholder="สิ่งที่ดีหรือควรปรับปรุง" /></label><button className="button button-primary" disabled={busyId === `score-${submission.id}`}>{mine ? 'อัปเดต' : 'ให้คะแนน'}</button></form>; })}</div> : <div className="empty-panel compact"><p>ยังไม่มีพื้นที่ที่ส่งเข้ามารอประเมิน</p></div>}</section> : null}
    </div>
  );
}
