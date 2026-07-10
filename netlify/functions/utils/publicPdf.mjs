import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';

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
  const raw = process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  if (!raw) {
    throw new Error('ยังไม่ได้ตั้งค่า PUBLIC_SITE_URL');
  }

  return raw.replace(/\/+$/g, '');
}

export async function validateSystemLogin(username, password) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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

export async function createPublicScorePdf({ date = getBangkokDateISO() } = {}) {
  const siteUrl = getSiteUrl();
  const targetUrl = new URL(siteUrl);
  targetUrl.searchParams.set('pdf', '1');
  targetUrl.searchParams.set('date', date);

  let browser;

  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      // Playwright expects headless to be boolean.
      // @sparticuz/chromium may expose a string value, so force true.
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1366,
        height: 1800
      }
    });

    await page.goto(targetUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await page.waitForSelector('.public-page', {
      timeout: 60000
    });

    // รอให้ข้อมูลและรูปภาพที่โหลดแบบ async แสดงผลก่อนสร้าง PDF
    await page.waitForTimeout(3500);

    await page.addStyleTag({
      content: `
        @page {
          size: A4;
          margin: 10mm;
        }

        .print-hide,
        .side-nav,
        .app-footer,
        .header-actions,
        .public-pdf-actions,
        .modal-backdrop {
          display: none !important;
        }

        .app {
          padding-bottom: 0 !important;
        }

        .app-header {
          position: static !important;
        }

        .page-shell {
          width: 100% !important;
          margin: 0 auto !important;
        }

        .room-card-grid,
        .team-card-grid,
        .stat-grid {
          break-inside: avoid;
        }

        .mobile-card,
        .team-score-card,
        .stat-card,
        .hero-card {
          break-inside: avoid;
        }
      `
    });

    await page.emulateMedia({ media: 'print' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '8mm',
        bottom: '10mm',
        left: '8mm'
      }
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function sendPdfEmail({ pdfBuffer, date, to }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า RESEND_API_KEY');
  }

  const from = process.env.MAIL_FROM || 'ระบบตรวจความสะอาด <onboarding@resend.dev>';
  const recipient = to || process.env.DAILY_PDF_TO || 'gritsn.th@gmail.com';
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
