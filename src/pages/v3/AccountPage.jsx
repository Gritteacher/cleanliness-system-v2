import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { updateMyDisplayName } from '../../services/v3Service.js';

export default function AccountPage({ user, onUpdated, onLogout }) {
  const [name, setName] = useState(user.displayName);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await updateMyDisplayName(name); await onUpdated(); setMessage('บันทึกชื่อที่แสดงแล้ว'); }
    catch (error) { setMessage(error.message); }
    setBusy(false);
  }
  return <div className="page-container account-page"><section className="account-card"><span className="avatar avatar-large">{user.displayName?.slice(0, 1)}</span><div className="account-heading"><h1>{user.displayName}</h1><p>@{user.username} · {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.team?.name}</p></div><form onSubmit={submit}><label>ชื่อที่แสดง<input value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="120" required /></label>{message ? <div className="notice-inline">{message}</div> : null}<button className="button button-primary" disabled={busy}>บันทึกการเปลี่ยนแปลง</button></form><button className="button button-danger button-wide" type="button" onClick={onLogout}><Icon name="logout" /> ออกจากระบบ</button></section></div>;
}
