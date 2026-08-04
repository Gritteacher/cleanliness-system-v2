import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { loadAdminAccounts, subscribeLiveUpdates } from '../../services/v3Service.js';

function dateTime(value) {
  if (!value) return 'ยังไม่มีข้อมูล';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok'
  }).format(new Date(value));
}

export default function AdminAccountsPage({ navigate }) {
  const [accounts, setAccounts] = useState([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    try { setError(''); setAccounts(await loadAdminAccounts()); }
    catch (loadError) { setError(loadError.message); }
    setLoading(false);
  }

  useEffect(() => { refresh(); return subscribeLiveUpdates(() => refresh()); }, []);

  const teams = useMemo(() => [...new Map(accounts.filter((row) => row.team_id).map((row) => [row.team_id, row.team_name])).entries()], [accounts]);
  const filtered = useMemo(() => accounts.filter((account) => {
    const text = `${account.username} ${account.display_name} ${account.team_name || ''}`.toLowerCase();
    return (!query || text.includes(query.trim().toLowerCase()))
      && (role === 'all' || account.role === role)
      && (teamId === 'all' || account.team_id === teamId)
      && (status === 'all' || String(account.active) === status);
  }), [accounts, query, role, status, teamId]);
  const selected = accounts.find((account) => account.id === selectedId) || filtered[0] || null;

  return <div className="page-container accounts-page">
    <section className="workspace-heading">
      <div><span className="eyebrow">Admin Accounts</span><h1>ข้อมูลบัญชีผู้ใช้งาน</h1><p>ตรวจสอบสิทธิ์ การเข้าสู่ระบบ และปริมาณการใช้งานของแต่ละบัญชี</p></div>
      <button className="button button-secondary" type="button" onClick={() => navigate('/admin')}><Icon name="shield" /> จัดการระบบ</button>
    </section>

    <section className="account-filter-panel">
      <label className="account-search">ค้นหาบัญชี<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อ, Username หรือคณะสี" /></label>
      <label>บทบาท<select value={role} onChange={(event) => setRole(event.target.value)}><option value="all">ทั้งหมด</option><option value="admin">Admin</option><option value="president">ประธานคณะ</option></select></label>
      <label>คณะสี<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="all">ทั้งหมด</option>{teams.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
      <label>สถานะ<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">ทั้งหมด</option><option value="true">ใช้งาน</option><option value="false">ปิดใช้งาน</option></select></label>
    </section>

    {error ? <div className="form-error">{error}</div> : null}
    {loading ? <div className="loading-panel">กำลังโหลดข้อมูลบัญชี…</div> : <div className="accounts-layout">
      <section className="accounts-table-card">
        <div className="accounts-table-head"><strong>บัญชีทั้งหมด</strong><span>{filtered.length} บัญชี</span></div>
        <div className="accounts-table-scroll"><table className="accounts-table"><thead><tr><th>บัญชี</th><th>บทบาท</th><th>เข้าสู่ระบบล่าสุด</th><th>สถานะ</th></tr></thead><tbody>
          {filtered.map((account) => <tr className={selected?.id === account.id ? 'selected' : ''} key={account.id} onClick={() => setSelectedId(account.id)}>
            <td><strong>{account.display_name}</strong><small>@{account.username}{account.team_name ? ` · ${account.team_name}` : ''}</small></td>
            <td>{account.role === 'admin' ? 'Admin' : 'ประธานคณะ'}</td>
            <td>{dateTime(account.last_sign_in_at)}</td>
            <td><span className={`account-status ${account.active ? 'active' : 'inactive'}`}>{account.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td>
          </tr>)}
        </tbody></table></div>
      </section>

      <aside className="account-detail-card">
        {selected ? <>
          <span className="avatar avatar-large">{selected.display_name?.slice(0, 1)}</span>
          <h2>{selected.display_name}</h2><p>@{selected.username}</p>
          <div className="account-detail-list">
            <div><span>บทบาท</span><strong>{selected.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ประธานคณะสี'}</strong></div>
            <div><span>คณะสี</span><strong>{selected.team_name || '—'}</strong></div>
            <div><span>สร้างบัญชี</span><strong>{dateTime(selected.created_at)}</strong></div>
            <div><span>เข้าสู่ระบบล่าสุด</span><strong>{dateTime(selected.last_sign_in_at)}</strong></div>
            <div><span>กิจกรรมล่าสุด</span><strong>{dateTime(selected.last_activity_at)}</strong></div>
          </div>
          <div className="account-metric-grid">
            <article><strong>{selected.submission_count}</strong><small>ข้อมูลเวร</small></article>
            <article><strong>{selected.evaluation_count}</strong><small>คะแนน</small></article>
            <article><strong>{selected.photo_count}</strong><small>รูปภาพ</small></article>
          </div>
          <small className="account-security-note">ระบบไม่สามารถอ่านหรือแสดงรหัสผ่านเดิมของผู้ใช้ได้</small>
        </> : <div className="mini-empty">ไม่พบบัญชีตามตัวกรอง</div>}
      </aside>
    </div>}
  </div>;
}
