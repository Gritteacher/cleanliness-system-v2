import { useState } from 'react';
import Icon from './Icon.jsx';

export default function PracticeFormPanel({ id, color, busy, children }) {
  const [open, setOpen] = useState(false);
  return <div className="practice-form-panel">
    <button type="button" className="practice-form-toggle" aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => setOpen(value => !value)}>
      <Icon name="clipboard" size={18} />
      <span>{open ? 'ยุบฟอร์มกรอกข้อมูล' : 'กรอกข้อมูลรายงานเวร'}<small>{color}</small></span>
      <span className="practice-form-toggle-symbol" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <div id={id} hidden={!open}>{children}</div>
  </div>;
}
