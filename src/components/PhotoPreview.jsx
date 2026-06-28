import { useState } from 'react';

export default function PhotoPreview({ src, thumb, alt = 'รูปภาพพื้นที่', compact = false }) {
  const [open, setOpen] = useState(false);
  const imageSrc = thumb || src;

  if (!imageSrc) {
    return (
      <div className={`photo-empty ${compact ? 'photo-compact' : ''}`}>
        <span>ไม่มีรูป</span>
      </div>
    );
  }

  return (
    <>
      <button
        className={`photo-preview ${compact ? 'photo-compact' : ''}`}
        type="button"
        onClick={() => setOpen(true)}
      >
        <img src={imageSrc} alt={alt} loading="lazy" />
        <span>แตะเพื่อดูรูป</span>
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="photo-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>
              ปิด
            </button>
            <img src={src || thumb} alt={alt} />
          </div>
        </div>
      ) : null}
    </>
  );
}
