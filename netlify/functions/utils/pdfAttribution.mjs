import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { APP_ATTRIBUTION, APP_SHORT_NAME_EN } from '../../../shared/appMetadata.mjs';

export async function pdfAttributionFooter(page) {
  const font = (await readFile(resolve('netlify/assets/Sarabun-Regular.ttf'))).toString('base64');
  // Chromium's margin templates cannot inherit document fonts. Render this small
  // Thai footer with the bundled font so it stays readable on every page.
  const image = await page.evaluate(async ({ font, text }) => {
    const face = new FontFace('ExportCredit', `url(data:font/ttf;base64,${font})`);
    document.fonts.add(await face.load());
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 42;
    const context = canvas.getContext('2d');
    context.font = '28px ExportCredit';
    context.fillStyle = '#607466';
    context.fillText(text, 0, 30);
    return canvas.toDataURL('image/png');
  }, { font, text: APP_ATTRIBUTION });
  return `<div style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0 10mm;font:8px sans-serif;color:#7b8a80"><img src="${image}" style="width:466.67px;height:14px" alt="${APP_ATTRIBUTION}"><span>${APP_SHORT_NAME_EN} · <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
}
