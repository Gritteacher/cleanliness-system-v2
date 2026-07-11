import { getBangkokDateISO, getSiteUrl, validateSystemLogin } from './utils/publicPdf.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const date = body.date || getBangkokDateISO();

    if (!username || !password) {
      return new Response(JSON.stringify({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    await validateSystemLogin(username, password);

    const siteUrl = getSiteUrl();
    const printUrl = new URL(siteUrl);
    printUrl.searchParams.set('pdf', '1');
    printUrl.searchParams.set('date', date);
    printUrl.searchParams.set('autoprint', '1');

    return new Response(JSON.stringify({
      ok: true,
      printUrl: printUrl.toString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message || 'ยืนยันตัวตนไม่สำเร็จ' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
