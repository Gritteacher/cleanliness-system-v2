import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createPublicScorePdf} from '../netlify/functions/utils/publicPdf.mjs';
import {loadCleanlinessImages} from '../netlify/functions/utils/cleanlinessPdfImages.mjs';
import {cleanlinessPdfFilename} from '../shared/cleanlinessPdfFilename.mjs';
const executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const date=process.argv.find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v))||'2026-11-02';
async function save(name,overview,options={}){
 const file=`output/pdf/${name}.pdf`;
 const result=await createPublicScorePdf({date,returnMetadata:true},{overview,executablePath,...options});
 assert.equal(result.fileName,cleanlinessPdfFilename(date,overview.scheduledTeam));
 assert.equal(decodeURIComponent(result.contentDisposition.split("filename*=UTF-8''")[1]),result.fileName);
 await fs.writeFile(file,result.pdfBuffer);
 const info=execFileSync('pdfinfo',[file],{encoding:'utf8'});
 assert.match(info,/Pages:\s+1\b/);assert.match(info,/Page size:.*A4/);
 console.log(name+': one A4 page verified');
}
const fixture=count=>({scheduledTeam:{name:'คณะภาณุรังษี',color_name:'สีแดง'},score:{cleanliness_score:9.86,attendance_score:9.58},rooms:Array.from({length:count},(_,i)=>({room_label:`${Math.floor(i/6)+1}/${i%6+1}`,area_name:['รอบเรือนรำเพย','ลานอเนกประสงค์ อาคารเรียน','บริเวณสนามกีฬาและทางเดิน'][i%3],duty_status:i===4?'activity':i===7?'absent':'present',student_count:i===7?0:24,cleanliness_score:i===4||i===7?null:9.85,attendance_score:i===4?null:i===7?0:10,reason_summary:i===2?'เก็บขยะและจัดอุปกรณ์ได้เรียบร้อย':null,note:i===4?'ร่วมกิจกรรมของโรงเรียน':null}))});
await fs.mkdir('output/pdf',{recursive:true});
if(process.argv.includes('--live')){
 // Read only the already-public client settings from the local production build.
 const files=(await fs.readdir('dist/assets')).filter(f=>/^index-.*\.js$/.test(f));
 const source=(await Promise.all(files.map(f=>fs.readFile('dist/assets/'+f,'utf8')))).join('\n');
 const url=source.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0];
 const keys=source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[];
 const key=keys.find(k=>{try{return JSON.parse(Buffer.from(k.split('.')[1],'base64url')).role==='anon';}catch{return false;}});
 if(!url||!key)throw new Error('Build with public Supabase settings first');
 const {data,error}=await createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).rpc('cs_public_live_overview',{p_date:date});
 if(error)throw new Error('Read-only overview query failed');
 console.log(JSON.stringify({date,areas:data?.rooms?.length||0,maxNote:Math.max(0,...(data?.rooms||[]).map(r=>(r.reason_summary||'').length+(r.note||'').length))}));
 const imageData=await loadCleanlinessImages(data||{},url);
 console.log(JSON.stringify({imagesLoaded:imageData.size}));
 await save('cleanliness-daily',data||{},{supabaseUrl:url,imageData});
 console.log(JSON.stringify({live:true,date,areas:data?.rooms?.length||0,file:'output/pdf/cleanliness-daily.pdf'}));
}else{
 for(const [name,overview] of [['standard',fixture(12)],['dense',fixture(25)],['no-duty',{}]]){
  await save('cleanliness-'+name,overview);
 }
}
