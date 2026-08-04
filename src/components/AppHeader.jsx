import Icon from './Icon.jsx';

export default function AppHeader({ user, route, navigate, onLogout }) {
  const links = user
    ? [
        { path: '/', label: 'ผลคะแนน' },
        { path: '/workspace', label: 'พื้นที่ทำงาน' },
        ...(user.role === 'admin' ? [{ path: '/admin', label: 'จัดการระบบ' }] : []),
        { path: '/account', label: 'บัญชี' }
      ]
    : [{ path: '/', label: 'ผลคะแนน' }];

  return (
    <header className="topbar">
      <button className="brand-lockup" type="button" onClick={() => navigate('/')}>
        <span className="brand-mark"><Icon name="sparkle" size={23} /></span>
        <span>
          <strong>Clean & Care</strong>
          <small>เทพศิรินทร์ นนทบุรี</small>
        </span>
      </button>

      <nav className="desktop-nav" aria-label="เมนูหลัก">
        {links.map((link) => (
          <button key={link.path} className={route === link.path ? 'active' : ''} type="button" onClick={() => navigate(link.path)}>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        {user ? (
          <>
            <button className="profile-pill" type="button" onClick={() => navigate('/account')}>
              <span className="avatar">{user.displayName?.slice(0, 1) || 'U'}</span>
              <span className="profile-copy"><strong>{user.displayName}</strong><small>{user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.team?.short_name}</small></span>
            </button>
            <button className="icon-button" type="button" onClick={onLogout} aria-label="ออกจากระบบ"><Icon name="logout" /></button>
          </>
        ) : (
          <button className="button button-primary button-compact" type="button" onClick={() => navigate('/login')}>
            <Icon name="login" size={18} /> เข้าสู่ระบบ
          </button>
        )}
      </div>
    </header>
  );
}
