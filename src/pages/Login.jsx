import { useState } from 'react';
import { login } from '../utils/auth.js';

const LOGO_URL = 'https://www.tsn.ac.th/web/wp-content/uploads/2013/12/Logo_Blue-700x639.png';

export default function Login({ onLogin, navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(username, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onLogin(result.user);
      navigate(result.user.role === 'ADMIN' ? '/admin-summary' : '/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-card login-card-wide">
        <div className="login-copy">
          <div className="login-brand-row">
            <img src={LOGO_URL} alt="โรงเรียนเทพศิรินทร์ นนทบุรี" />
            <div>
              <span className="eyebrow">Cleanliness System V2</span>
              <h2>ระบบตรวจความสะอาดคณะสี</h2>
            </div>
          </div>
          <p>
            ประเมินพื้นที่รับผิดชอบของแต่ละห้องเรียน
            สำหรับประธานคณะสีและผู้ดูแลระบบ
          </p>
          <div className="login-note">
            <strong>บุคคลทั่วไป</strong>
            <span>สามารถกลับไปดูคะแนนสาธารณะได้โดยไม่ต้องเข้าสู่ระบบ</span>
          </div>
        </div>

        <form className="login-form-panel" onSubmit={handleSubmit}>
          <h3>เข้าสู่ระบบ</h3>
          <p>สำหรับประธานคณะสีและ Admin</p>

          {error ? <div className="alert danger">{error}</div> : null}

          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="กรอกชื่อผู้ใช้" autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน" autoComplete="current-password" />
          </label>

          <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
          <button className="btn btn-ghost btn-wide" type="button" onClick={() => navigate('/')}>
            กลับไปหน้าดูคะแนนสาธารณะ
          </button>
        </form>
      </div>
    </section>
  );
}
