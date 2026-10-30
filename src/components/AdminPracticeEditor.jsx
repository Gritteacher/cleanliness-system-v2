import { useEffect, useRef, useState } from 'react';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS, practiceSchedule } from '../utils/practiceSchedule.js';
import { reportTeacherNames, enteredTeacherNames, draftTeacherNames, MAX_PRACTICE_TEACHERS } from '../utils/practiceTeachers.js';
import { compressSubmissionPhoto } from '../utils/photoCompression.js';
import { managePracticeReport, loadPracticeRoster } from '../services/practiceService.js';

export default function AdminPracticeEditor({ value, onClose, onSaved }) {
  const { report }=value,dialog=useRef(null),id=useRef(report?.id||crypto.randomUUID()),urls=useRef(new Set()),mounted=useRef(true);
  const [date,setDate]=useState(report?.duty_date||value.date),[teamId,setTeamId]=useState(report?.team_id||value.team.id);
  const namesTouched=useRef(false);
  const [names,setNames]=useState(()=>draftTeacherNames(report?reportTeacherNames(report):value.teacherNames));
  const [outcome,setOutcome]=useState(report?.outcome||'normal'),[details,setDetails]=useState(report?.details||''),[action,setAction]=useState(report?.action_taken||'');
  const [kept,setKept]=useState(report?.photos||[]),[photos,setPhotos]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(report||namesTouched.current)return;
    let cancelled=false;
    // Never apply a different day's roster to an existing report or edited names.
    setNames(draftTeacherNames());
    loadPracticeRoster(date).then(rows=>{if(!cancelled&&!namesTouched.current)setNames(draftTeacherNames(rows.find(row=>row.team_id===teamId)?.teacher_names));}).catch(()=>{});
    return()=>{cancelled=true;};
  },[date,teamId,report]);
  useEffect(()=>{mounted.current=true;const trigger=document.activeElement,previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();return()=>{mounted.current=false;document.body.style.overflow=previous;urls.current.forEach(url=>URL.revokeObjectURL(url));if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};},[]);
  async function addPhotos(event){
    const files=[...event.target.files||[]];event.target.value='';if(!files.length)return;
    if(kept.length+photos.length+files.length>6){setError('แนบได้ไม่เกิน 6 ภาพต่อรายงาน');return;}
    setBusy(true);setError('');const prepared=[];
    try{for(const file of files){const photo=await compressSubmissionPhoto(file);if(photo.full.size>524288||photo.thumbnail.size>131072)throw new Error('ภาพมีขนาดใหญ่เกินไป กรุณาเลือกภาพอื่น');const preview=URL.createObjectURL(photo.thumbnail);prepared.push({...photo,preview,key:crypto.randomUUID()});}
      if(mounted.current){prepared.forEach(photo=>urls.current.add(photo.preview));setPhotos(old=>[...old,...prepared]);}else prepared.forEach(photo=>URL.revokeObjectURL(photo.preview));
    }catch(err){prepared.forEach(photo=>URL.revokeObjectURL(photo.preview));if(mounted.current)setError(err.message);}finally{if(mounted.current)setBusy(false);}
  }
  function removePhoto(photo){URL.revokeObjectURL(photo.preview);urls.current.delete(photo.preview);setPhotos(old=>old.filter(p=>p.key!==photo.key));}
  async function save(event){
    event.preventDefault();if(busy)return;setError('');
    if(!practiceSchedule(date).enabled){setError('วันที่เลือกอยู่นอกช่วงรายงานหรือเป็นวันงดซ้อม');return;}
    setBusy(true);
    try{const next=await managePracticeReport({operation:report?'update':'create',id:id.current,expected_updated_at:report?.updated_at,duty_date:date,team_id:teamId,teacher_names:enteredTeacherNames(names),outcome,details:details.trim(),action_taken:outcome==='incident'?action.trim():'',keep_photos:kept.map(photo=>photo.full)},photos);onSaved(next);}
    catch(err){setError(err.message);}finally{if(mounted.current)setBusy(false);}
  }
  return <dialog ref={dialog} className="practice-form-dialog practice-admin-editor" aria-labelledby="practice-admin-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="practice-modal-header"><div><h2 id="practice-admin-title">{report?'แก้ไขรายงาน':'เพิ่มรายงาน'} · Admin</h2><p>ชื่อครู รายละเอียด วันที่ คณะสี และรูปภาพ</p></div><button type="button" className="practice-modal-close" aria-label="ปิดฟอร์ม Admin" autoFocus disabled={busy} onClick={onClose}>×</button></header>
    <div className="practice-modal-body"><form className="practice-form" onSubmit={save}><fieldset disabled={busy}>
      <div className="practice-admin-date-team"><label>วันที่รายงาน<input type="date" required min={PRACTICE_START} max={PRACTICE_END} value={date} onChange={event=>setDate(event.target.value)}/></label><label>คณะสี<select value={teamId} onChange={event=>setTeamId(event.target.value)}>{PRACTICE_TEAMS.map(team=><option key={team.id} value={team.id}>{team.name} · {team.color}</option>)}</select></label></div>
      <div className="practice-teacher-fields">{names.map((name,index)=><label key={index}>ครูผู้ปฏิบัติเวร คนที่ {index+1}{index===0?' *':' (ถ้ามี)'}<input required={index===0} minLength={2} maxLength={120} value={name} onChange={event=>{namesTouched.current=true;setNames(old=>old.map((value,i)=>i===index?event.target.value:value));}}/></label>)}<div className="practice-teacher-controls">{names.length<MAX_PRACTICE_TEACHERS&&<button type="button" className="practice-add-teacher" onClick={()=>{namesTouched.current=true;setNames(old=>[...old,'']);}}>+ เพิ่มครูคนที่ {names.length+1}</button>}{names.length>2&&<button type="button" className="practice-add-teacher" onClick={()=>{namesTouched.current=true;setNames(old=>old.slice(0,-1));}}>นำช่องครูคนที่ {names.length} ออก</button>}</div></div>
      <div className="practice-outcome-options">{[['normal','ปกติ'],['incident','มีเหตุการณ์']].map(([value,label])=><label key={value} className={outcome===value?'selected':''}><input type="radio" name="admin-practice-outcome" checked={outcome===value} onChange={()=>setOutcome(value)}/>{label}</label>)}</div>
      <label>รายละเอียดการดูแลหรือเหตุการณ์<textarea required rows={3} maxLength={3000} value={details} onChange={event=>setDetails(event.target.value)}/></label>
      {outcome==='incident'&&<label>การดำเนินการ<textarea required rows={2} maxLength={2000} value={action} onChange={event=>setAction(event.target.value)}/></label>}
      <div className="practice-upload-heading"><strong>รูปภาพ {kept.length+photos.length}/6 ภาพ *</strong><small>HEIC/HEIF แปลงเป็น JPG อัตโนมัติ · ต้นฉบับไม่เกิน 10 MB</small></div>
      <div className="practice-photo-previews">{kept.map(photo=><div key={photo.full}><img src={photo.thumbnail} alt="รูปภาพเดิม"/><button type="button" aria-label="นำรูปเดิมออก" onClick={()=>setKept(old=>old.filter(p=>p.full!==photo.full))}>×</button></div>)}{photos.map(photo=><div key={photo.key}><img src={photo.preview} alt="รูปภาพใหม่"/><button type="button" aria-label="นำรูปใหม่ออก" onClick={()=>removePhoto(photo)}>×</button></div>)}</div>
      <div className="practice-upload-actions"><label className="button button-secondary">ถ่ายภาพ<input type="file" aria-label="ถ่ายภาพ Admin" accept="image/*,.heic,.heif" capture="environment" onChange={addPhotos}/></label><label className="button button-secondary">แนบภาพ<input type="file" aria-label="แนบภาพ Admin" accept="image/*,.heic,.heif" multiple onChange={addPhotos}/></label></div>
      <button type="submit" className="button button-primary practice-submit" disabled={kept.length+photos.length===0}>บันทึกข้อมูล</button>
    </fieldset>{busy&&<p role="status">กำลังประมวลผลและบันทึกข้อมูล…</p>}{error&&<p className="form-error" role="alert">{error}</p>}</form></div>
  </dialog>;
}
