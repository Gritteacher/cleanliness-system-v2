import { getBangkokDateISO, getSiteUrl } from './utils/publicPdf.mjs';
import {requireAdminExport,exportAccessResponse} from './utils/adminExportAuth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try{await requireAdminExport(request);}catch(error){return exportAccessResponse(error);}
  try {
    const body = await request.json();
    const date = body.date || getBangkokDateISO();

    const siteUrl = getSiteUrl();
    const printUrl = new URL(siteUrl);
    printUrl.searchParams.set('pdf', '1');
    printUrl.searchParams.set('date', date);
    printUrl.searchParams.set('autoprint', '1');
    printUrl.hash='/cleanliness';

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
