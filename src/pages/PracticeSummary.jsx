import { useEffect, useState } from 'react';
import { loadPracticeReports } from '../services/practiceService.js';
import { reportTeacherNames } from '../utils/practiceTeachers.js';
import { applyWorkbookAttribution } from '../utils/exportAttribution.js';
import { PRACTICE_START, PRACTICE_END, PRACTICE_TEAMS, practiceSchedule } from '../utils/practiceSchedule.js';

export default function PracticeSummary({ navigate }) {
  const [start,setStart]=useState(PRACTICE_START),[end,setEnd]=useState(PRACTICE_END),[team,setTeam]=useState('all'),[incident,setIncident]=useState(false);
  const [reports,setReports]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[exporting,setExporting]=useState(false),[refresh,setRefresh]=useState(0);
  useEffect(()=>{let cancelled=false;setBusy(true);setError(''); if(start>end){setError('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');setBusy(false);return;}
    loadPracticeReports(start,end).then(data=>{if(!cancelled)setReports(data);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});return()=>{cancelled=true;};
  },[start,end,refresh]);
  const teams=PRACTICE_TEAMS.filter(t=>team==='all'||t.id===team);
  const rows=reports.filter(r=>(team==='all'||r.team_id===team)&&(!incident||r.outcome==='incident'));
  const days=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`).filter(d=>d>=start&&d<=end&&practiceSchedule(d).enabled);
  const summary=teams.map(t=>{const matches=reports.filter(r=>r.team_id===t.id);const count=new Set(matches.map(r=>r.duty_date)).size;return{team:t,days:count,missing:days.length-count,reports:matches.length,incidents:matches.filter(r=>r.outcome==='incident').length};});
  async function exportExcel(){setExporting(true);setError('');try{
    const module=await import('exceljs'); const ExcelJS=module.default||module;const book=new ExcelJS.Workbook();
    const sheet=book.addWorksheet('รายงานเวรฝึกซ้อม',{views:[{state:'frozen',ySplit:1}]});
    sheet.columns=[{header:'วันที่',key:'date',width:16},{header:'คณะสี',key:'team',width:25},{header:'ชื่อครู',key:'teacher',width:30},{header:'เวลาฝึกซ้อม',key:'time',width:24},{header:'ผลการดูแล',key:'outcome',width:18},{header:'รายละเอียด',key:'details',width:60},{header:'การดำเนินการ',key:'action',width:45},{header:'ลิงก์ภาพ',key:'photos',width:70},{header:'เวลาส่ง (ประเทศไทย)',key:'created',width:26},{header:'เลขอ้างอิง',key:'id',width:40}];
    for(const r of rows)sheet.addRow({date:new Date(r.duty_date+'T00:00:00Z'),team:PRACTICE_TEAMS.find(t=>t.id===r.team_id)?.name||r.team_id,teacher:reportTeacherNames(r).join('\n'),time:practiceSchedule(r.duty_date).label,outcome:r.outcome==='normal'?'ปกติ':'มีเหตุการณ์',details:r.details,action:r.action_taken,photos:r.photos.map(p=>p.full).join('\n'),created:new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'medium'}).format(new Date(r.created_at)),id:r.id});
    sheet.getColumn('date').numFmt='dd/mm/yyyy';sheet.autoFilter={from:'A1',to:'J1'};
    sheet.eachRow((row,n)=>{row.font={name:'Sarabun',size:12,...(n===1?{bold:true,color:{argb:'FFFFFFFF'}}:{})};row.alignment={vertical:'top',wrapText:true};if(n===1){row.height=30;row.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF24563A'}};});}});
    applyWorkbookAttribution(book);
    const blob=new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`practice-reports-${start}-${end}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch{setError('ส่งออกไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setExporting(false);}}
  return <section className="page-container practice-page"><button className="practice-back" type="button" onClick={()=>navigate('/practice')}>← กลับรายงานเวร</button><header className="practice-page-heading"><span className="eyebrow">ADMIN · PRACTICE REPORTS</span><h1>สรุปรายงานเวรฝึกซ้อม</h1><p>นับวันรายงานแยกแต่ละสี ไม่รวมวันที่ 7 พฤศจิกายนที่งดซ้อม</p></header>
    <div className="practice-summary-filters"><label>ตั้งแต่วันที่<input type="date" min={PRACTICE_START} max={PRACTICE_END} value={start} onInput={e=>{if(e.target.value>=PRACTICE_START&&e.target.value<=PRACTICE_END)setStart(e.target.value);}} /></label><label>ถึงวันที่<input type="date" min={PRACTICE_START} max={PRACTICE_END} value={end} onInput={e=>{if(e.target.value>=PRACTICE_START&&e.target.value<=PRACTICE_END)setEnd(e.target.value);}} /></label><label>คณะสี<select value={team} onChange={e=>setTeam(e.target.value)}><option value="all">ทุกคณะสี</option>{PRACTICE_TEAMS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" className="button button-secondary" onClick={()=>setRefresh(v=>v+1)}>รีเฟรช</button></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="practice-summary-cards">{summary.map(s=><article key={s.team.id} style={{borderTopColor:s.team.accent}}><h2>{s.team.name}</h2><strong>{busy||error?'—':`${s.days}/${days.length}`} วัน</strong><p>{s.reports} รายงาน · ยังไม่รายงาน {s.missing} วัน</p><small>มีเหตุการณ์ {s.incidents} รายงาน</small></article>)}</div>
    <div className="practice-summary-actions"><label><input type="checkbox" checked={incident} onChange={e=>setIncident(e.target.checked)} /> เฉพาะรายงานที่มีเหตุการณ์</label><button type="button" className="button button-primary" disabled={busy||!!error||exporting} onClick={exportExcel}>{exporting?'กำลังส่งออก…':`ส่งออก Excel (${rows.length} รายงาน)`}</button></div>
    <div className="report-table-scroll practice-summary-table"><table className="report-table"><thead><tr><th>วันที่</th><th>คณะสี / ครู</th><th>ผลการดูแล</th><th>รายละเอียด / ภาพ</th></tr></thead><tbody>{!busy&&!error&&rows.map(r=><tr key={r.id}><td>{r.duty_date}</td><td>{PRACTICE_TEAMS.find(t=>t.id===r.team_id)?.name}<br/>{reportTeacherNames(r).join(' / ')}</td><td>{r.outcome==='normal'?'ปกติ':'มีเหตุการณ์'}</td><td><p>{r.details}</p>{r.action_taken&&<p>การดำเนินการ: {r.action_taken}</p>}{r.photos.map((p,i)=><a key={p.full} href={p.full} target="_blank" rel="noreferrer">ภาพ {i+1} ↗ </a>)}</td></tr>)}</tbody></table>{busy?<p>กำลังโหลด…</p>:!error&&!rows.length?<p>ยังไม่มีรายงานตามเงื่อนไข</p>:null}</div>
  </section>;
}
