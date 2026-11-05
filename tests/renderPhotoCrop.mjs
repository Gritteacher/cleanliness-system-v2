// Document-rendering QA only, with synthetic subjects and no production writes.
import fs from 'node:fs/promises';
import {createPracticePdf} from '../netlify/functions/utils/practicePdf.mjs';
import {PRACTICE_TEAMS} from '../src/utils/practiceSchedule.js';
const base='https://example.supabase.co',imageData=new Map();
const reports=PRACTICE_TEAMS.map((t,i)=>({id:'crop-'+i,team_id:t.id,duty_date:'2026-11-05',created_at:'2026-11-05T12:00:00Z',teacher_names:['ครูตัวอย่าง คนที่หนึ่ง','ครูตัวอย่าง คนที่สอง'],outcome:'normal',details:'ทดสอบจัดภาพเต็มกรอบ ทั้งภาพแนวตั้ง แนวนอน และภาพจัตุรัส โดยไม่ยืดสัดส่วน',photos:Array.from({length:i+1},(_,j)=>{
 const [w,h]=[[900,1600],[1600,900],[1000,1000]][j%3],full=base+`/storage/v1/object/public/practice-duty-photos/crop-${i}-${j}.jpg`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#c8dfcd"/><rect y="${h*.7}" width="100%" height="${h*.3}" fill="#8bb69a"/><circle cx="${w*.5}" cy="${h*.3}" r="${w*.1}" fill="#e6b988"/><rect x="${w*.35}" y="${h*.4}" width="${w*.3}" height="${h*.5}" rx="50" fill="${t.accent}"/><text x="${w*.5}" y="${h*.95}" text-anchor="middle" font-family="sans-serif" font-size="45">${w} x ${h}</text></svg>`;
 imageData.set(full,'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));return{full,thumbnail:full};
})}));
await fs.mkdir('output/pdf',{recursive:true});
await fs.writeFile('output/pdf/practice-crop-sample.pdf',await createPracticePdf({start:'2026-11-05',end:'2026-11-05',teamIds:PRACTICE_TEAMS.map(t=>t.id)},{reports,imageData,supabaseUrl:base,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}));
console.log('Rendered portrait/landscape/square crops across 1-5-image galleries.');
