import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PracticeReportCard from '../components/PracticeReportCard.jsx';
import PracticeFormPanel from '../components/PracticeFormPanel.jsx';
import PracticePdfExport from '../components/PracticePdfExport.jsx';
import AdminPracticeEditor from '../components/AdminPracticeEditor.jsx';
import { enteredTeacherNames, draftTeacherNames, applyRosterNames, MAX_PRACTICE_TEACHERS } from '../utils/practiceTeachers.js';
import { bangkokDate } from '../services/v3Service.js';
import { loadPracticeReports, loadPracticeRoster, sendPracticeReport, watchPracticeReports, managePracticeReport } from '../services/practiceService.js';
import { compressSubmissionPhoto } from '../utils/photoCompression.js';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS, practiceDefaultDate, practiceSchedule, practiceDateLabel } from '../utils/practiceSchedule.js';

function newDraft(names) { return { id: crypto.randomUUID(), names: draftTeacherNames(names), namesTouched: false, outcome: 'normal', details: '', action: '', confirmed: false, photos: [], busy: false, preparing: false, error: '', success: '' }; }

function TeamForm({ team, draft, update, date, enabled, onSent, lock, unlock, assignedNames }) {
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
      update({ ...newDraft(assignedNames), success: 'ส่งรายงานสำเร็จแล้ว' }); onSent(report);
    } catch (error) { update({ error: error.message }); }
    finally { update({ busy: false }); unlock(); }
  }
  return <form className="practice-form" onSubmit={submit}>
    <fieldset disabled={!enabled || draft.busy || draft.preparing}>
      <div className="practice-teacher-fields"><div className="practice-teacher-fields-heading"><strong>ชื่อ–นามสกุลครูผู้ปฏิบัติเวร</strong><small>ระบุได้สูงสุด {MAX_PRACTICE_TEACHERS} คน · แก้ไขตามผู้ปฏิบัติเวรจริงได้</small></div>{draft.names.map((name, i) => <label key={i}>ครูผู้ปฏิบัติเวร คนที่ {i + 1}{i === 0 ? ' *' : ' (ถ้ามี)'}<input required={i === 0} minLength={2} maxLength={120} autoComplete="off" value={name} placeholder={`ชื่อ–นามสกุลครู คนที่ ${i + 1}`} onInput={e => update({ namesTouched: true, names: draft.names.map((old, n) => n === i ? e.target.value : old) })} /></label>)}<div className="practice-teacher-controls">{draft.names.length < MAX_PRACTICE_TEACHERS && <button type="button" className="practice-add-teacher" onClick={() => update({ namesTouched: true, names: [...draft.names, ''] })}><Icon name="plus" size={16} /> เพิ่มครูคนที่ {draft.names.length + 1}</button>}{draft.names.length > 2 && <button type="button" className="practice-add-teacher" onClick={() => update({ namesTouched: true, names: draft.names.slice(0, -1) })}>นำช่องครูคนที่ {draft.names.length} ออก</button>}</div></div>
      <div className="practice-outcome-options" role="group" aria-label="ผลการดูแล">{[['normal', 'ปกติ'], ['incident', 'มีเหตุการณ์']].map(([value, label]) => <label key={value} className={draft.outcome === value ? 'selected' : ''}><input type="radio" name={`outcome-${team.id}`} checked={draft.outcome === value} onChange={() => update({ outcome: value })} />{label}</label>)}</div>
      <label>รายละเอียดการดูแลหรือเหตุการณ์ <span aria-hidden="true">*</span><textarea required maxLength={3000} rows={3} value={draft.details} onInput={e => update({ details: e.target.value })} placeholder="บันทึกการฝึกซ้อมและเหตุการณ์ที่พบ" /></label>
      {draft.outcome === 'incident' && <label>การดำเนินการ <span aria-hidden="true">*</span><textarea required maxLength={2000} rows={2} value={draft.action} onInput={e => update({ action: e.target.value })} placeholder="การดูแลหรือแก้ไขเหตุการณ์" /></label>}
      <div className="practice-upload-heading"><strong>ภาพการปฏิบัติเวร *</strong><small>{draft.photos.length}/6 ภาพ · ต้นฉบับไม่เกิน 10 MB ต่อภาพ</small><small>HEIC/HEIF แปลงเป็น JPG อัตโนมัติ</small></div>
      <div className="practice-upload-actions"><label className="button button-secondary"><Icon name="camera" size={18} /> ถ่ายภาพ<input aria-label={`ถ่ายภาพ ${team.color}`} type="file" accept="image/*,.heic,.heif" capture="environment" onChange={addPhotos} /></label><label className="button button-secondary"><Icon name="image" size={18} /> แนบภาพ<input aria-label={`แนบภาพ ${team.color}`} type="file" accept="image/*,.heic,.heif" multiple onChange={addPhotos} /></label></div>
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
  const [roster, setRoster] = useState([]), [rosterLoading, setRosterLoading] = useState(true), [rosterError, setRosterError] = useState(''), [rosterRetry, setRosterRetry] = useState(0);
  const [drafts, setDrafts] = useState({}), [active, setActive] = useState(0), [photo, setPhoto] = useState(null);
  const [editor,setEditor]=useState(null),[showDeleted,setShowDeleted]=useState(false),[adminBusy,setAdminBusy]=useState(false),[adminNotice,setAdminNotice]=useState('');
  const deletedMode=isAdmin&&showDeleted;
  const request = useRef(0), draftsRef = useRef(drafts); draftsRef.current = drafts;
  const schedule = practiceSchedule(date);
  const refresh = useCallback(async (quiet = false) => {
    const id = ++request.current; if (!quiet) setLoading(true);
    try { const next = await loadPracticeReports(date,date,deletedMode); if (id === request.current) { setReports(next); setError(''); } }
    catch (err) { if (id === request.current) setError(err.message); }
    finally { if (id === request.current) setLoading(false); }
  }, [date,deletedMode]);
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
  useEffect(() => {
    let cancelled = false; setRoster([]); setRosterLoading(true); setRosterError('');
    loadPracticeRoster(date).then(rows => {
      if (cancelled) return;
      setRoster(rows);
      setDrafts(old => {
        const next = { ...old };
        for (const team of PRACTICE_TEAMS) {
          const key = `${date}-${team.id}`, names = rows.find(row => row.team_id === team.id)?.teacher_names || [];
          next[key] = applyRosterNames(next[key] || newDraft(), names);
        }
        return next;
      });
    }).catch(err => { if (!cancelled) setRosterError(err.message); })
      .finally(() => { if (!cancelled) setRosterLoading(false); });
    return () => { cancelled = true; };
  }, [date, rosterRetry]);
  const complete = new Set(reports.map(r => r.team_id)).size;
  async function removeOrRestore(report,operation){
    if(!isAdmin||adminBusy)return;
    if(operation==='delete'&&!window.confirm('ลบรายงานนี้ออกจากหน้าสาธารณะและไฟล์ส่งออกใช่หรือไม่? Admin สามารถกู้คืนได้ภายหลัง'))return;
    setAdminBusy(true);setAdminNotice('');
    try{await managePracticeReport({operation,id:report.id,expected_updated_at:report.updated_at});setReports(old=>old.filter(r=>r.id!==report.id));setAdminNotice(operation==='delete'?'ลบรายงานแล้ว สามารถกู้คืนจากรายการที่ลบได้':'กู้คืนรายงานแล้ว');await refresh(true);}
    catch(err){setError(err.message);}finally{setAdminBusy(false);}
  }
  return <section className="page-container practice-page">
    <div className="practice-toolbar"><button type="button" className="practice-back" onClick={() => navigate('/')}>← เลือกระบบ</button><div className="practice-toolbar-actions"><PracticePdfExport date={date}/>{isAdmin && <button type="button" className="practice-admin-link" onClick={() => navigate('/practice/summary')}><Icon name="chart" size={16} /> สรุปรายงานเวรฝึกซ้อม</button>}</div></div>
    <header className="practice-page-heading practice-report-hero"><span className="eyebrow">COLOR TEAM · DUTY REPORT</span><h1>รายงานเวรดูแลนักเรียน<span>ฝึกซ้อมกิจกรรมคณะสี</span></h1><p><Icon name="calendar" size={16} /> 2–30 พฤศจิกายน 2569</p><small>เลือกวันที่ แล้วกดกรอกข้อมูลที่คณะสีของท่าน</small></header>
    {isAdmin&&<div className="practice-admin-toolbar"><span>จัดการรายงาน · Admin</span><button type="button" aria-pressed={deletedMode} onClick={()=>setShowDeleted(value=>!value)} disabled={adminBusy}>{deletedMode?'กลับรายงานปัจจุบัน':'รายการที่ลบ / กู้คืน'}</button></div>}
    {isAdmin&&adminNotice&&<p className="practice-success" role="status">{adminNotice}</p>}
    <div className="practice-date-panel"><label>วันที่ปฏิบัติเวร<input aria-label="วันที่ปฏิบัติเวรฝึกซ้อม" type="date" min={PRACTICE_START} max={PRACTICE_END} value={date} disabled={active > 0} onInput={e => { if (e.target.value >= PRACTICE_START && e.target.value <= PRACTICE_END) setDate(e.target.value); }} /></label><div><strong>{practiceDateLabel(date)}</strong><span>{schedule.label}</span></div><div className="practice-completion"><strong>{deletedMode?String(reports.length):schedule.enabled ? `${complete}/5` : 'งดซ้อม'}</strong><span>{deletedMode?'รายงานที่ลบ':schedule.enabled ? 'คณะสีรายงานแล้ว' : 'ไม่ต้องส่งรายงาน'}</span></div></div>
    {error && <div className="global-error" role="alert">{error} <button type="button" onClick={() => refresh()}>ลองอีกครั้ง</button></div>}
    {rosterError && <div className="global-error" role="alert">{rosterError} · ยังสามารถกรอกชื่อครูเองได้ <button type="button" onClick={() => setRosterRetry(value => value + 1)}>โหลดตารางเวรอีกครั้ง</button></div>}
    <nav className="practice-team-jumps" aria-label="ไปยังคณะสี">{PRACTICE_TEAMS.map(team => <a href="#/practice" key={team.id} style={{ '--team': team.accent }} onClick={e => { e.preventDefault(); document.getElementById(`practice-${team.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i />{team.color}</a>)}</nav>
    <div className="practice-team-list">{PRACTICE_TEAMS.map(team => {
      const key = `${date}-${team.id}`, draft = drafts[key], teamReports = reports.filter(r => r.team_id === team.id), assignedNames = roster.find(row => row.duty_date === date && row.team_id === team.id)?.teacher_names || [];
      return <article key={team.id} id={`practice-${team.id}`} className="practice-team-card" style={{ '--team': team.accent, '--team-soft': team.soft }}>
        <header className="practice-team-header"><div><i /><div><small>{team.color}</small><h2>คณะ{team.name}</h2></div></div><span className={`practice-team-status ${teamReports.length ? 'done' : ''}`}>{!schedule.enabled ? 'งดซ้อม' : loading ? 'กำลังโหลด…' : error ? 'ยังตรวจสอบไม่ได้' : deletedMode?`ลบแล้ว ${teamReports.length} รายการ`:teamReports.length ? `รายงานแล้ว ${teamReports.length} รายการ` : 'ยังไม่รายงาน'}</span></header>
        <div className="practice-team-body practice-photo-card-layout">
          <section className="practice-history" aria-label={`รายงาน ${team.color}`}>{loading ? <p className="practice-reports-loading">กำลังโหลดรายงาน…</p> : teamReports.length ? teamReports.map(report => <PracticeReportCard key={report.id} report={report} onPhoto={setPhoto} disabled={adminBusy} onEdit={isAdmin?(report)=>setEditor({report,team,date}):undefined} onDelete={isAdmin?(report)=>removeOrRestore(report,'delete'):undefined} onRestore={isAdmin?(report)=>removeOrRestore(report,'restore'):undefined} />) : <PracticeReportCard onPhoto={setPhoto} emptyText={deletedMode?'ไม่มีรายการที่ลบของคณะสีนี้':schedule.enabled ? 'ยังไม่มีรายงานของคณะสีนี้' : schedule.label} />}</section>
          {schedule.enabled && !deletedMode && <div className="practice-duty-roster" aria-label={`ครูตามตารางเวร ${team.color}`}><div><Icon name="calendar" size={16} /><strong>ครูตามตารางเวร</strong></div>{rosterLoading ? <p>กำลังโหลดรายชื่อ…</p> : assignedNames.length ? <ul>{assignedNames.map((name,index) => <li key={`${index}-${name}`}>{name}</li>)}</ul> : <p>{rosterError ? 'กรอกชื่อผู้ปฏิบัติเวรในฟอร์มได้' : 'ยังไม่มีรายชื่อในตารางเวร'}</p>}</div>}
          {isAdmin&&schedule.enabled&&!deletedMode&&<div className="practice-form-panel"><button type="button" className="practice-form-toggle practice-admin-add" onClick={()=>setEditor({report:null,team,date,teacherNames:assignedNames})} disabled={adminBusy}>+ เพิ่มรายงาน · Admin</button></div>}
          {draft && schedule.enabled && !isAdmin && !deletedMode && <PracticeFormPanel key={key} id={`practice-form-${key}`} color={team.color} subtitle={`คณะ${team.name} · ${practiceDateLabel(date)}`} busy={draft.busy || draft.preparing}><TeamForm team={team} date={date} draft={draft} assignedNames={assignedNames} enabled={schedule.enabled} update={patch => setDrafts(old => ({ ...old, [key]: { ...old[key], ...patch } }))} lock={() => setActive(v => v + 1)} unlock={() => setActive(v => Math.max(0, v - 1))} onSent={report => { setReports(old => [report, ...old.filter(r => r.id !== report.id)].sort((a, b) => b.created_at.localeCompare(a.created_at))); }} /></PracticeFormPanel>}
        </div>
      </article>;
    })}</div>
    {isAdmin&&editor&&<AdminPracticeEditor value={editor} onClose={()=>setEditor(null)} onSaved={next=>{setEditor(null);setAdminNotice('บันทึกข้อมูลแล้ว');setShowDeleted(false);if(next.duty_date!==date)setDate(next.duty_date);else refresh(true);}}/>}
    {photo && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="ภาพรายงานขนาดใหญ่" onClick={() => setPhoto(null)}><button type="button" className="photo-lightbox-close" autoFocus onClick={() => setPhoto(null)} aria-label="ปิดภาพ">×</button><figure onClick={e => e.stopPropagation()}><img src={photo} alt="ภาพรายงานเวรฝึกซ้อมขนาดใหญ่" /></figure></div>}
  </section>;
}
