import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('export dialog omits descriptive paragraphs while keeping controls and status feedback',async()=>{
 const source=await readFile(new URL('../src/components/PracticePdfExport.jsx',import.meta.url),'utf8');
 assert.ok(!source.includes('A4 แนวตั้ง'));
 assert.ok(!source.includes('practice-pdf-help'));
 for(const text of ['ภาพ PNG','ช่วงวันที่','เลือกคณะสี','ดาวน์โหลด PDF','role="status"','role="alert"'])assert.ok(source.includes(text));
});
