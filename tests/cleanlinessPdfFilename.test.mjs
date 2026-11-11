import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanlinessPdfFilename,cleanlinessPdfDisposition,printWithFilename} from '../shared/cleanlinessPdfFilename.mjs';
import {cleanlinessDailyHtml} from '../shared/cleanlinessDailyLayout.mjs';
test('short names use the selected date in Buddhist year and actual scheduled team, not weekday',()=>{
 for(const [id,color]of Object.entries({maen:'ม่วง',yaowaman:'น้ำเงิน',nipha:'แสด',piyarat:'ชมพู',phanu:'แดง'}))assert.equal(cleanlinessPdfFilename('2026-11-02',{id}),`สะอาด_${color}_02-11-69.pdf`);
 assert.equal(cleanlinessPdfFilename('2027-01-01',{id:'phanu'}),'สะอาด_แดง_01-01-70.pdf');
 assert.equal(cleanlinessPdfFilename('2026-11-07',null),'สะอาด_งดเวร_07-11-69.pdf');
});
test('names tolerate incomplete team records without accepting path/control characters',()=>{
 assert.equal(cleanlinessPdfFilename('2026-11-02',{color_name:'สีม่วง'}),'สะอาด_ม่วง_02-11-69.pdf');
 assert.equal(cleanlinessPdfFilename('2026-11-02',{id:'../../bad',color_name:'evil\r\n/file'}),'สะอาด_ไม่ระบุสี_02-11-69.pdf');
 for(const bad of ['2026-02-30','bad','2026-1-1'])assert.throws(()=>cleanlinessPdfFilename(bad,null));
});
test('download header is ASCII-safe with an RFC 5987 UTF-8 filename',()=>{
 const header=cleanlinessPdfDisposition('2026-11-02',{id:'maen'});
 assert.match(header,/filename="clean-maen-2026-11-02.pdf"/);assert.equal(decodeURIComponent(header.split("filename*=UTF-8''")[1]),'สะอาด_ม่วง_02-11-69.pdf');
 assert.ok([...header].every(c=>c.charCodeAt(0)<128));
 new Response(null,{headers:{'Content-Disposition':header}});
});
test('print title survives asynchronous print and is restored afterprint, not prematurely',()=>{
 const events=new Map(),target={document:{title:'ชื่อเว็บเดิม'},addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k),print(){assert.equal(this.document.title,'สะอาด_ม่วง_02-11-69');}};
 printWithFilename(target,'สะอาด_ม่วง_02-11-69.pdf');
 assert.equal(target.document.title,'สะอาด_ม่วง_02-11-69');events.get('afterprint')();assert.equal(target.document.title,'ชื่อเว็บเดิม');assert.equal(events.size,0);
 target.print=()=>{throw new Error('Print failed');};assert.throws(()=>printWithFilename(target,'สะอาด_ม่วง_02-11-69.pdf'));assert.equal(target.document.title,'ชื่อเว็บเดิม');
});
test('PDF metadata title uses the same concise filename',()=>{
 const html=cleanlinessDailyHtml({date:'2026-11-02',overview:{scheduledTeam:{id:'maen'}}});assert.ok(html.includes('<title>สะอาด_ม่วง_02-11-69</title>'));
});
