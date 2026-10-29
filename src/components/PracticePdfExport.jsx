import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS } from '../utils/practiceSchedule.js';
import { practicePdfOptions } from '../utils/practicePdfOptions.js';

export default function PracticePdfExport({ date }) {
  const dialog=useRef(null);
  const [open,setOpen]=useState(false),[mode,setMode]=useState('day'),[start,setStart]=useState(date),[end,setEnd]=useState(date),[teamIds,setTeamIds]=useState(PRACTICE_TEAMS.map(t=>t.id));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();return()=>{dialog.current?.close();document.body.style.overflow=previous;};},[open]);
  function show(){setStart(date);setEnd(date);setError('');setMessage('');setOpen(true);}
  async function download(event){
    event.preventDefault();if(busy)return;setError('');setMessage('');
    let options;
    try{options=practicePdfOptions({start,end:mode==='day'?start:end,teamIds});}catch(err){setError(err.message);return;}
    setBusy(true);
    try{
      const response=await fetch('/.netlify/functions/create-practice-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:options.start,end:options.end,teamIds:options.teamIds}),signal:AbortSignal.timeout(90000)});
      if(!response.ok){let detail;try{detail=await response.json();}catch{}throw new Error(response.status===429?'ส่งออกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่':detail?.message||'สร้าง PDF ไม่สำเร็จ กรุณาลองอีกครั้ง');}
      if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('ไฟล์ส่งออกไม่ถูกต้อง กรุณาลองอีกครั้ง');
      const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`practice-duty-${options.start}-${options.end}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('สร้าง PDF สำเร็จแล้ว สามารถเปิดจากรายการดาวน์โหลดได้');
    }catch(err){setError(err.name==='TimeoutError'?'ใช้เวลาส่งออกนานเกินไป กรุณาเลือกช่วงวันที่สั้นลง':err.message);}finally{setBusy(false);}
  }
  return <>
    <button type="button" className="practice-pdf-trigger" aria-haspopup="dialog" onClick={show}><Icon name="download" size={18}/> ส่งออก PDF</button>
    <dialog ref={dialog} className="practice-form-dialog practice-export-dialog" aria-labelledby="practice-pdf-title" onCancel={event=>{event.preventDefault();if(!busy)setOpen(false);}} onClose={()=>setOpen(false)}>
      <header className="practice-modal-header"><div><h2 id="practice-pdf-title">ส่งออกรายงาน PDF</h2><p>A4 แนวนอน · รวมคณะสีที่เลือกในหน้าเดียวต่อวัน</p></div><button type="button" className="practice-modal-close" aria-label="ปิดหน้าส่งออก PDF" autoFocus disabled={busy} onClick={()=>setOpen(false)}>×</button></header>
      <div className="practice-modal-body"><form onSubmit={download} className="practice-pdf-form"><fieldset disabled={busy}>
        <legend>เลือกวันที่ส่งออก</legend><div className="practice-pdf-modes">{[['day','วันเดียว'],['range','ช่วงวันที่']].map(([value,label])=><label key={value} className={mode===value?'selected':''}><input type="radio" name="practice-pdf-mode" checked={mode===value} onChange={()=>setMode(value)}/>{label}</label>)}</div>
        <div className="practice-pdf-dates"><label>{mode==='day'?'วันที่':'ตั้งแต่วันที่'}<input required type="date" min={PRACTICE_START} max={PRACTICE_END} value={start} onChange={event=>setStart(event.target.value)}/></label>{mode==='range'&&<label>ถึงวันที่<input required type="date" min={PRACTICE_START} max={PRACTICE_END} value={end} onChange={event=>setEnd(event.target.value)}/></label>}</div>
        <div className="practice-pdf-team-heading"><strong>เลือกคณะสี</strong><button type="button" onClick={()=>setTeamIds(PRACTICE_TEAMS.map(t=>t.id))}>เลือกทุกสี</button></div>
        <div className="practice-pdf-team-options">{PRACTICE_TEAMS.map(team=><label key={team.id} style={{'--team':team.accent}}><input type="checkbox" checked={teamIds.includes(team.id)} onChange={()=>setTeamIds(old=>old.includes(team.id)?old.filter(id=>id!==team.id):[...old,team.id])}/><i/><span>คณะ{team.name}<small>{team.color}</small></span></label>)}</div>
        <p className="practice-pdf-help">ภาพหลักของแต่ละสี พร้อมลิงก์ภาพเพิ่มเติม · ข้อความยาวและรายงานเพิ่มเติมมีภาคผนวกฉบับเต็ม</p>
        <button className="button button-primary practice-pdf-download" type="submit" disabled={!teamIds.length}>{busy?'กำลังสร้าง PDF…':'ดาวน์โหลด PDF'}</button>
      </fieldset>{busy&&<p className="practice-pdf-progress" role="status">กำลังโหลดรายงานและจัดหน้า กรุณารอสักครู่…</p>}{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="practice-success" role="status">{message}</p>}</form></div>
    </dialog>
  </>;
}
