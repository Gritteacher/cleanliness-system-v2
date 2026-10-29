import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PracticeReportCard from '../components/PracticeReportCard.jsx';
import PracticeFormPanel from '../components/PracticeFormPanel.jsx';
import { enteredTeacherNames } from '../utils/practiceTeachers.js';
import { bangkokDate } from '../services/v3Service.js';
import { loadPracticeReports, sendPracticeReport, watchPracticeReports } from '../services/practiceService.js';
import { compressSubmissionPhoto } from '../utils/photoCompression.js';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS, practiceDefaultDate, practiceSchedule, practiceDateLabel } from '../utils/practiceSchedule.js';

function newDraft() { return { id: crypto.randomUUID(), names: ['', ''], outcome: 'normal', details: '', action: '', confirmed: false, photos: [], busy: false, preparing: false, error: '', success: '' }; }

function TeamForm({ team, draft, update, date, enabled, onSent, lock, unlock }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function addPhotos(event) {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length) return;
    if (files.length + draft.photos.length > 6) { update({ error: 'แนบได้ไม่เกิน 6 ภาพต่อรายงาน' }); return; }
    lock(); update({ preparing: true, error: '', success: '' });
    const prepared = [];
    try {
      for (const file of files) {
        const photo = await compressSubmissionPhoto(file);
        if (photo.full.size > 512 * 1024 || photo.thumbnail.size > 128 * 1024) throw new Error('ภาพนี้ยังมีขนาดใหญ่เกินไป กรุณาเลือกภาพอื่น');
        prepared.push({ ...photo, preview: URL.createObjectURL(photo.thumbnail), key: crypto.randomUUID() });
      }
      if (mounted.current) update({ photos: [...draft.photos, ...prepared] });
      else prepared.forEach(p => URL.revokeObjectURL(p.preview));
    } catch (error) { prepared.forEach(p => URL.revokeObjectURL(p.preview)); update({ error: error.message }); }
    finally { update({ preparing: false }); unlock(); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!draft.confirmed || !draft.photos.length || !enabled || draft.busy || draft.preparing) return;
    lock(); update({ busy: true, error: '', success: '' });
    try {
      const names = enteredTeacherNames(draft.names);
      const report = await sendPracticeReport({ id: draft.id, duty_date: date, team_id: team.id, teacher_name: names[0], teacher_names: names, outcome: draft.outcome, details: draft.details.trim(), action_taken: draft.outcome === 'incident' ? draft.action.trim() : '', confirmed: draft.confirmed }, draft.photos);
      draft.photos.forEach(p => URL.revokeObjectURL(p.preview));
      update({ ...newDraft(), success: `ส่งรายงานสำเร็จ · เลขอ้างอิง ${report.id}` }); onSent(report);
    } catch (error) { update({ error: error.message }); }
    finally { update({ busy: false }); unlock(); }
  }
  return <form className="practice-form" onSubmit={submit}>
    <h3><Icon name="clipboard" size={18} /> กรอกข้อมูลการปฏิบัติเวร</h3>
    <fieldset disabled={!enabled || draft.busy || draft.preparing}>
      <div className="practice-teacher-fields"><div className="practice-teacher-fields-heading"><strong>ชื่อ–นามสกุลครูผู้ปฏิบัติเวร</strong><small>ระบุได้สูงสุด 3 คน</small></div>{draft.names.map((name, i) => <label key={i}>ครูผู้ปฏิบัติเวร คนที่ {i + 1}{i === 0 ? ' *' : ' (ถ้ามี)'}<input required={i === 0} minLength={2} maxLength={120} autoComplete={i === 0 ? 'name' : 'off'} value={name} placeholder={`ชื่อ–นามสกุลครู คนที่ ${i + 1}`} onInput={e => update({ names: draft.names.map((old, n) => n === i ? e.target.value : old) })} /></label>)}{draft.names.length < 3 ? <button type="button" className="practice-add-teacher" onClick={() => update({ names: [...draft.names, ''] })}><Icon name="plus" size={16} /> เพิ่มครูคนที่ 3</button> : <button type="button" className="practice-add-teacher" onClick={() => update({ names: draft.names.slice(0, 2) })}>นำช่องครูคนที่ 3 ออก</button>}</div>
      <div className="practice-outcome-options" role="group" aria-label="ผลการดูแล">{[['normal', 'ปกติ'], ['incident', 'มีเหตุการณ์']].map(([value, label]) => <label key={value} className={draft.outcome === value ? 'selected' : ''}><input type="radio" name={`outcome-${team.id}`} checked={draft.outcome === value} onChange={() => update({ outcome: value })} />{label}</label>)}</div>
      <label>รายละเอียดการดูแลหรือเหตุการณ์ <span aria-hidden="true">*</span><textarea required maxLength={3000} rows={3} value={draft.details} onInput={e => update({ details: e.target.value })} placeholder="บันทึกการฝึกซ้อมและเหตุการณ์ที่พบ" /></label>
      {draft.outcome === 'incident' && <label>การดำเนินการ <span aria-hidden="true">*</span><textarea required maxLength={2000} rows={2} value={draft.action} onInput={e => update({ action: e.target.value })} placeholder="การดูแลหรือแก้ไขเหตุการณ์" /></label>}
      <div className="practice-upload-heading"><strong>ภาพการปฏิบัติเวร *</strong><small>{draft.photos.length}/6 ภาพ · ต้นฉบับไม่เกิน 10 MB ต่อภาพ</small></div>
      <div className="practice-upload-actions"><label className="button button-secondary"><Icon name="camera" size={18} /> ถ่ายภาพ<input aria-label={`ถ่ายภาพ ${team.color}`} type="file" accept="image/*" capture="environment" onChange={addPhotos} /></label><label className="button button-secondary"><Icon name="image" size={18} /> แนบภาพ<input aria-label={`แนบภาพ ${team.color}`} type="file" accept="image/*" multiple onChange={addPhotos} /></label></div>
      <div className="practice-photo-previews">{draft.photos.map(photo => <div key={photo.key}><img src={photo.preview} alt="ภาพที่เตรียมส่ง" /><button type="button" aria-label="ลบภาพที่เตรียมส่ง" onClick={() => { URL.revokeObjectURL(photo.preview); update({ photos: draft.photos.filter(p => p.key !== photo.key) }); }}>×</button></div>)}</div>
      <label className="practice-confirm"><input required type="checkbox" checked={draft.confirmed} onChange={e => update({ confirmed: e.target.checked })} /><span>ข้าพเจ้ายืนยันว่าข้อมูลและรูปภาพที่รายงานถูกต้อง</span></label>
      <button className="button button-primary practice-submit" disabled={!draft.confirmed || !draft.photos.length} type="submit">ส่งรายงานคณะสีนี้</button>
    </fieldset>
    {(draft.busy || draft.preparing) && <p role="status">{draft.preparing ? 'กำลังเตรียมและบีบอัดภาพ…' : 'กำลังส่งรายงาน กรุณารอสักครู่…'}</p>}
    {draft.error && <p className="form-error" role="alert">{draft.error}</p>}
    {draft.success && <p className="practice-success" role="status">{draft.success}</p>}
  </form>;
}

