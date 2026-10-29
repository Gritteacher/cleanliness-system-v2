export async function isHeicPhoto(file) {
  if (/^image\/hei[cf](?:-sequence)?$/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '')) return true;
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const text = (from, to) => String.fromCharCode(...header.slice(from, to));
  if (text(4, 8) !== 'ftyp' || ['avif', 'avis'].includes(text(8, 12))) return false;
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(text(8, 12));
}

async function decodeNative(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Safari may support a format through Image instead. */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปภาพไม่ได้ กรุณาเลือกไฟล์ JPEG, PNG, WebP หรือ HEIC/HEIF')); };
    image.src = url;
  });
}

export async function decodeUploadPhoto(file) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('รูปภาพต้นฉบับต้องมีขนาดไม่เกิน 10 MB');
  const heic = await isHeicPhoto(file);
  if (!heic && !file.type?.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  let image;
  try { image = await decodeNative(file); }
  catch (error) {
    if (!heic) throw error;
    try {
      // Lazy CSP decoder runs locally in a worker; never sends originals elsewhere.
      const { heicTo } = await import('heic-to/csp');
      image = await heicTo({ blob: file, type: 'bitmap' });
    } catch { throw new Error('แปลง HEIC/HEIF ไม่สำเร็จ กรุณาลองเลือกรูปใหม่ หรือส่งออกจากเครื่องเป็น JPG'); }
  }
  if (!image.width || !image.height) { image.close?.(); throw new Error('ไฟล์รูปภาพไม่มีขนาดที่ถูกต้อง'); }
  return { image, mimeType: heic ? 'image/jpeg' : 'image/webp' };
}

export function photoExtension(blob) { return blob.type === 'image/jpeg' ? 'jpg' : 'webp'; }
