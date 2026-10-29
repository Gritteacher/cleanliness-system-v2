import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { APP_VERSION, APP_ATTRIBUTION, DEVELOPER_CREDIT, DEVELOPER_NAME, APP_NAME_TH, APP_NAME_EN } from '../shared/appMetadata.mjs';
import { createAdminSummaryWorkbook } from '../src/utils/adminSummaryExcel.js';
import { applyWorkbookAttribution } from '../src/utils/exportAttribution.js';
import { practicePdfHtml } from '../netlify/functions/utils/practicePdfLayout.mjs';
import { practicePdfOptions } from '../src/utils/practicePdfOptions.js';

test('version is taken from the package and lockfile matches',async()=>{
  const packageInfo=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url)));
  const lock=JSON.parse(await fs.readFile(new URL('../package-lock.json',import.meta.url)));
  assert.equal(APP_VERSION,packageInfo.version);assert.equal(lock.version,APP_VERSION);assert.equal(lock.packages[''].version,APP_VERSION);
  assert.equal(DEVELOPER_CREDIT,'นายกฤษณพล ทองอุ่น ผู้พัฒนา');
});
test('all App route shells include the shared footer',async()=>{
  const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.equal((app.match(/className="app-shell"/g)||[]).length,(app.match(/<AppFooter\s*\/>/g)||[]).length);
});
test('system branding is consistent in the browser title and PDF layout',async()=>{
  const index=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(index.includes(APP_NAME_TH));assert.ok(index.includes(APP_NAME_EN));
  const options=practicePdfOptions({start:'2026-11-02',end:'2026-11-02',teamIds:['maen']});
  const html=practicePdfHtml({options,reports:[],supabaseUrl:'https://example.supabase.co',regularFont:'',mediumFont:''});
  assert.ok(html.includes(APP_NAME_TH));assert.ok(html.includes(APP_NAME_EN));assert.ok(!/Clean\s*&(?:amp;)?\s*Care/i.test(html));
});
test('PDF template and margin footer use the same attribution',async()=>{
  const options=practicePdfOptions({start:'2026-11-02',end:'2026-11-03',teamIds:['maen']});
  const html=practicePdfHtml({options,reports:[],supabaseUrl:'https://example.supabase.co',regularFont:'',mediumFont:''});
  assert.ok(html.includes(APP_ATTRIBUTION));
  const source=await fs.readFile(new URL('../netlify/functions/utils/pdfAttribution.mjs',import.meta.url),'utf8');
  assert.match(source,/text: APP_ATTRIBUTION/);assert.match(source,/pageNumber/);
});
test('summary Excel credits every selected sheet and preserves numeric data and filters',async()=>{
  const options={teams:[{id:'one',short_name:'ตัวอย่าง',color_name:'สีม่วง',sort_order:1}],scores:[{team_id:'one',score_date:'2026-11-02',cleanliness_score:9,attendance_score:8}],metrics:['cleanliness','management','total'],periodLabel:'พฤศจิกายน 2569',includeSummary:true,includeDaily:true};
  const workbook=await createAdminSummaryWorkbook(options);
  const restored=new ExcelJS.Workbook();await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(restored.creator,DEVELOPER_NAME);assert.equal(restored.description,APP_ATTRIBUTION);
  for(const sheet of restored.worksheets){assert.equal(sheet.getCell(sheet.rowCount,1).value,APP_ATTRIBUTION);assert.ok(sheet.headerFooter.oddFooter.includes(DEVELOPER_CREDIT));assert.ok(sheet.headerFooter.oddFooter.includes(APP_VERSION));assert.equal(sheet.getCell(6,sheet.columnCount).value,17);assert.equal(sheet.autoFilter,'A5:'+String.fromCharCode(64+sheet.columnCount)+'6');}
});
test('practice workbook adds credit outside the report data without changing frozen header',()=>{
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('รายงานเวรฝึกซ้อม',{views:[{state:'frozen',ySplit:1}]});
  sheet.addRow(['วันที่','ชื่อครู']);sheet.addRow(['2026-11-02','ครูตัวอย่าง']);
  applyWorkbookAttribution(book);
  assert.equal(sheet.getCell('B2').value,'ครูตัวอย่าง');assert.equal(sheet.views[0].ySplit,1);assert.equal(sheet.getCell('A4').value,APP_ATTRIBUTION);
});
