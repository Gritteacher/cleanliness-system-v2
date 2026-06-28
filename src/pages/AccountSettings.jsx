import { useEffect, useState } from 'react';
import { updateMyAccount } from '../services/supabaseService.js';

export default function AccountSettings({ user, setUser }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    displayName: user?.displayName || '',
    newPassword: '',
    confirmPassword: '',
    passwordNote: user?.passwordNote || ''
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      username: user?.username || '',
      displayName: user?.displayName || '',
      newPassword: '',
      confirmPassword: '',
      passwordNote: user?.passwordNote || ''
    });
  }, [user?.id]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setMessage('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setBusy(true);
    try {
      const updated = await updateMyAccount(user.id, {
        username: form.username,
        displayName: form.displayName,
        newPassword: form.newPassword,
        passwordNote: form.passwordNote
      });

      const nextUser = {
        ...user,
        username: updated.username,
        displayName: updated.displayName,
        passwordNote: updated.passwordNote
      };

      setUser(nextUser);
      localStorage.setItem('cleanliness_v2_auth', JSON.stringify(nextUser));

      setForm((prev) => ({
        ...prev,
        newPassword: '',
        confirmPassword: '',
        passwordNote: updated.passwordNote || ''
      }));

      setMessage('บันทึกข้อมูลบัญชีเรียบร้อยแล้ว');
    } catch (error) {
      setMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Account</span>
          <h2>บัญชีผู้ใช้ของฉัน</h2>
          <p>เปลี่ยนชื่อผู้ใช้ ชื่อแสดงในระบบ และรหัสผ่าน</p>
        </div>
      </div>

      {message ? (
        <div className={message.includes('ไม่สำเร็จ') || message.includes('ไม่ตรงกัน') ? 'alert danger' : 'alert success'}>
          {message}
        </div>
      ) : null}

      <form className="form-card account-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            ชื่อผู้ใช้
            <input
              value={form.username}
              onChange={(event) => updateField('username', event.target.value)}
              placeholder="เช่น maen"
              required
            />
          </label>

          <label>
            ชื่อที่แสดงในระบบ
            <input
              value={form.displayName}
              onChange={(event) => updateField('displayName', event.target.value)}
              placeholder="เช่น ประธานคณะแม้นนฤมิตร"
              required
            />
          </label>
        </div>

        <div className="info-panel">
          <strong>หมายเหตุ</strong>
          <p>
            หากเปลี่ยนชื่อผู้ใช้ ระบบจะพยายามเปลี่ยนบัญชีเข้าสู่ระบบให้สอดคล้องกับชื่อผู้ใช้ใหม่
            เช่น username จะใช้เข้าสู่ระบบในรูปแบบ username@tsn.local ภายในระบบ
          </p>
        </div>

        <div className="form-grid">
          <label>
            รหัสผ่านใหม่
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField('newPassword', event.target.value)}
              placeholder="เว้นว่างไว้หากไม่เปลี่ยน"
              autoComplete="new-password"
            />
          </label>

          <label>
            ยืนยันรหัสผ่านใหม่
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              autoComplete="new-password"
            />
          </label>
        </div>

        <label>
          รหัสสำรองที่ให้ Admin เห็น
          <input
            value={form.newPassword || form.passwordNote}
            onChange={(event) => updateField('passwordNote', event.target.value)}
            placeholder="ใช้สำหรับให้ Admin เก็บไว้ช่วยเหลือกรณีลืมรหัส"
          />
        </label>

        <div className="alert info">
          เพื่อความปลอดภัย ระบบจะไม่สามารถอ่านรหัสผ่านเดิมย้อนหลังได้ Admin จะเห็นเฉพาะรหัสสำรองที่ผู้ใช้หรือ Admin บันทึกไว้เท่านั้น
        </div>

        <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบัญชี'}
        </button>
      </form>
    </section>
  );
}
