import { useCallback, useEffect, useRef, useState } from 'react';
import { bangkokDate } from '../services/v3Service.js';
import { loadPracticeReports, sendPracticeReport, watchPracticeReports } from '../services/practiceService.js';
import { compressSubmissionPhoto } from '../utils/photoCompression.js';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS, practiceDefaultDate, practiceSchedule, practiceDateLabel } from '../utils/practiceSchedule.js';

function newDraft() { return { id: crypto.randomUUID(), name: '', outcome: 'normal', details: '', action: '', confirmed: false, photos: [], busy: false, preparing: false, error: '', success: '' }; }

function Report({ report, onPhoto }) {
  const time = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.created_at));
  return <article className="practice-sent-report">
    <header><div><strong>{report.teacher_name}</strong><small>ส่งเมื่อ {time} น.</small></div><span className={`practice-outcome ${report.outcome}`}>{report.outcome === 'normal' ? 'ปกติ' : 'มีเหตุการณ์'}</span></header>
    <p className="practice-report-details">{report.details}</p>
    {report.action_taken && <p className="practice-report-details"><strong>การดำเนินการ</strong><br />{report.action_taken}</p>}
    <div className="practice-report-images">{report.photos.map((photo, i) => <button key={photo.full} type="button" onClick={() => onPhoto(photo.full)} aria-label={`ดูภาพรายงานของ ${report.teacher_name} รูปที่ ${i + 1}`}><img src={photo.thumbnail} alt={`ภาพการดูแลนักเรียน รูปที่ ${i + 1}`} loading="lazy" /></button>)}</div>
    <small className="practice-reference">เลขอ้างอิง {report.id}</small>
  </article>;
}

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
      const report = await sendPracticeReport({ id: draft.id, duty_date: date, team_id: team.id, teacher_name: draft.name.trim(), outcome: draft.outcome, details: draft.details.trim(), action_taken: draft.outcome === 'incident' ? draft.action.trim() : '', confirmed: draft.confirmed }, draft.photos);
      draft.photos.forEach(p => URL.revokeObjectURL(p.preview));
      update({ ...newDraft(), success: `ส่งรายงานสำเร็จ · เลขอ้างอิง ${report.id}` }); onSent(report);
    } catch (error) { update({ error: error.message }); }
    finally { update({ busy: false }); unlock(); }
  }
  return <form className="practice-form" onSubmit={submit}>
    <h3>รายงานเวรคณะ{team.name}</h3>
    <fieldset disabled={!enabled || draft.busy || draft.preparing}>
      <label>ชื่อ–นามสกุลครูผู้ปฏิบัติเวร <span aria-hidden="true">*</span><input required maxLength={120} autoComplete="name" value={draft.name} placeholder="กรอกชื่อครูผู้ปฏิบัติเวร" onInput={e => update({ name: e.target.value })} /></label>
      <div className="practice-outcome-options" role="group" aria-label="ผลการดูแล">{[['normal', 'ปกติ'], ['incident', 'มีเหตุการณ์']].map(([value, label]) => <label key={value} className={draft.outcome === value ? 'selected' : ''}><input type="radio" name={`outcome-${team.id}`} checked={draft.outcome === value} onChange={() => update({ outcome: value })} />{label}</label>)}</div>
      <label>รายละเอียดการดูแลหรือเหตุการณ์ <span aria-hidden="true">*</span><textarea required maxLength={3000} rows={3} value={draft.details} onInput={e => update({ details: e.target.value })} placeholder="บันทึกการฝึกซ้อมและเหตุการณ์ที่พบ" /></label>
      {draft.outcome === 'incident' && <label>การดำเนินการ <span aria-hidden="true">*</span><textarea required maxLength={2000} rows={2} value={draft.action} onInput={e => update({ action: e.target.value })} placeholder="การดูแลหรือแก้ไขเหตุการณ์" /></label>}
      <div className="practice-upload-heading"><strong>ภาพการปฏิบัติเวร *</strong><small>{draft.photos.length}/6 ภาพ · ต้นฉบับไม่เกิน 10 MB ต่อภาพ</small></div>
      <div className="practice-upload-actions"><label className="button button-secondary">ถ่ายภาพ<input aria-label={`ถ่ายภาพ ${team.color}`} type="file" accept="image/*" capture="environment" onChange={addPhotos} /></label><label className="button button-secondary">แนบภาพ<input aria-label={`แนบภาพ ${team.color}`} type="file" accept="image/*" multiple onChange={addPhotos} /></label></div>
      <div className="practice-photo-previews">{draft.photos.map(photo => <div key={photo.key}><img src={photo.preview} alt="ภาพที่เตรียมส่ง" /><button type="button" aria-label="ลบภาพที่เตรียมส่ง" onClick={() => { URL.revokeObjectURL(photo.preview); update({ photos: draft.photos.filter(p => p.key !== photo.key) }); }}>×</button></div>)}</div>
      <label className="practice-confirm"><input required type="checkbox" checked={draft.confirmed} onChange={e => update({ confirmed: e.target.checked })} /><span>ข้าพเจ้ายืนยันว่าข้อมูลและรูปภาพที่รายงานถูกต้อง</span></label>
      <button className="button button-primary practice-submit" disabled={!draft.confirmed || !draft.photos.length} type="submit">ส่งรายงานคณะสีนี้</button>
    </fieldset>
    {(draft.busy || draft.preparing) && <p role="status">{draft.preparing ? 'กำลังเตรียมและบีบอัดภาพ…' : 'กำลังส่งรายงาน กรุณารอสักครู่…'}</p>}
    {draft.error && <p className="form-error" role="alert">{draft.error}</p>}
    {draft.success && <p className="practice-success" role="status">{draft.success}</p>}
  </form>;
}

