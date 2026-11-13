import { createPublicScorePdf, getBangkokDateISO } from './utils/publicPdf.mjs';
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

    const {pdfBuffer,contentDisposition} = await createPublicScorePdf({ date, returnMetadata:true });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
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
