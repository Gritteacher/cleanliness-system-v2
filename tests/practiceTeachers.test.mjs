import test from 'node:test';
import assert from 'node:assert/strict';
import { reportTeacherNames, enteredTeacherNames } from '../src/utils/practiceTeachers.js';
test('legacy single teacher reports remain readable',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูเดิม'}),['ครูเดิม']));
test('new reports show every teacher in order',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูหนึ่ง',teacher_names:['ครูหนึ่ง','ครูสอง','ครูสาม']}),['ครูหนึ่ง','ครูสอง','ครูสาม']));
test('optional empty fields do not create blank teachers',()=>assert.deepEqual(enteredTeacherNames([' ครูหนึ่ง ','',' ครูสอง ']),['ครูหนึ่ง','ครูสอง']));
test('nullable teacher list falls back to legacy name',()=>assert.deepEqual(reportTeacherNames({teacher_name:'ครูเดิม',teacher_names:null}),['ครูเดิม']));
test('empty report has no teachers',()=>assert.deepEqual(reportTeacherNames(null),[]));
