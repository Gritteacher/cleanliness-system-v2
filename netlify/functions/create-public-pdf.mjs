import { createPublicScorePdf, getBangkokDateISO, validateSystemLogin } from './utils/publicPdf.mjs';

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

    const pdfBuffer = await createPublicScorePdf({ date });
    const fileName = `public-score-${date}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message || 'สร้าง PDF ไม่สำเร็จ' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
