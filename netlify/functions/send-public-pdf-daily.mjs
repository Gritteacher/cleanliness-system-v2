import { getBangkokDateISO, getSiteUrl } from './utils/publicPdf.mjs';

export default async function handler() {
  try {
    const date = getBangkokDateISO();
    const siteUrl = getSiteUrl();
    const targetUrl = `${siteUrl}/.netlify/functions/send-public-pdf-background`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date,
        source: 'scheduled-function'
      })
    });

    return new Response(JSON.stringify({
      ok: response.ok,
      status: response.status,
      date,
      message: response.ok
        ? 'เริ่มงานส่ง PDF ใน background แล้ว'
        : 'เรียก background function ไม่สำเร็จ'
    }), {
      status: response.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

export const config = {
  schedule: '0 2 * * *'
};
