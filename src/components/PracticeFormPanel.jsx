import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function PracticeFormPanel({ id, color, subtitle, busy, children }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  return <div className="practice-form-panel">
    <button type="button" className="practice-form-toggle" aria-label={`กรอกข้อมูลรายงานเวร ${color}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => setOpen(true)}>
      <Icon name="clipboard" size={18} />
      <span>กรอกข้อมูลรายงานเวร</span>
      <span className="practice-form-toggle-symbol" aria-hidden="true">+</span>
    </button>
    <dialog ref={dialog} id={id} className="practice-form-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-context`} onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }} onClose={() => setOpen(false)}>
      <header className="practice-modal-header"><div><h2 id={`${id}-title`}>รายงานเวร {color}</h2><p id={`${id}-context`}>{subtitle}</p></div><button type="button" autoFocus className="practice-modal-close" aria-label="ปิดฟอร์มกรอกข้อมูล" disabled={busy} onClick={() => setOpen(false)}>×</button></header>
      <div className="practice-modal-body">{children}</div>
    </dialog>
  </div>;
}
