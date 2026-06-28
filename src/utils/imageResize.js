export function resizeImage(file, options = {}) {
  const maxSize = options.maxSize || 1280;
  const quality = options.quality || 0.78;
  const mimeType = options.mimeType || 'image/jpeg';

  return new Promise((resolve, reject) => {
    if (!file) {
      resolve({ image: '', thumb: '' });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const image = canvas.toDataURL(mimeType, quality);

        const thumbCanvas = document.createElement('canvas');
        const thumbWidth = 420;
        const thumbHeight = 280;
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d');

        const sourceRatio = img.width / img.height;
        const thumbRatio = thumbWidth / thumbHeight;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (sourceRatio > thumbRatio) {
          sw = img.height * thumbRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / thumbRatio;
          sy = (img.height - sh) / 2;
        }

        thumbCtx.drawImage(img, sx, sy, sw, sh, 0, 0, thumbWidth, thumbHeight);
        const thumb = thumbCanvas.toDataURL(mimeType, 0.7);

        resolve({ image, thumb });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
