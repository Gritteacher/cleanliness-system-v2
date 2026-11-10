import fs from 'node:fs/promises';
import {createPracticePdf} from '../netlify/functions/utils/practicePdf.mjs';
import {PRACTICE_TEAMS} from '../src/utils/practiceSchedule.js';
const base='https://example.supabase.co',imageData=new Map(),reports=[];
for(const team of PRACTICE_TEAMS)for(let part=0;part<2;part++){
 const photos=Array.from({length:6},(_,i)=>{const full=base+'/storage/v1/object/public/practice-duty-photos/'+team.id+'-'+part+'-'+i+'.jpg';const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="'+team.soft+'"/><circle cx="450" cy="230" r="100" fill="'+team.accent+'"/><text x="450" y="500" text-anchor="middle" font-size="90">'+(part+1)+' / '+(i+1)+'</text></svg>';imageData.set(full,'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'));return{full};});
 reports.push({id:team.id+part,team_id:team.id,duty_date:'2026-11-05',created_at:'2026-11-05T'+(part?'12':'10')+':00:00Z',teacher_names:Array.from({length:4},(_,i)=>'ครูตัวอย่าง ชุด'+(part+1)+' คนที่'+(i+1)),details:part?'ดูแลนักเรียนเก็บอุปกรณ์และกลับบ้านเรียบร้อย':'ดูแลนักเรียนฝึกซ้อมกิจกรรมอย่างปลอดภัย',outcome:'normal',photos});
}
await fs.mkdir('output/pdf',{recursive:true});
await fs.writeFile('output/pdf/combined-reports.pdf',await createPracticePdf({start:'2026-11-05',end:'2026-11-05',teamIds:PRACTICE_TEAMS.map(t=>t.id)},{reports,imageData,supabaseUrl:base,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}));
