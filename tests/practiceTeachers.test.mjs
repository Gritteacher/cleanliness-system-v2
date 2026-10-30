import test from 'node:test';
import assert from 'node:assert/strict';
import { reportTeacherNames, enteredTeacherNames, draftTeacherNames, applyRosterNames, MAX_PRACTICE_TEACHERS } from '../src/utils/practiceTeachers.js';
test('legacy single teacher reports remain readable',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูเดิม'}),['ครูเดิม']));
test('new reports show every teacher in order',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูหนึ่ง',teacher_names:['ครูหนึ่ง','ครูสอง','ครูสาม']}),['ครูหนึ่ง','ครูสอง','ครูสาม']));
test('optional empty fields do not create blank teachers',()=>assert.deepEqual(enteredTeacherNames([' ครูหนึ่ง ','',' ครูสอง ']),['ครูหนึ่ง','ครูสอง']));
test('nullable teacher list falls back to legacy name',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูเดิม',teacher_names:null}),['ครูเดิม']));
test('empty report has no teachers',()=>assert.deepEqual(reportTeacherNames(null),[]));
test('roster supports four teachers without mutating source data',()=>{
 const names=['ครูหนึ่ง','ครูสอง','ครูสาม','ครูสี่'];
 assert.equal(MAX_PRACTICE_TEACHERS,4);
 assert.deepEqual(draftTeacherNames(names),names);
 assert.notEqual(draftTeacherNames(names),names);
 assert.deepEqual(draftTeacherNames(),['','']);
 assert.deepEqual(draftTeacherNames(['ครูหนึ่ง']),['ครูหนึ่ง','']);
 assert.deepEqual(reportTeacherNames({teacher_names:names}),names);
});
test('late roster response preserves manually edited names and all other draft data',()=>{
 const draft={names:['ชื่อที่ครูแก้',''],namesTouched:true,details:'ข้อความที่ยังไม่ส่ง',photos:[{key:'local'}],confirmed:true};
 assert.equal(applyRosterNames(draft,['ตามตาราง']),draft);
 const initial={...draft,namesTouched:false};const next=applyRosterNames(initial,['ตามตารางหนึ่ง','ตามตารางสอง']);
 assert.deepEqual(next.names,['ตามตารางหนึ่ง','ตามตารางสอง']);
 assert.equal(next.details,initial.details);assert.equal(next.photos,initial.photos);assert.equal(next.confirmed,true);
});
