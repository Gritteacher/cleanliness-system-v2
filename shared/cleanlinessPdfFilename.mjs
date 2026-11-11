const colors={maen:'ม่วง',yaowaman:'น้ำเงิน',nipha:'แสด',piyarat:'ชมพู',phanu:'แดง'};
const allowedColors=new Set(Object.values(colors));
export function cleanlinessPdfFilename(date,team){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('วันที่รายงานไม่ถูกต้อง');
 const [year,month,day]=date.split('-');
 const label=String(team?.color_name||'').replace(/^สี/,'').trim();
 const color=Object.hasOwn(colors,team?.id)?colors[team.id]:(allowedColors.has(label)?label:team?'ไม่ระบุสี':'งดเวร');
 return `สะอาด_${color}_${day}-${month}-${String(Number(year)+543).slice(-2)}.pdf`;
}
export function cleanlinessPdfDisposition(date,team){
 const filename=cleanlinessPdfFilename(date,team);
 const id=Object.hasOwn(colors,team?.id)?team.id:'report';
 return `attachment; filename="clean-${id}-${date}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// Safari can return from print() before its save dialog is closed. Restore on
// afterprint, not in a synchronous finally block, so the suggested name survives.
export function printWithFilename(target,fileName){
 const original=target.document.title,title=fileName.replace(/\.pdf$/i,'');
 const restore=()=>{
  target.removeEventListener('afterprint',restore);
  if(target.document.title===title)target.document.title=original;
 };
 target.addEventListener('afterprint',restore);
 target.document.title=title;
 try{target.print();}catch(error){restore();throw error;}
}