export default function PracticePage({ navigate, isAdmin = false }) {
  const [date, setDate] = useState(() => practiceDefaultDate(bangkokDate()));
  const [reports, setReports] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [drafts, setDrafts] = useState({}), [active, setActive] = useState(0), [photo, setPhoto] = useState(null);
  const request = useRef(0), draftsRef = useRef(drafts); draftsRef.current = drafts;
  const schedule = practiceSchedule(date);
  const refresh = useCallback(async (quiet = false) => {
    const id = ++request.current; if (!quiet) setLoading(true);
    try { const next = await loadPracticeReports(date); if (id === request.current) { setReports(next); setError(''); } }
    catch (err) { if (id === request.current) setError(err.message); }
    finally { if (id === request.current) setLoading(false); }
  }, [date]);
  useEffect(() => {
    setReports([]); refresh();
    const stop = watchPracticeReports(date, () => refresh(true));
    const timer = setInterval(() => { if (!document.hidden) refresh(true); }, 20000);
    return () => { ++request.current; stop(); clearInterval(timer); };
  }, [date, refresh]);
  useEffect(() => () => { Object.values(draftsRef.current).forEach(d => d.photos.forEach(p => URL.revokeObjectURL(p.preview))); }, []);
  useEffect(() => { if (!photo) return; const close = e => { if (e.key === 'Escape') setPhoto(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [photo]);
  // Initialize lazily without remounting forms during background updates.
  useEffect(() => { setDrafts(old => { const next = { ...old }; for (const team of PRACTICE_TEAMS) next[`${date}-${team.id}`] ||= newDraft(); return next; }); }, [date]);
  const complete = new Set(reports.map(r => r.team_id)).size;
  return <section className="page-container practice-page">
    <div className="practice-toolbar"><button type="button" className="practice-back" onClick={() => navigate('/')}>← เลือกระบบ</button>{isAdmin && <button type="button" className="practice-admin-link" onClick={() => navigate('/practice/summary')}><Icon name="chart" size={16} /> สรุปรายงานเวรฝึกซ้อม</button>}</div>
    <header className="practice-page-heading practice-report-hero"><span className="eyebrow">COLOR TEAM · DUTY REPORT</span><h1>รายงานเวรดูแลนักเรียน<span>ฝึกซ้อมกิจกรรมคณะสี</span></h1><p><Icon name="calendar" size={16} /> 2–30 พฤศจิกายน 2569</p><small>เลือกวันที่ แล้วกดกรอกข้อมูลที่คณะสีของท่าน</small></header>
    <div className="practice-date-panel"><label>วันที่ปฏิบัติเวร<input aria-label="วันที่ปฏิบัติเวรฝึกซ้อม" type="date" min={PRACTICE_START} max={PRACTICE_END} value={date} disabled={active > 0} onInput={e => { if (e.target.value >= PRACTICE_START && e.target.value <= PRACTICE_END) setDate(e.target.value); }} /></label><div><strong>{practiceDateLabel(date)}</strong><span>{schedule.label}</span></div><div className="practice-completion"><strong>{schedule.enabled ? `${complete}/5` : 'งดซ้อม'}</strong><span>{schedule.enabled ? 'คณะสีรายงานแล้ว' : 'ไม่ต้องส่งรายงาน'}</span></div></div>
    {error && <div className="global-error" role="alert">{error} <button type="button" onClick={() => refresh()}>ลองอีกครั้ง</button></div>}
    <nav className="practice-team-jumps" aria-label="ไปยังคณะสี">{PRACTICE_TEAMS.map(team => <a href="#/practice" key={team.id} style={{ '--team': team.accent }} onClick={e => { e.preventDefault(); document.getElementById(`practice-${team.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i />{team.color}</a>)}</nav>
    <div className="practice-team-list">{PRACTICE_TEAMS.map(team => {
      const key = `${date}-${team.id}`, draft = drafts[key], teamReports = reports.filter(r => r.team_id === team.id);
      return <article key={team.id} id={`practice-${team.id}`} className="practice-team-card" style={{ '--team': team.accent, '--team-soft': team.soft }}>
        <header className="practice-team-header"><div><i /><div><small>{team.color}</small><h2>คณะ{team.name}</h2></div></div><span className={`practice-team-status ${teamReports.length ? 'done' : ''}`}>{!schedule.enabled ? 'งดซ้อม' : loading ? 'กำลังโหลด…' : error ? 'ยังตรวจสอบไม่ได้' : teamReports.length ? `รายงานแล้ว ${teamReports.length} รายการ` : 'ยังไม่รายงาน'}</span></header>
        <div className="practice-team-body practice-photo-card-layout">
          <section className="practice-history" aria-label={`รายงาน ${team.color}`}>{loading ? <p className="practice-reports-loading">กำลังโหลดรายงาน…</p> : teamReports.length ? teamReports.map(report => <PracticeReportCard key={report.id} report={report} onPhoto={setPhoto} />) : <PracticeReportCard onPhoto={setPhoto} emptyText={schedule.enabled ? 'ยังไม่มีรายงานของคณะสีนี้' : schedule.label} />}</section>
          {draft && schedule.enabled && <PracticeFormPanel key={key} id={`practice-form-${key}`} color={team.color} busy={draft.busy || draft.preparing}><TeamForm team={team} date={date} draft={draft} enabled={schedule.enabled} update={patch => setDrafts(old => ({ ...old, [key]: { ...old[key], ...patch } }))} lock={() => setActive(v => v + 1)} unlock={() => setActive(v => Math.max(0, v - 1))} onSent={report => { setReports(old => [report, ...old.filter(r => r.id !== report.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))); }} /></PracticeFormPanel>}
        </div>
      </article>;
    })}</div>
    {photo && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="ภาพรายงานขนาดใหญ่" onClick={() => setPhoto(null)}><button type="button" className="photo-lightbox-close" autoFocus onClick={() => setPhoto(null)} aria-label="ปิดภาพ">×</button><figure onClick={e => e.stopPropagation()}><img src={photo} alt="ภาพรายงานเวรฝึกซ้อมขนาดใหญ่" /></figure></div>}
  </section>;
}
