const FULL_OPTIONS = { maxSide: 1600, minSide: 1000, maxBytes: 300 * 1024, minQuality: 0.65 };
const THUMB_OPTIONS = { maxSide: 600, minSide: 400, maxBytes: 80 * 1024, minQuality: 0.6 };

async function decodePhoto(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Fall back to the browser's image decoder. */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปภาพไม่ได้ กรุณาเลือกไฟล์ JPEG, PNG หรือ WebP')); };
    image.src = url;
  });
}

function encodeWebP(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') reject(new Error('เบราว์เซอร์นี้ไม่รองรับการบีบอัด WebP กรุณาใช้เบราว์เซอร์เวอร์ชันล่าสุด'));
      else resolve(blob);
    }, 'image/webp', quality);
  });
}

async function compressVariant(image, options) {
  const canvas = document.createElement('canvas');
  let side = Math.min(options.maxSide, Math.max(image.width, image.height));
  const minimumSide = Math.min(side, options.minSide);
  try {
    while (true) {
      const ratio = side / Math.max(image.width, image.height);
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('หน่วยความจำไม่เพียงพอสำหรับประมวลผลรูปภาพ');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob;
      for (let quality = 0.8; ; quality = Math.max(options.minQuality, quality - 0.05)) {
        blob = await encodeWebP(canvas, quality);
        if (blob.size <= options.maxBytes || quality <= options.minQuality) break;
      }
      if (blob.size <= options.maxBytes || side <= minimumSide) return blob;
      side = Math.max(minimumSide, Math.round(side * 0.85));
    }
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function compressSubmissionPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  if (file.size > 10 * 1024 * 1024) throw new Error('รูปภาพต้นฉบับต้องมีขนาดไม่เกิน 10 MB');
  const image = await decodePhoto(file);
  try {
    if (!image.width || !image.height) throw new Error('ไฟล์รูปภาพไม่มีขนาดที่ถูกต้อง');
    const full = await compressVariant(image, FULL_OPTIONS);
    const thumbnail = await compressVariant(image, THUMB_OPTIONS);
    return { full, thumbnail, originalBytes: file.size };
  } finally {
    image.close?.();
  }
}

// Only filenames created by this upload pipeline have a matching thumbnail.
export function photoPreviewUrl(fullUrl) {
  return fullUrl?.replace(/\.full\.webp(?=\?|$)/, '.thumb.webp') || fullUrl;
}
