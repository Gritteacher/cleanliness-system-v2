import { createPublicScorePdf, getBangkokDateISO, sendPdfEmail } from './utils/publicPdf.mjs';

export default async function handler() {
  try {
    const date = getBangkokDateISO();
    const pdfBuffer = await createPublicScorePdf({ date });
    const result = await sendPdfEmail({
      pdfBuffer,
      date,
      to: process.env.DAILY_PDF_TO || 'gritsn.th@gmail.com'
    });

    return new Response(JSON.stringify({
      ok: true,
      date,
      result
    }), {
      status: 200,
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
