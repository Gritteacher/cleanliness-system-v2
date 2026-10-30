import fs from 'node:fs';
import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync(process.argv[2]));
const headers={apikey:a.anon,Authorization:'Bearer '+a.anon};
const bytes=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
const base={duty_date:'2026-11-02',team_id:'maen',teacher_name:'ทดสอบหลายชื่อ — ไม่ใช่รายงานจริง',outcome:'normal',details:'ทดสอบรายชื่อครูก่อนเผยแพร่ ต้องลบรายการทดสอบนี้',action_taken:'',confirmed:true,photo_count:1};
const created=[];
async function submit(payload){const f=new FormData();f.append('report',JSON.stringify(payload));for(const name of ['full0','thumb0'])f.append(name,new Blob([bytes],{type:'image/webp'}),'test.webp');const r=await fetch(a.url+'/functions/v1/practice-report',{method:'POST',headers,body:f});return{status:r.status,body:await r.json()};}
for(const names of [[],['ครูหนึ่ง','ครูสอง','ครูสาม','ครูสี่','ครูห้า'],['ครูหนึ่ง',' '],['ครูหนึ่ง',null]])assert.equal((await submit({...base,id:crypto.randomUUID(),teacher_names:names})).status,400);
for(const names of [undefined,[base.teacher_name,'ทดสอบครูสอง'],[base.teacher_name,'ทดสอบครูสอง','ทดสอบครูสาม'],[base.teacher_name,'ทดสอบครูสอง','ทดสอบครูสาม','ทดสอบครูสี่']]){
 const p={...base,id:crypto.randomUUID(),...(names?{teacher_names:names}:{})};
 const result=await submit(p);
 if(result.status===200){created.push(result.body.report);fs.writeFileSync('/tmp/practice-teachers-api-created.json',JSON.stringify(created),{mode:0o600});}
 assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.report.teacher_names,names||[base.teacher_name]);
 const r=await fetch(a.url+'/rest/v1/cs_practice_reports?id=eq.'+p.id,{headers});const rows=await r.json();assert.deepEqual(rows[0].teacher_names,names||[base.teacher_name]);
}
console.log(JSON.stringify({passed:true,count:created.length,ids:created.map(r=>r.id),checks:'legacy one teacher, two and three teachers, invalid arrays rejected, public read preserves all names'}));
