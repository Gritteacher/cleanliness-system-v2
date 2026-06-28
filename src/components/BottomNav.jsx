function Icon({ name }) {
  const common = {
    width: '22',
    height: '22',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  const paths = {
    scoreboard: (
      <>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
        <path d="M3 19h18" />
      </>
    ),
    login: (
      <>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </>
    ),
    home: (
      <>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V20h11v-9.5" />
        <path d="M10 20v-5h4v5" />
      </>
    ),
    duty: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="M8 5l1.5-2h5L16 5" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    score: (
      <>
        <path d="M5 18h14" />
        <path d="M6 14l4-4 3 3 5-6" />
        <path d="M18 7h-4" />
        <path d="M18 7v4" />
      </>
    ),
    detail: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 9h8" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
    complete: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m8.8 12 2.2 2.2 4.5-4.8" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3l7 3v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" />
        <path d="M9.5 12l1.8 1.8 3.7-4" />
      </>
    ),
    setup: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="10" cy="18" r="2" />
      </>
    )
  };

  return <svg {...common}>{paths[name] || paths.scoreboard}</svg>;
}

export default function BottomNav({ user, route, navigate }) {
  const publicItems = [
    { path: '/', label: 'คะแนน', icon: 'scoreboard' },
    { path: '/login', label: 'Login', icon: 'login' }
  ];

  const presidentItems = [
    { path: '/dashboard', label: 'หน้าหลัก', icon: 'home' },
    { path: '/duty-record', label: 'ทำเวร', icon: 'duty' },
    { path: '/clean-score', label: 'ให้คะแนน', icon: 'score' },
    { path: '/', label: 'Public', icon: 'scoreboard' }
  ];

  const adminItems = [
    { path: '/admin-summary', label: 'สรุป', icon: 'scoreboard' },
    { path: '/duty-record', label: 'ทำเวร', icon: 'duty' },
    { path: '/clean-score', label: 'ให้คะแนน', icon: 'score' },
    { path: '/admin-details', label: 'พื้นที่', icon: 'detail' },
    { path: '/admin-completeness', label: 'ครบถ้วน', icon: 'complete' },
    { path: '/admin-panel', label: 'จัดการ', icon: 'admin' },
    { path: '/area-setup', label: 'Setup', icon: 'setup' }
  ];

  const items = user?.role === 'ADMIN' ? adminItems : user ? presidentItems : publicItems;

  return (
    <nav className="side-nav" aria-label="เมนูหลัก">
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          className={route === item.path ? 'active' : ''}
          onClick={() => navigate(item.path)}
          title={item.label}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
