import Icon from './Icon.jsx';

export default function BottomNav({ user, route, navigate }) {
  const items = user
    ? [
        { path: '/', label: 'คะแนน', icon: 'chart' },
        { path: '/workspace', label: 'งานวันนี้', icon: 'clipboard' },
        ...(user.role === 'admin' ? [{ path: '/admin', label: 'จัดการ', icon: 'shield' }] : []),
        { path: '/account', label: 'บัญชี', icon: 'user' }
      ]
    : [
        { path: '/', label: 'คะแนน', icon: 'chart' },
        { path: '/login', label: 'เข้าสู่ระบบ', icon: 'login' }
      ];

  return (
    <nav className="mobile-nav" aria-label="เมนูมือถือ">
      {items.map((item) => (
        <button key={item.path} className={route === item.path ? 'active' : ''} type="button" onClick={() => navigate(item.path)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
