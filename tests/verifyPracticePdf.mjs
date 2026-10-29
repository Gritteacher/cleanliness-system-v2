// Document-rendering QA, not browser UI automation. No database writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createPracticePdf } from '../netlify/functions/utils/practicePdf.mjs';
import { PRACTICE_TEAMS } from '../src/utils/practiceSchedule.js';
const output=path.resolve('output/pdf');await fs.mkdir(output,{recursive:true});
const config=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(!process.argv[3])throw new Error('Usage: node tests/verifyPracticePdf.mjs <private-config.json> <sample.jpg>');
const image='data:image/jpeg;base64,'+(await fs.readFile(process.argv[3])).toString('base64');
const photo=config.url+'/storage/v1/object/public/practice-duty-photos/qa.jpg';
const options={start:'2026-11-02',end:'2026-11-02',teamIds:PRACTICE_TEAMS.map(t=>t.id)};
const reports=PRACTICE_TEAMS.map((t,i)=>({id:'qa-'+i,duty_date:'2026-11-02',team_id:t.id,teacher_name:'ครูตัวอย่าง คนที่หนึ่ง',teacher_names:['ครูตัวอย่าง คนที่หนึ่ง','ครูตัวอย่าง คนที่สอง','ครูตัวอย่าง คนที่สาม'],created_at:'2026-11-02T12:00:00Z',outcome:i===2?'incident':'normal',details:i===2?'พบนักเรียนบาดเจ็บเล็กน้อยระหว่างฝึกซ้อม':'ดูแลนักเรียนฝึกซ้อมกิจกรรมคณะสีเรียบร้อย นักเรียนกลับบ้านอย่างปลอดภัย',action_taken:i===2?'ปฐมพยาบาลและแจ้งผู้ปกครอง':'',photos:[{full:photo,thumbnail:photo}]}));
const test={reports,imageData:new Map([[photo,image]]),supabaseUrl:config.url,executablePath:process.env.PDF_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};
await fs.writeFile(path.join(output,'practice-duty-layout-example.pdf'),await createPracticePdf(options,test));
await fs.writeFile(path.join(output,'practice-duty-range-example.pdf'),await createPracticePdf({...options,end:'2026-11-04',teamIds:['maen','phanu']},test));
const longReports=reports.map(r=>({...r,teacher_names:['ชื่อครูยาว'.repeat(12),'ชื่อครูยาว'.repeat(12),'ชื่อครูยาว'.repeat(12)],details:'รายละเอียดการดูแลนักเรียนอย่างครบถ้วน '.repeat(65),action_taken:'ประสานครูประจำชั้นและผู้ปกครอง '.repeat(35)}));
await fs.writeFile(path.join(output,'practice-duty-long-details-example.pdf'),await createPracticePdf(options,{...test,reports:longReports}));
// Actual published data, fetched with public permissions only.
const headers={apikey:config.anon,Authorization:'Bearer '+config.anon};
const real=await(await fetch(config.url+'/rest/v1/cs_practice_reports?select=*&status=eq.published&duty_date=eq.2026-11-02',{headers})).json();
await fs.writeFile(path.join(output,'practice-duty-2026-11-02.pdf'),await createPracticePdf(options,{...test,reports:real,imageData:undefined}));
console.log('Rendered: five-color sample, three-day filtered sample, long-details appendices, actual published day.');
