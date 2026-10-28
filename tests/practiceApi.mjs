// Integration smoke checks; configure a local private file with { url, anon }.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync(process.argv[2]));
const headers={apikey:a.anon,Authorization:'Bearer '+a.anon};
const id=crypto.randomUUID();
const base={id,duty_date:'2026-11-02',team_id:'maen',teacher_name:'ทดสอบระบบ — ไม่ใช่รายงานจริง',outcome:'normal',details:'ทดสอบระบบก่อนเปิดใช้งาน',action_taken:'',confirmed:true,photo_count:1};
const bytes=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
async function submit(p){ const f=new FormData();f.append('report',JSON.stringify(p));f.append('full0',new Blob([bytes],{type:'image/webp'}),'test.webp');f.append('thumb0',new Blob([bytes],{type:'image/webp'}),'test.webp');const r=await fetch(a.url+'/functions/v1/practice-report',{method:'POST',headers,body:f});return {status:r.status,body:await r.json()}; }
assert.equal((await submit({...base,duty_date:'2026-11-07'})).status,400);
assert.equal((await submit({...base,confirmed:false})).status,400);
assert.equal((await submit({...base,team_id:'invalid'})).status,400);
assert.equal((await submit({...base,outcome:'incident'})).status,400);
for(const method of ['POST','PATCH','DELETE']) {
 const {photo_count:_,...direct}=base;
 const r=await fetch(a.url+'/rest/v1/cs_practice_reports?id=eq.'+id,{method,headers:{...headers,'Content-Type':'application/json'},...(method==='DELETE'?{}:{body:JSON.stringify(method==='POST'?{...direct,end_time:'19:00'}:{teacher_name:'unauthorized'})})});
 assert.ok([401,403].includes(r.status),`${method} must be denied: ${r.status}`);
}
const rate=await fetch(a.url+'/rest/v1/rpc/cs_practice_claim_rate',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_source:'a'.repeat(64)})});assert.ok([401,403].includes(rate.status));
const result=await submit(base);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.report.end_time,'19:00:00');
assert.equal((await submit(base)).body.report.id,id);
const read=await fetch(a.url+'/rest/v1/cs_practice_reports?id=eq.'+id,{headers});const rows=await read.json();assert.equal(rows.length,1);assert.equal(rows[0].photos.length,1);
for(const photo of rows[0].photos)for(const value of Object.values(photo))assert.equal((await fetch(value)).status,200);
fs.writeFileSync('/tmp/practice-test-report.json',JSON.stringify({id,report:rows[0]}),{mode:0o600});
console.log(JSON.stringify({passed:true,id,checks:'validation, no-login submit, idempotency, public read, photo fetch, denied direct writes and rate RPC'}));