export default function PracticePage({ navigate }) {
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
    <button type="button" className="practice-back" onClick={() => navigate('/')}>← เลือกระบบ</button>
    <header className="practice-page-heading"><span className="eyebrow">COLOR TEAM · DUTY REPORT</span><h1>รายงานเวรดูแลนักเรียน<br />ฝึกซ้อมกิจกรรมคณะสี</h1><p>2–30 พฤศจิกายน 2569 · เลื่อนกรอกข้อมูลในการ์ดคณะสีของท่าน</p></header>
    <div className="practice-date-panel"><label>วันที่ปฏิบัติเวร<input aria-label="วันที่ปฏิบัติเวรฝึกซ้อม" type="date" min={PRACTICE_START} max={PRACTICE_END} value={date} disabled={active > 0} onInput={e => { if (e.target.value >= PRACTICE_START && e.target.value <= PRACTICE_END) setDate(e.target.value); }} /></label><div><strong>{practiceDateLabel(date)}</strong><span>{schedule.label}</span></div><div className="practice-completion"><strong>{schedule.enabled ? `${complete}/5` : 'งดซ้อม'}</strong><span>{schedule.enabled ? 'คณะสีรายงานแล้ว' : 'ไม่ต้องส่งรายงาน'}</span></div></div>
    {error && <div className="global-error" role="alert">{error} <button type="button" onClick={() => refresh()}>ลองอีกครั้ง</button></div>}
    <nav className="practice-team-jumps" aria-label="ไปยังคณะสี">{PRACTICE_TEAMS.map(team => <a href={`#practice-${team.id}`} key={team.id} style={{ '--team': team.accent }} onClick={e => { e.preventDefault(); document.getElementById(`practice-${team.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i />{team.color}</a>)}</nav>
    <div className="practice-team-list">{PRACTICE_TEAMS.map(team => {
      const key = `${date}-${team.id}`, draft = drafts[key], teamReports = reports.filter(r => r.team_id === team.id);
      return <article key={team.id} id={`practice-${team.id}`} className="practice-team-card" style={{ '--team': team.accent, '--team-soft': team.soft }}>
        <header className="practice-team-header"><div><i /><div><small>{team.color}</small><h2>คณะ{team.name}</h2></div></div><span className={`practice-team-status ${teamReports.length ? 'done' : ''}`}>{!schedule.enabled ? 'งดซ้อม' : loading ? 'กำลังโหลด…' : error ? 'ยังตรวจสอบไม่ได้' : teamReports.length ? `รายงานแล้ว ${teamReports.length} รายการ` : 'ยังไม่รายงาน'}</span></header>
        <div className="practice-team-body"><section className="practice-history" aria-label={`รายงาน ${team.color}`}><h3>รายงานประจำวันที่เลือก</h3>{loading ? <p>กำลังโหลดรายงาน…</p> : teamReports.length ? teamReports.map(report => <Report key={report.id} report={report} onPhoto={setPhoto} />) : <div className="practice-no-report">{schedule.enabled ? 'ยังไม่มีรายงานของคณะสีนี้' : schedule.label}</div>}</section>
          {draft && <TeamForm team={team} date={date} draft={draft} enabled={schedule.enabled} update={patch => setDrafts(old => ({ ...old, [key]: { ...old[key], ...patch } }))} lock={() => setActive(v => v + 1)} unlock={() => setActive(v => Math.max(0, v - 1))} onSent={report => { setReports(old => [report, ...old.filter(r => r.id !== report.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))); }} />}
        </div>
      </article>;
    })}</div>
    {photo && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="ภาพรายงานขนาดใหญ่" onClick={() => setPhoto(null)}><button type="button" className="photo-lightbox-close" autoFocus onClick={() => setPhoto(null)} aria-label="ปิดภาพ">×</button><figure onClick={e => e.stopPropagation()}><img src={photo} alt="ภาพรายงานเวรฝึกซ้อมขนาดใหญ่" /></figure></div>}
  </section>;
}
