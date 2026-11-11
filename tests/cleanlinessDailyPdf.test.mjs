import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanlinessDailyBody,cleanlinessDate,cleanlinessScore} from '../shared/cleanlinessDailyLayout.mjs';
import {APP_ATTRIBUTION} from '../shared/appMetadata.mjs';
const date='2026-11-02';
test('daily cleanliness report uses canonical summary scores, not an average recomputed from rows',()=>{
 const html=cleanlinessDailyBody({date,overview:{scheduledTeam:{name:'คณะตัวอย่าง',color_name:'สีม่วง'},score:{cleanliness_score:8.23,attendance_score:9.4},rooms:[{room_label:'1/1',area_name:'รอบเรือน',duty_status:'present',student_count:0,cleanliness_score:0,attendance_score:0}]}});
 for(const value of ['8.23','9.40','17.63','0.00','1/1','รอบเรือน',APP_ATTRIBUTION])assert.ok(html.includes(value));
 assert.equal((html.match(/class="clean-sheet"/g)||[]).length,1);
});
test('all areas and full remarks remain present, in source order',()=>{
 const rooms=Array.from({length:25},(_,i)=>({room_label:'ห้อง'+i,area_name:'พื้นที่'+i,note:'หมายเหตุ'+i,reason_summary:'ข้อเสนอแนะ'+i}));
 const html=cleanlinessDailyBody({date,overview:{rooms}});
 for(let i=0;i<25;i++)for(const value of ['ห้อง'+i,'พื้นที่'+i,'หมายเหตุ'+i,'ข้อเสนอแนะ'+i])assert.ok(html.includes(value));
 assert.ok(html.indexOf('ห้อง0')<html.indexOf('ห้อง24'));assert.ok(html.includes('บันทึกเวรแล้ว 0/25'));
});
test('missing and activity scores are not converted to zero, and zero is not missing',()=>{
 assert.equal(cleanlinessScore(null),'—');assert.equal(cleanlinessScore(0),'0.00');assert.equal(cleanlinessScore('0'),'0.00');
 const html=cleanlinessDailyBody({date,overview:{scheduledTeam:{name:'คณะตัวอย่าง'},rooms:[{duty_status:'activity',cleanliness_score:null,attendance_score:null}]}});
 assert.ok(html.includes('ไปกิจกรรม'));assert.ok(!html.includes('>0.00<'));assert.ok(html.includes('>—<'));
});
test('dates are validated before any PDF work and user text is escaped',()=>{
 for(const value of ['2026-02-30','2026-11-31','bad','2026-1-1'])assert.throws(()=>cleanlinessDate(value));
 const html=cleanlinessDailyBody({date,overview:{rooms:[{room_label:'<script>alert(1)</script>',note:'<img src=x onerror=alert(1)>'}]}});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
});
test('days without scheduled duty are explicit and attribution is included',()=>{
 const html=cleanlinessDailyBody({date,overview:{}});assert.ok(html.includes('ไม่มีเวรตามตารางในวันที่เลือก'));assert.ok(html.includes(APP_ATTRIBUTION));
});
