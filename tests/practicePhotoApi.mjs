// Non-mutating production smoke test: reuse an existing published report ID.
// The endpoint validates images then returns that report before any write.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const config=JSON.parse(fs.readFileSync(process.argv[2]));
const headers={apikey:config.anon,Authorization:'Bearer '+config.anon};
const url=config.url;
const before=await (await fetch(url+'/rest/v1/cs_practice_reports?select=*&status=eq.published&order=created_at.asc&limit=1',{headers})).json();
assert.ok(before[0],'An existing published report is required; this test never creates one');
const report=before[0];
const payload={...report,confirmed:true,photo_count:1};
async function submit(full,thumb,mime){
  const form=new FormData();form.append('report',JSON.stringify(payload));
  form.append('full0',new Blob([full],{type:mime}),'full');form.append('thumb0',new Blob([thumb],{type:mime}),'thumb');
  const response=await fetch(url+'/functions/v1/practice-report',{method:'POST',headers,body:form});
  return{status:response.status,body:await response.json()};
}
const jpg=fs.readFileSync(process.argv[3]),thumb=fs.readFileSync(process.argv[4]);
const converted=await submit(jpg,thumb,'image/jpeg');assert.equal(converted.status,200,JSON.stringify(converted.body));assert.equal(converted.body.report.id,report.id);assert.deepEqual(converted.body.report.photos,report.photos);
const webp=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
assert.equal((await submit(webp,webp,'image/webp')).status,200);
assert.equal((await submit(webp,webp,'image/jpeg')).status,400);
assert.equal((await submit(new Uint8Array(524289),thumb,'image/jpeg')).status,400);
const after=await (await fetch(url+'/rest/v1/cs_practice_reports?select=*&id=eq.'+report.id,{headers})).json();assert.deepEqual(after[0],report);
console.log('PASS: converted JPG accepted, legacy WebP accepted, spoofed/oversized JPEG rejected, existing report unchanged; no writes');
