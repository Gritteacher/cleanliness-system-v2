import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { login } from '../../utils/auth.js';

export default function LoginPage({ onLogin, navigate }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const result = await login(form.username, form.password);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    onLogin(result.user);
  }

  return (
    <div className="auth-layout">
      <section className="auth-message">
        <span className="eyebrow light">Clean & Care Workspace</span>
        <h1>ดูแลพื้นที่<br />ด้วยข้อมูลที่ชัดเจน</h1>
        <p>สำหรับประธานคณะและผู้ดูแลระบบ บันทึกการทำเวร ประเมินความสะอาด และติดตามความครบถ้วนในที่เดียว</p>
        <div className="auth-points"><span><Icon name="check" /> ข้อมูลแยกตามสิทธิ์</span><span><Icon name="check" /> รูปภาพจัดเก็บแบบ private</span><span><Icon name="check" /> มีประวัติการแก้ไข</span></div>
      </section>
      <section className="auth-card-wrap">
        <form className="auth-card" onSubmit={submit}>
          <button className="back-link" type="button" onClick={() => navigate('/')}><span>←</span> กลับหน้าผลคะแนน</button>
          <span className="brand-mark large"><Icon name="sparkle" size={28} /></span>
          <h2>ยินดีต้อนรับ</h2><p>เข้าสู่ระบบด้วยบัญชีที่โรงเรียนกำหนด</p>
          <label>ชื่อผู้ใช้<input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="เช่น maen" required /></label>
          <label>รหัสผ่าน<input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••" required /></label>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่พื้นที่ทำงาน'} <Icon name="arrow" /></button>
          <small className="privacy-note">หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</small>
        </form>
      </section>
    </div>
  );
}
