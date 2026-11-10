import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combinedPracticeReports,practicePdfHtml} from '../netlify/functions/utils/practicePdfLayout.mjs';
import {practicePdfOptions} from '../src/utils/practicePdfOptions.js';
const options=practicePdfOptions({start:'2026-11-05',end:'2026-11-05',teamIds:['maen','phanu']});
const first={id:'a',team_id:'maen',duty_date:'2026-11-05',created_at:'2026-11-05T10:00:00Z',teacher_names:['ครูหนึ่ง','ครูร่วม'],details:'รายงานช่วงแรก',outcome:'incident',action_taken:'ดูแลเรียบร้อย',photos:Array.from({length:6},(_,i)=>({full:'https://example.supabase.co/storage/v1/object/public/practice-duty-photos/a'+i+'.jpg'}))};
const second={...first,id:'b',created_at:'2026-11-05T12:00:00Z',teacher_names:['ครูสอง','ครูร่วม'],details:'รายงานช่วงสอง',outcome:'normal',action_taken:'',photos:first.photos.map(p=>({full:p.full.replace('/a','/b')}))};
test('same-day/team reports combine chronologically without losing either set of photos or teachers',()=>{
 const rows=combinedPracticeReports([second,first,{...first,team_id:'other'}],options);
 assert.equal(rows.length,1);assert.equal(rows[0].photos.length,12);
 assert.deepEqual(rows[0].teacher_names,['ครูหนึ่ง','ครูร่วม','ครูสอง']);
 assert.equal(rows[0].outcome,'incident');assert.match(rows[0].details,/ครั้งที่ 1: รายงานช่วงแรก.*ครั้งที่ 2: รายงานช่วงสอง/);
 const html=practicePdfHtml({options,reports:[second,first],supabaseUrl:'https://example.supabase.co',regularFont:'',mediumFont:''});
 assert.equal((html.match(/class="sheet"/g)||[]).length,1);assert.match(html,/photos-12/);assert.match(html,/2 รายงาน รวมทุกครั้ง/);
 assert.equal(first.details,'รายงานช่วงแรก');assert.equal(first.photos.length,6);
});
