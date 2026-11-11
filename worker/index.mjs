import {launch} from '@cloudflare/playwright';
import {withPdfRuntime} from '../shared/pdfRuntime.mjs';
import practicePdf from '../netlify/functions/create-practice-pdf.mjs';
import publicPdf from '../netlify/functions/create-public-pdf.mjs';
import validatePdfLogin from '../netlify/functions/validate-pdf-login.mjs';
import {createPublicScorePdf,getBangkokDateISO,sendPdfEmail} from '../netlify/functions/utils/publicPdf.mjs';
import regularFont from '../netlify/assets/Sarabun-Regular.ttf';
import mediumFont from '../netlify/assets/Sarabun-Medium.ttf';
import {apiName,errorResponse} from './policy.mjs';
import {APP_VERSION} from '../shared/appMetadata.mjs';

function runtime(env){return{
  env,
  readFont:name=>name==='Sarabun-Medium.ttf'?mediumFont:regularFont,
  launchBrowser:async()=>{
    if(env.FREE_PLAN_CONFIRMED!=='true')throw new Error('ยังไม่ได้ยืนยัน Workers Free จึงยังไม่เปิดการสร้าง PDF');
    try{return await launch(env.BROWSER,{keep_alive:10000});}
    catch(error){throw error;}
  }
};}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
const handlers={'create-practice-pdf':practicePdf,'create-public-pdf':publicPdf,'validate-pdf-login':validatePdfLogin};

export default {
  async fetch(request,env){
    const url=new URL(request.url),name=apiName(url.pathname);
    if(name===null)return env.ASSETS.fetch(request);
    if(name==='health')return json({ok:true,version:APP_VERSION,hosting:'cloudflare-workers',freeOnly:true,pdfEnabled:env.FREE_PLAN_CONFIRMED==='true'});
    // Email jobs are scheduled internally, never callable as an anonymous HTTP
    // endpoint. This prevents the legacy background URL being used for spam.
    if(!handlers[name])return json({message:'Not found'},404);
    if(request.method!=='POST')return json({message:'Method not allowed'},405);
    const origin=request.headers.get('origin');
    if(origin&&origin!==url.origin)return json({message:'Origin not allowed'},403);
    if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_ANON_KEY)return json({message:'ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ'},503);
    if(env.API_LIMITER){const result=await env.API_LIMITER.limit({key:'colorteam:'+(request.headers.get('CF-Connecting-IP')||'unknown')+':'+name});if(!result.success)return json({message:'ส่งคำขอถี่เกินไป กรุณารอสักครู่'},429);}
    try{
      // Bound requests before handing legacy handlers a body, including chunked
      // bodies without content-length. Never log usernames/passwords or tokens.
      if(Number(request.headers.get('content-length'))>4096)return json({message:'ข้อมูลมีขนาดใหญ่เกินไป'},413);
      const reader=request.body?.getReader();let size=0;const chunks=[];
      if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json({message:'ข้อมูลมีขนาดใหญ่เกินไป'},413);}chunks.push(value);}
      const forwarded=new Request(request.url,{method:'POST',headers:request.headers,body:Buffer.concat(chunks)});
      const response=await withPdfRuntime(runtime(env),()=>handlers[name](forwarded));
      if(response.status>=500){const body=await response.clone().json().catch(()=>({}));if(/429|browser time limit|quota/i.test(body.message||''))return errorResponse(new Error(body.message));}
      return response;
    }catch(error){return errorResponse(error);}
  },
  async scheduled(_event,env,ctx){
    if(env.ENABLE_DAILY_EMAIL!=='true')return;
    ctx.waitUntil(withPdfRuntime(runtime(env),async()=>{
      const date=getBangkokDateISO();
      const pdfBuffer=await createPublicScorePdf({date});
      await sendPdfEmail({pdfBuffer,date,to:env.DAILY_PDF_TO});
    }));
  }
};
