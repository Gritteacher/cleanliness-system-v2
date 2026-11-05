// PDF document rendering only; no browser UI automation or production writes.
import fs from 'node:fs/promises';
import {createPracticePdf} from '../netlify/functions/utils/practicePdf.mjs';
import {PRACTICE_TEAMS} from '../src/utils/practiceSchedule.js';
const base='https://example.supabase.co',dir='output/pdf';await fs.mkdir(dir,{recursive:true});
const imageData=new Map();
const reports=PRACTICE_TEAMS.map((team,i)=>({id:'fixture-'+i,team_id:team.id,duty_date:'2026-11-05',created_at:'2026-11-05T12:00:00Z',teacher_names:['นายกิตติพงษ์ ใจดี','นางสาวณัฐธิดา รักษ์เรียน','นายธนภัทร ศรีสวัสดิ์','นางสุภาพร แสงทอง'],outcome:i===2?'incident':'normal',details:i===4?'ดูแลนักเรียนฝึกซ้อมกิจกรรมคณะสี ตรวจความเรียบร้อยและความปลอดภัย '.repeat(12):'ดูแลนักเรียนฝึกซ้อมและตรวจความเรียบร้อย นักเรียนกลับบ้านเวลา 19.00 น. เก็บอุปกรณ์และทำความสะอาดพื้นที่เรียบร้อย',action_taken:i===2?'ดูแลปฐมพยาบาลเบื้องต้นและประสานผู้ปกครองเรียบร้อย':'',photos:Array.from({length:[1,2,3,4,6][i]},(_,j)=>{
 const full=base+`/storage/v1/object/public/practice-duty-photos/${i}-${j}.jpg`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#e5f0e4"/><rect y="640" width="1600" height="360" fill="#93b7a0"/><rect x="180" y="210" width="1240" height="430" rx="24" fill="#fff9db"/><path d="M100 210L800 50 1500 210Z" fill="${team.accent}"/><g fill="#54836b">${[0,1,2,3,4,5].map(k=>`<rect x="${260+k*180}" y="300" width="100" height="170"/>`).join('')}</g><text x="800" y="850" text-anchor="middle" fill="#173e2b" font-family="sans-serif" font-size="90">SAMPLE ${i+1} / ${j+1}</text></svg>`;
 imageData.set(full,'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));return {full,thumbnail:full};
})}));
const options={start:'2026-11-05',end:'2026-11-05',teamIds:PRACTICE_TEAMS.map(t=>t.id)};
const test={reports,imageData,supabaseUrl:base,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};
await fs.writeFile(dir+'/practice-redesign-sample.pdf',await createPracticePdf(options,test));
await fs.writeFile(dir+'/practice-redesign-range.pdf',await createPracticePdf({...options,end:'2026-11-07'},test));
console.log('Rendered one-day five-team sample and three-day range, all galleries and four teachers.');
