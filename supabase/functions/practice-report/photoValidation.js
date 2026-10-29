// Verify the declared MIME against file signatures, never trust filename alone.
export function validatedPhotoType(bytes, mime) {
  if (mime === 'image/jpeg' && bytes.length >= 20 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return { contentType: 'image/jpeg', extension: 'jpg' };
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (mime === 'image/webp' && bytes.length >= 20 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP' && ['VP8 ','VP8L','VP8X'].includes(ascii(12,16))) return { contentType: 'image/webp', extension: 'webp' };
  throw new Error('ไฟล์ไม่ใช่ภาพ JPG หรือ WebP ที่รองรับ');
}
