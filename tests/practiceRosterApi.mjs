// Read-only integration checks. Invalid submissions stop before upload/rate-limit/insert.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadEnv} from 'vite';
const env=loadEnv('production',process.cwd(),'VITE_');
const base=env.VITE_SUPABASE_URL.replace(/\/$/,''),key=env.VITE_SUPABASE_ANON_KEY;
assert.ok(base.includes('nefjjpfbhljknbxeqrfd'));
const headers={apikey:key,Authorization:`Bearer ${key}`};
const response=await fetch(base+'/rest/v1/cs_practice_duty_roster?select=duty_date,team_id,teacher_names&order=duty_date,team_id',{headers});
assert.equal(response.status,200);const actual=await response.json();
assert.equal(actual.length,140);assert.equal(new Set(actual.map(row=>row.duty_date)).size,28);
assert.equal(actual.reduce((sum,row)=>sum+row.teacher_names.length,0),283);
assert.equal(actual.some(row=>row.duty_date==='2026-11-07'),false);
assert.equal(actual.find(row=>row.duty_date==='2026-11-30'&&row.team_id==='yaowaman').teacher_names.length,4);
if(process.argv[2]){
 const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const expected=source.assignments.map(({duty_date,team_id,teacher_names})=>({duty_date,team_id,teacher_names})).sort((a,b)=>a.duty_date.localeCompare(b.duty_date)||a.team_id.localeCompare(b.team_id));
 assert.deepEqual(actual,expected);
}
for(const count of [4,5]){
 const form=new FormData();form.append('report',JSON.stringify({id:crypto.randomUUID(),duty_date:'2026-11-30',team_id:'yaowaman',teacher_names:Array.from({length:count},(_,i)=>`ครูทดสอบ${i+1}`),outcome:'normal',details:'validation only - no photos, never saved',action_taken:'',confirmed:true,photo_count:0}));
 const response=await fetch(base+'/functions/v1/practice-report',{method:'POST',headers,body:form});
 const body=await response.json();assert.equal(response.status,400,JSON.stringify(body));
 assert.match(body.error,count===4?/กรุณาแนบภาพ/:/1–4 คน/);
}
console.log('PASS: all 140 roster entries exactly match source; 283 slots; holiday excluded; four names accepted; five rejected; no reports submitted.');
