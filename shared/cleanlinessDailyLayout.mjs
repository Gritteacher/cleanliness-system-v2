import {APP_NAME_TH, APP_NAME_EN, APP_ATTRIBUTION} from './appMetadata.mjs';
import {cleanlinessPdfFilename} from './cleanlinessPdfFilename.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanlinessDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new Error('วันที่รายงานไม่ถูกต้อง');
  return new Intl.DateTimeFormat('th-TH',{dateStyle:'full',timeZone:'Asia/Bangkok'}).format(new Date(value+'T12:00:00+07:00'));
}
export function cleanlinessScore(value){return value==null||value===''||!Number.isFinite(Number(value))?'—':Number(value).toFixed(2);}
const total=(a,b)=>a==null||b==null?null:Number(a)+Number(b);
const status=value=>({present:'เข้าทำเวร',activity:'ไปกิจกรรม',absent:'ไม่เข้าทำเวร'}[value]||'รอข้อมูล');
export function cleanlinessPhotoUrl(room,supabaseUrl){
 try{
  const origin=new URL(supabaseUrl).origin;
  for(const source of [...(room.photo_public_urls||[]),room.legacy_public_url,room.legacy_thumbnail_url].filter(Boolean)){
   const url=new URL(source);
   if(url.protocol==='https:'&&url.origin===origin&&!url.username&&!url.password&&/^\/storage\/v1\/object\/public\/[^/]+\//.test(url.pathname))return url.href;
  }
 }catch{/* No arbitrary image origins in exported reports. */}
 return '';
}

export const cleanlinessDailyCss=`
.clean-sheet{box-sizing:border-box;width:190mm;min-height:273mm;margin:0 auto;color:#193f30;background:#fff;font-family:Sarabun,sans-serif;font-size:10pt;line-height:1.5;letter-spacing:normal;display:flex;flex-direction:column}
.clean-sheet *{box-sizing:border-box;letter-spacing:normal}
.clean-heading{border-bottom:3px solid #28553f;padding:0 0 5mm;margin-bottom:5mm;display:flex;justify-content:space-between;align-items:flex-start;gap:5mm}
.clean-kicker{font-size:8pt;color:#6e8074;margin:0 0 2mm}
.clean-heading h1{font-size:21pt;font-weight:600;line-height:1.4;margin:0 0 1mm;color:#193f30}
.clean-heading p{font-size:9pt;margin:0;color:#647669}
.clean-badge{background:#fff0b4;border-radius:3mm;padding:3mm;font-size:9pt;white-space:nowrap}
.clean-date{display:flex;justify-content:space-between;gap:5mm;align-items:center;padding:4mm 5mm;background:#edf4ee;border-radius:3mm;margin-bottom:4mm}
.clean-date strong{display:block;font-size:12pt;font-weight:600}.clean-date span{font-size:9pt;color:#597263}.clean-date .clean-team{text-align:right}
.clean-metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;margin-bottom:5mm}
.clean-metric{border:1px solid #dbe4d9;border-radius:3mm;padding:3mm 4mm;background:#fff}.clean-metric.total{background:#fff8df;border-color:#eadba0}
.clean-metric small{display:block;color:#5c7163;font-size:9pt}.clean-metric strong{font-size:25pt;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums}.clean-metric i{font-size:10pt;font-style:normal;margin-left:2mm;color:#718174}
.clean-section-title{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 2mm}.clean-section-title h2{font-size:12pt;margin:0;font-weight:600}.clean-section-title span{font-size:8pt;color:#647669}
.clean-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:var(--clean-table-size,9pt);line-height:1.5}
.clean-table th{font-size:8pt;font-weight:600;background:#edf3e9;color:#38543e;padding:3mm 1.5mm;text-align:left;border-bottom:1px solid #cbd8c8}
.clean-table td{padding:var(--clean-row-pad,2.6mm) 1.5mm;vertical-align:middle;border-bottom:1px solid #e0e7de;overflow-wrap:anywhere;white-space:normal}
.clean-table tbody tr:nth-child(even){background:#f8faf6}.clean-table .number{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}.clean-table td.total{background:#fff9e7;font-weight:600;color:#294d36}.clean-table .room strong{font-weight:600}.clean-table .room small{display:block;color:#647669;font-size:.9em}.clean-table .note{font-size:.9em;color:#506657}.clean-table .status{font-size:.9em}.clean-table th.total{background:#f8edbd}
.clean-empty{border:1px solid #dce5db;border-radius:3mm;padding:15mm 5mm;text-align:center;color:#617369}
.clean-legend{font-size:8pt;color:#67786b;margin-top:3mm;line-height:1.5}
.clean-footer{margin-top:auto;padding-top:5mm;display:flex;gap:4mm;justify-content:space-between;color:#687b6e;font-size:7.3pt;border-top:1px solid #dce5db}
.clean-footer span:last-child{white-space:nowrap}
.clean-sheet.clean-compact .clean-heading{padding-bottom:3mm;margin-bottom:3mm}.clean-sheet.clean-compact .clean-heading h1{font-size:18pt}
.clean-sheet.clean-compact .clean-date{padding:2.5mm 4mm;margin-bottom:3mm}.clean-sheet.clean-compact .clean-metrics{margin-bottom:3mm}.clean-sheet.clean-compact .clean-metric{padding:2mm 4mm}.clean-sheet.clean-compact .clean-metric strong{font-size:20pt}
.clean-sheet.clean-compact .clean-table .room strong{display:inline;margin-right:2mm}.clean-sheet.clean-compact .clean-table .room small{display:inline}
.clean-photo{display:block;width:17mm;height:11mm;object-fit:cover;object-position:50% 30%;border-radius:1mm;background:#edf2e9}
.clean-photo-missing{display:flex;align-items:center;justify-content:center;color:#788579;font-size:6.5pt;text-align:center;line-height:1.3}
.clean-sheet.clean-compact .clean-photo{width:var(--clean-photo-width,17mm);height:var(--clean-photo-height,10mm)}
.clean-table th.number:first-child{font-size:7pt;padding-inline:.4mm}
.clean-sheet.clean-compact .clean-heading{padding-bottom:2mm;margin-bottom:2mm}
.clean-sheet.clean-compact .clean-date{padding:2mm 4mm;margin-bottom:2mm}
.clean-sheet.clean-compact .clean-metrics{margin-bottom:2mm}.clean-sheet.clean-compact .clean-metric{padding:1.5mm 4mm}.clean-sheet.clean-compact .clean-metric strong{font-size:18pt}
.clean-sheet.clean-compact .clean-table th{padding-block:2mm}.clean-sheet.clean-compact .clean-legend{margin-top:2mm}.clean-sheet.clean-compact .clean-footer{padding-top:3mm}
`;

export function cleanlinessDailyBody({date,overview={},supabaseUrl,imageData}){
 const label=cleanlinessDate(date),team=overview.scheduledTeam,score=overview.score,rooms=overview.rooms||[];
 const entered=rooms.filter(r=>r.duty_status).length;
 const metric=(name,value,max,extra='')=>`<div class="clean-metric ${extra}"><small>${name}</small><strong>${cleanlinessScore(value)}</strong><i>/${max}</i></div>`;
 return `<article class="clean-sheet"><header class="clean-heading"><div><div class="clean-kicker">${escape(APP_NAME_EN)}</div><h1>รายงานคะแนนความสะอาด</h1><p>${escape(APP_NAME_TH)} · โรงเรียนเทพศิรินทร์ นนทบุรี</p></div><div class="clean-badge">ผลเวรประจำวัน</div></header>
 <div class="clean-date"><div><strong>${escape(label)}</strong><span>รายงานประจำวันที่ ${escape(date)}</span></div><div class="clean-team"><strong>${escape(team?.name||team?.short_name||'ไม่มีคณะเข้าเวรตามตาราง')}</strong><span>${escape(team?.color_name||'')}</span></div></div>
 <div class="clean-metrics">${metric('ความสะอาด',score?.cleanliness_score,10)}${metric('การบริหารจัดการ',score?.attendance_score,10)}${metric('คะแนนรวม',total(score?.cleanliness_score,score?.attendance_score),20,'total')}</div>
 <div class="clean-section-title"><h2>ผลประเมินรายพื้นที่</h2><span>${rooms.length} พื้นที่ · บันทึกเวรแล้ว ${entered}/${rooms.length}</span></div>
 ${rooms.length?`<table class="clean-table"><colgroup><col style="width:4%"><col style="width:11%"><col style="width:31%"><col style="width:10%"><col style="width:7%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:13%"></colgroup><thead><tr><th class="number">ลำดับ</th><th>ภาพพื้นที่</th><th>ห้อง / พื้นที่</th><th>สถานะเวร</th><th class="number">นักเรียน</th><th class="number">สะอาด<br>/10</th><th class="number">บริหาร<br>/10</th><th class="number total">รวม<br>/20</th><th>หมายเหตุ</th></tr></thead><tbody>${rooms.map((r,i)=>{
 const url=cleanlinessPhotoUrl(r,supabaseUrl),source=imageData?imageData.get(url):url;
 const safeSource=imageData?/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(source||'')?source:'':source;
 return `<tr><td class="number">${i+1}</td><td>${safeSource?`<img class="clean-photo" src="${escape(safeSource)}" alt="ภาพพื้นที่ ${escape(r.room_label)}" loading="eager" referrerpolicy="no-referrer">`:'<span class="clean-photo clean-photo-missing">ไม่มีภาพ</span>'}</td><td class="room"><strong>${escape(r.room_label||'—')}</strong><small>${escape(r.area_name||'—')}</small></td><td class="status">${escape(status(r.duty_status))}</td><td class="number">${r.student_count==null?'—':escape(r.student_count)}</td><td class="number">${cleanlinessScore(r.cleanliness_score)}</td><td class="number">${cleanlinessScore(r.attendance_score)}</td><td class="number total">${cleanlinessScore(total(r.cleanliness_score,r.attendance_score))}</td><td class="note">${escape([r.reason_summary,r.note].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'—')}</td></tr>`;}).join('')}</tbody></table>`:`<div class="clean-empty">${team?'ยังไม่ได้กำหนดพื้นที่รับผิดชอบ':'ไม่มีเวรตามตารางในวันที่เลือก'}</div>`}
 <p class="clean-legend">— หมายถึงยังไม่มีคะแนนหรือไม่อยู่ในเกณฑ์ประเมิน · คะแนนสรุปใช้ค่าจากระบบโดยตรง ไม่ใช่ผลรวมคะแนนรายพื้นที่</p>
 <footer class="clean-footer"><span>${escape(APP_ATTRIBUTION)}</span><span>ประจำวันที่ ${escape(date)} · 1 / 1</span></footer></article>`;
}
export function cleanlinessDailyHtml({date,overview,supabaseUrl,imageData,regularFont='',mediumFont=''}){
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(cleanlinessPdfFilename(date,overview?.scheduledTeam).replace(/\.pdf$/,''))}</title><style>@font-face{font-family:Sarabun;src:url(data:font/ttf;base64,${regularFont})} @font-face{font-family:Sarabun;src:url(data:font/ttf;base64,${mediumFont});font-weight:600} @page{size:A4 portrait;margin:10mm}html,body{margin:0;padding:0;background:white} ${cleanlinessDailyCss}</style></head><body>${cleanlinessDailyBody({date,overview,supabaseUrl,imageData})}</body></html>`;
}

// Shared by the browser's print action and the server PDF renderer.
export function fitCleanlinessSheet(sheet){
 for(const [compact,font,padding,height] of [[false,9,2.6,11],[false,9,1.8,11],[true,9,1.2,10],[true,9,.8,8],[true,9,.6,7],[true,8.5,.5,6],[true,8,.5,5.5]]){
  sheet.classList.toggle('clean-compact',compact);
  sheet.style.setProperty('--clean-table-size',font+'pt');
  sheet.style.setProperty('--clean-row-pad',padding+'mm');
  sheet.style.setProperty('--clean-photo-height',height+'mm');
  sheet.style.setProperty('--clean-photo-width',(height>=8?17:14)+'mm');
  if(sheet.getBoundingClientRect().height<=1040)return true;
 }
 return false;
}

export async function prepareCleanlinessImages(root){
 await Promise.all([...root.querySelectorAll('img.clean-photo')].map(async image=>{
  let timer;
  try{
   await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),8000);})]);
   image.style.objectPosition=image.naturalHeight>=image.naturalWidth?'50% 30%':'50% 50%';
  }catch{
   const placeholder=document.createElement('span');placeholder.className='clean-photo clean-photo-missing';placeholder.textContent='โหลดภาพไม่ได้';image.replaceWith(placeholder);
  }finally{clearTimeout(timer);}
 }));
}
