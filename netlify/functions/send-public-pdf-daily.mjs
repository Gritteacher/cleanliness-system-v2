import { getBangkokDateISO, getSiteUrl } from './utils/publicPdf.mjs';
import {requireAdminExport,exportAccessResponse} from './utils/adminExportAuth.mjs';

export default async function handler(request) {
  if(process.env.ENABLE_DAILY_EMAIL!=='true')return new Response('Automatic email is disabled',{status:410});
  try{await requireAdminExport(request);}catch(error){return exportAccessResponse(error);}
  try {
    const date = getBangkokDateISO();
    const siteUrl = getSiteUrl();
    const targetUrl = `${siteUrl}/.netlify/functions/send-public-pdf-background`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:request.headers.get('authorization')
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
