import { createClient } from '@supabase/supabase-js';
import { launchPdfBrowser, pdfEnvironment, readPdfFont } from '../../../shared/pdfRuntime.mjs';
import { cleanlinessDate, cleanlinessDailyHtml, fitCleanlinessSheet, prepareCleanlinessImages } from '../../../shared/cleanlinessDailyLayout.mjs';
import {loadCleanlinessImages} from './cleanlinessPdfImages.mjs';
import {cleanlinessPdfFilename,cleanlinessPdfDisposition} from '../../../shared/cleanlinessPdfFilename.mjs';

const USERNAME_EMAIL_DOMAIN = 'tsn.local';

export function getBangkokDateISO() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(new Date());
}

export function usernameToEmail(username) {
  const clean = String(username || '').trim();
  if (clean.includes('@')) return clean;
  return `${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

export function getSiteUrl() {
  const raw = pdfEnvironment().PUBLIC_SITE_URL || pdfEnvironment().URL || pdfEnvironment().DEPLOY_PRIME_URL || '';
  if (!raw) {
    throw new Error('ยังไม่ได้ตั้งค่า PUBLIC_SITE_URL');
  }

  return raw.replace(/\/+$/g, '');
}

export async function validateSystemLogin(username, password) {
  const supabaseUrl = pdfEnvironment().VITE_SUPABASE_URL || pdfEnvironment().SUPABASE_URL;
  const supabaseAnonKey = pdfEnvironment().VITE_SUPABASE_ANON_KEY || pdfEnvironment().SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });

  if (error || !data?.user) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  await client.auth.signOut();
  return data.user;
}

export async function createPublicScorePdf({ date = getBangkokDateISO(), returnMetadata = false } = {}, test = {}) {
  cleanlinessDate(date);
  const env=pdfEnvironment();
  const supabaseUrl=test.supabaseUrl||env.VITE_SUPABASE_URL||env.SUPABASE_URL;
  let overview=test.overview;
  if(!overview){
    const url=env.VITE_SUPABASE_URL||env.SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
    if(!url||!key)throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ');
    // Exactly the same public, RLS-protected RPC as the public scoreboard.
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.rpc('cs_public_live_overview',{p_date:date}).abortSignal(AbortSignal.timeout(10000));
    if(error)throw new Error('โหลดคะแนนไม่สำเร็จ กรุณาลองอีกครั้ง');
    overview=data||{};
  }
  const [regular,medium,imageData]=await Promise.all([readPdfFont('Sarabun-Regular.ttf'),readPdfFont('Sarabun-Medium.ttf'),test.imageData||loadCleanlinessImages(overview,supabaseUrl)]);
  const html=cleanlinessDailyHtml({date,overview,supabaseUrl,imageData,regularFont:regular.toString('base64'),mediumFont:medium.toString('base64')});
  let browser;
  try {
    browser=await launchPdfBrowser(test);
    const page=await browser.newPage({viewport:{width:794,height:1123},javaScriptEnabled:false});
    await page.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
    await page.setContent(html,{waitUntil:'load',timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('.clean-sheet').evaluate(prepareCleanlinessImages);
    await page.emulateMedia({media:'print'});
    const fits=await page.locator('.clean-sheet').evaluate(fitCleanlinessSheet);
    if(!fits)throw new Error('รายละเอียดมีมากเกินหนึ่งหน้า กรุณาย่อหมายเหตุในรายงานก่อนส่งออก');
    await page.evaluate(async()=>{
      // Export-only cover crops at up to 300 DPI; keep original uploads intact.
      for(const image of document.querySelectorAll('img.clean-photo')){
        const box=image.getBoundingClientRect(),width=Math.min(image.naturalWidth,image.naturalHeight*box.width/box.height),height=width*box.height/box.width;
        const ratio=Math.min(1,box.width*3.125/width),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
        const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,(image.naturalWidth-width)*.5,(image.naturalHeight-height)*(image.naturalHeight>=image.naturalWidth?.3:.5),width,height,0,0,canvas.width,canvas.height);
        image.src=canvas.toDataURL('image/jpeg',.92);await image.decode();
      }
    });
    const pdfBuffer=Buffer.from(await page.pdf({format:'A4',landscape:false,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,timeout:20000}));
    return returnMetadata?{pdfBuffer,fileName:cleanlinessPdfFilename(date,overview.scheduledTeam),contentDisposition:cleanlinessPdfDisposition(date,overview.scheduledTeam)}:pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function sendPdfEmail({ pdfBuffer, date, to }) {
  const apiKey = pdfEnvironment().RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า RESEND_API_KEY');
  }

  const from = pdfEnvironment().MAIL_FROM || 'ระบบตรวจความสะอาด <onboarding@resend.dev>';
  const recipient = to || pdfEnvironment().DAILY_PDF_TO || 'gritsn.th@gmail.com';
  const fileName = `public-score-${date}.pdf`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `สรุปคะแนนความสะอาดคณะสี ประจำวันที่ ${date}`,
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
          <h2>สรุปคะแนนความสะอาดคณะสี</h2>
          <p>แนบไฟล์ PDF สรุปข้อมูลหน้าสาธารณะประจำวันที่ ${date}</p>
          <p>ระบบส่งอัตโนมัติ เวลา 09:00 น. ตามเวลาประเทศไทย</p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer.toString('base64')
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ส่งอีเมลไม่สำเร็จ: ${detail}`);
  }

  return response.json();
}
