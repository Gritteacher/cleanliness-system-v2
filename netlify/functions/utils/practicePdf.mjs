import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';
import { practicePdfOptions } from '../../../src/utils/practicePdfOptions.js';
import { practicePdfHtml, safePracticePhoto } from './practicePdfLayout.mjs';
import { pdfAttributionFooter } from './pdfAttribution.mjs';

export async function loadPublishedPracticeReports(client, options) {
  const result = [];
  for (let offset=0; ; offset+=500) {
    const { data, error } = await client.from('cs_practice_reports').select('id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,photos,created_at').eq('status','published').is('deleted_at',null).gte('duty_date',options.start).lte('duty_date',options.end).in('team_id',options.teamIds).order('duty_date').order('created_at',{ascending:false}).order('id').range(offset,offset+499).abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error('โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง');
    result.push(...data);
    if (result.length>2000) throw new Error('มีรายงานจำนวนมาก กรุณาเลือกช่วงวันที่สั้นลง');
    if (data.length<500) return result;
  }
}

async function imageDataForReports(reports, options, supabaseUrl) {
  // Only one cover per selected team/day, never fetch arbitrary user URLs.
  const covers = new Map();
  for (const report of [...reports].sort((a,b)=>b.created_at.localeCompare(a.created_at))) {
    const key=`${report.duty_date}-${report.team_id}`;
    if(!covers.has(key)) covers.set(key,report.photos?.[0]?.thumbnail);
  }
  const sources=[...new Set([...covers.values()].filter(Boolean))], result=new Map();
  let next=0;const deadline=AbortSignal.timeout(12000);
  await Promise.all(Array.from({length:Math.min(6,sources.length)},async()=>{
    while(next<sources.length&&!deadline.aborted){
      const source=sources[next++], url=safePracticePhoto(source,supabaseUrl);
      if(!url)continue;
      try {
        const response=await fetch(url,{redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(6000)])});
        if(!response.ok || Number(response.headers.get('content-length'))>131072)continue;
        const reader=response.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();throw new Error('Image too large');}chunks.push(value);}
        const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c)));
        const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
        if(mime)result.set(source,`data:${mime};base64,${bytes.toString('base64')}`);
      }catch{/* Keep report text and label an unavailable image instead of dropping data. */}
    }
  }));
  return result;
}

export async function createPracticePdf(input, test = {}) {
  const options=practicePdfOptions(input);
  const supabaseUrl=test.supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon=process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if(!supabaseUrl || (!anon&&!test.reports))throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ');
  // Use public RLS, never a service role or a user's session.
  const reports=test.reports || await loadPublishedPracticeReports(createClient(supabaseUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}}),options);
  const [regular,medium,imageData]=await Promise.all([
    readFile(resolve('netlify/assets/Sarabun-Regular.ttf')),
    readFile(resolve('netlify/assets/Sarabun-Medium.ttf')),
    test.imageData || imageDataForReports(reports,options,supabaseUrl)
  ]);
  const html=practicePdfHtml({options,reports,imageData,supabaseUrl,regularFont:regular.toString('base64'),mediumFont:medium.toString('base64')});
  let browser;
  try {
    browser=await playwrightChromium.launch({executablePath:test.executablePath || await chromium.executablePath(),args:test.executablePath?[]:chromium.args,headless:true});
    const page=await browser.newPage({viewport:{width:794,height:1123},javaScriptEnabled:false});
    await page.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
    await page.setContent(html,{waitUntil:'load',timeout:20000});
    await page.evaluate(async()=>{
      await document.fonts.ready;
      for(const image of document.images){
        try{
          await image.decode();
          // Keep month-long exports small while preserving vector Thai text.
          const canvas=document.createElement('canvas');
          let side=Math.min(400,Math.max(image.naturalWidth,image.naturalHeight)),result;
          do{
            const ratio=side/Math.max(image.naturalWidth,image.naturalHeight);
            canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);
            const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#f1f4ec';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
            result=canvas.toDataURL('image/jpeg',.65);side=Math.round(side*.8);
          }while(result.length>32000&&side>=180);
          image.src=result;await image.decode();canvas.width=1;canvas.height=1;
        }catch{
          const placeholder=document.createElement('div');placeholder.className='no-image';placeholder.textContent='ไม่สามารถโหลดภาพได้';image.replaceWith(placeholder);
        }
      }
    });
    await page.emulateMedia({media:'print'});
    // Fail visibly instead of producing clipped or unreadable summaries.
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('.team-card')].some(card=>{const body=card.querySelector('.card-body');return body.scrollHeight>body.clientHeight+2 || body.getBoundingClientRect().bottom>card.getBoundingClientRect().bottom+1;}));
    if(overflow)throw new Error('รายละเอียดรายงานยาวเกินการจัดหน้า กรุณาส่งออกเฉพาะสีที่ต้องการ');
    const footerTemplate=await pdfAttributionFooter(page);
    const pdf=Buffer.from(await page.pdf({format:'A4',landscape:false,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate,timeout:20000}));
    if(pdf.length>4400000)throw new Error('ไฟล์ PDF มีขนาดใหญ่ กรุณาเลือกช่วงวันที่สั้นลง');
    return pdf;
  }finally{await browser?.close();}
}
