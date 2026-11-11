import { createClient } from '@supabase/supabase-js';
import { readPdfFont, launchPdfBrowser, pdfEnvironment } from '../../../shared/pdfRuntime.mjs';
import { practicePdfOptions } from '../../../src/utils/practicePdfOptions.js';
import { practicePdfHtml, safePracticePhoto, combinedPracticeReports } from './practicePdfLayout.mjs';
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

export async function imageDataForReports(reports, options, supabaseUrl) {
  // Fetch all selected photos, preferring full-resolution files. Keep the same
  // allowlist, bounded reads and timeouts; no privileged storage credentials.
  const sources=combinedPracticeReports(reports,options).flatMap(r=>(r.photos||[]));
  if(sources.length>180)throw new Error('มีภาพจำนวนมาก กรุณาเลือกช่วงวันที่สั้นลงเพื่อส่งออกภาพคมชัด');
  const result=new Map();
  let next=0;const deadline=AbortSignal.timeout(12000);
  await Promise.all(Array.from({length:Math.min(6,sources.length)},async()=>{
    while(next<sources.length&&!deadline.aborted){
      const photo=sources[next++];
      for(const source of [...new Set([photo.full,photo.thumbnail].filter(Boolean))]) {
        const url=safePracticePhoto(source,supabaseUrl);if(!url)continue;
        try {
        // Workers does not support redirect:"error". Manual mode plus the
        // non-2xx check below rejects redirects without ever following them.
        const response=await fetch(url,{redirect:'manual',signal:AbortSignal.any([deadline,AbortSignal.timeout(6000)])});
        if(!response.ok || Number(response.headers.get('content-length'))>524288)continue;
        const reader=response.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288){await reader.cancel();throw new Error('Image too large');}chunks.push(value);}
        const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c)));
        const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
        if(mime){result.set(source,`data:${mime};base64,${bytes.toString('base64')}`);break;}
      }catch{/* Keep report text and label an unavailable image instead of dropping data. */}
      }
    }
  }));
  return result;
}

export async function createPracticePdf(input, test = {}) {
  const options=practicePdfOptions(input);
  const env=pdfEnvironment();
  const supabaseUrl=test.supabaseUrl || env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anon=env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if(!supabaseUrl || (!anon&&!test.reports))throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ');
  // Use public RLS, never a service role or a user's session.
  const reports=test.reports || await loadPublishedPracticeReports(createClient(supabaseUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}}),options);
  const [regular,medium,imageData]=await Promise.all([
    readPdfFont('Sarabun-Regular.ttf'),
    readPdfFont('Sarabun-Medium.ttf'),
    test.imageData || imageDataForReports(reports,options,supabaseUrl)
  ]);
  const html=practicePdfHtml({options,reports,imageData,supabaseUrl,regularFont:regular.toString('base64'),mediumFont:medium.toString('base64')});
  let browser;
  try {
    browser=await launchPdfBrowser(test);
    const page=await browser.newPage({viewport:{width:794,height:1123},javaScriptEnabled:false});
    await page.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
    await page.setContent(html,{waitUntil:'load',timeout:20000});
    await page.evaluate(async()=>{
      await document.fonts.ready;
      for(const image of document.images){
        try{
          await image.decode();
          // Bias portrait crops slightly upward to leave headroom. This is an
          // orientation heuristic, not face detection; originals stay intact.
          image.dataset.orientation=image.naturalHeight>=image.naturalWidth?'portrait':'landscape';
          // Match printed size at 300 DPI, never upscale or globally shrink to
          // tiny thumbnails. Text remains vector in PDF.
          const canvas=document.createElement('canvas');
          const box=image.getBoundingClientRect();
          // Bake the cover crop into the export-only JPEG. Leaving oversized
          // images clipped by CSS can make Chromium rasterize huge PDF images.
          const cropWidth=Math.min(image.naturalWidth,image.naturalHeight*box.width/box.height);
          const cropHeight=cropWidth*box.height/box.width;
          const x=(image.naturalWidth-cropWidth)*.5;
          const y=(image.naturalHeight-cropHeight)*(image.dataset.orientation==='portrait'?.3:.5);
          const ratio=Math.min(1,box.width*3.125/cropWidth,box.height*3.125/cropHeight);
          canvas.width=Math.max(1,Math.round(cropWidth*ratio));canvas.height=Math.max(1,Math.round(cropHeight*ratio));
          const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#f1f4ec';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,x,y,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
          image.src=canvas.toDataURL('image/jpeg',.9);await image.decode();canvas.width=1;canvas.height=1;
        }catch{
          const placeholder=document.createElement('div');placeholder.className='no-image';placeholder.textContent='ไม่สามารถโหลดภาพได้';image.replaceWith(placeholder);
        }
      }
    });
    await page.emulateMedia({media:'print'});
    await page.evaluate(()=>{
      for(const body of document.querySelectorAll('.card-body')){
        for(let size=9;size>=8;size-=.25){body.style.setProperty('--body-size',size+'pt');if(body.scrollHeight<=body.clientHeight+1)break;}
      }
    });
    // Fail visibly instead of producing clipped or unreadable summaries.
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('.team-card')].some(card=>{const body=card.querySelector('.card-body');return body.scrollHeight>body.clientHeight+2 || body.getBoundingClientRect().bottom>card.getBoundingClientRect().bottom+1;}));
    if(overflow)throw new Error('รายละเอียดรายงานยาวเกินการจัดหน้า กรุณาส่งออกเฉพาะสีที่ต้องการ');
    const footerTemplate=await pdfAttributionFooter(page);
    const pdf=Buffer.from(await page.pdf({format:'A4',landscape:false,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate,timeout:20000}));
    if(pdf.length>4400000)throw new Error('ไฟล์ PDF มีขนาดใหญ่ กรุณาเลือกช่วงวันที่สั้นลง');
    return pdf;
  }finally{await browser?.close();}
}
