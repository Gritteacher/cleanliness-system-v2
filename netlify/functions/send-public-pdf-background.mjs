import { createPublicScorePdf, getBangkokDateISO, sendPdfEmail } from './utils/publicPdf.mjs';

export default async function handler(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const date = body.date || getBangkokDateISO();
    console.log(`[PDF background] start creating PDF for ${date}`);

    const pdfBuffer = await createPublicScorePdf({ date });
    console.log(`[PDF background] PDF created, size ${pdfBuffer.length} bytes`);

    const result = await sendPdfEmail({
      pdfBuffer,
      date,
      to: process.env.DAILY_PDF_TO || 'gritsn.th@gmail.com'
    });

    console.log(`[PDF background] email sent for ${date}`);

    return new Response(JSON.stringify({
      ok: true,
      date,
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    console.error('[PDF background] failed:', error);
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
  background: true
};
