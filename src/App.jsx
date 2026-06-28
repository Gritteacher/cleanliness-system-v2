import { useEffect, useMemo, useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import BottomNav from './components/BottomNav.jsx';
import PublicScoreboard from './pages/PublicScoreboard.jsx';
import Login from './pages/Login.jsx';
import PresidentDashboard from './pages/PresidentDashboard.jsx';
import DutyRecord from './pages/DutyRecord.jsx';
import CleanScore from './pages/CleanScore.jsx';
import AdminSummary from './pages/AdminSummary.jsx';
import AdminAreaDetails from './pages/AdminAreaDetails.jsx';
import AdminCompleteness from './pages/AdminCompleteness.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import AreaSetup from './pages/AreaSetup.jsx';
import { getCurrentUser, logout as authLogout } from './utils/auth.js';
import { loadAppData, saveAppData } from './utils/storage.js';
import { loadRemoteData } from './services/supabaseService.js';

function normalizeRoute() {
  const hash = window.location.hash.replace('#', '');
  return hash || '/';
}

export default function App() {
  const [route, setRoute] = useState(normalizeRoute());
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState(loadAppData());
  const [systemMessage, setSystemMessage] = useState('');

  useEffect(() => {
    const handler = () => setRoute(normalizeRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const current = await getCurrentUser();
        setUser(current);
      } finally {
        setAuthLoading(false);
      }

      try {
        const remote = await loadRemoteData();
        if (!remote.areas?.length) {
          setSystemMessage('ยังไม่พบข้อมูลพื้นที่ใน Supabase');
          return;
        }
        setData(remote);
        saveAppData(remote);
      } catch (error) {
        setSystemMessage(`ยังโหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${error.message}`);
      }
    }

    boot();
  }, []);

  const actions = useMemo(() => ({
    setData(nextData) {
      setData(nextData);
      saveAppData(nextData);
    },
    async refreshData() {
      const remote = await loadRemoteData();
      setData(remote);
      saveAppData(remote);
      return remote;
    },
    navigate(path) {
      window.location.hash = path;
      setRoute(path);
    },
    setUser(nextUser) {
      setUser(nextUser);
    },
    async logout() {
      await authLogout();
      setUser(null);
      window.location.hash = '/';
      setRoute('/');
    }
  }), []);

  function requireAuth(component, adminOnly = false) {
    if (authLoading) {
      return (
        <div className="page-shell">
          <div className="empty-state">
            <h2>กำลังตรวจสอบการเข้าสู่ระบบ</h2>
            <p>กรุณารอสักครู่</p>
          </div>
        </div>
      );
    }

    if (!user) return <Login onLogin={actions.setUser} navigate={actions.navigate} />;
    if (adminOnly && user.role !== 'ADMIN') {
      return (
        <div className="page-shell">
          <div className="empty-state">
            <h2>ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
            <p>หน้านี้สำหรับ Admin เท่านั้น</p>
            <button className="btn btn-primary" type="button" onClick={() => actions.navigate('/dashboard')}>
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      );
    }
    return component;
  }

  const pageProps = {
    data,
    setData: actions.setData,
    refreshData: actions.refreshData,
    user,
    navigate: actions.navigate
  };

  let page;
  switch (route) {
    case '/login':
      page = <Login onLogin={actions.setUser} navigate={actions.navigate} />;
      break;
    case '/dashboard':
      page = requireAuth(<PresidentDashboard {...pageProps} />);
      break;
    case '/duty-record':
      page = requireAuth(<DutyRecord {...pageProps} />);
      break;
    case '/clean-score':
      page = requireAuth(<CleanScore {...pageProps} />);
      break;
    case '/admin-summary':
      page = requireAuth(<AdminSummary {...pageProps} />, true);
      break;
    case '/admin-details':
      page = requireAuth(<AdminAreaDetails {...pageProps} />, true);
      break;
    case '/admin-completeness':
      page = requireAuth(<AdminCompleteness {...pageProps} />, true);
      break;
    case '/admin-panel':
      page = requireAuth(<AdminPanel {...pageProps} />, true);
      break;
    case '/area-setup':
      page = requireAuth(<AreaSetup {...pageProps} />, true);
      break;
    default:
      page = <PublicScoreboard {...pageProps} />;
  }

  return (
    <div className="app">
      <AppHeader user={user} route={route} navigate={actions.navigate} onLogout={actions.logout} />
      {systemMessage ? (
        <div className="system-message">
          {systemMessage}
        </div>
      ) : null}
      <main>{page}</main>
      <footer className="app-footer">
        พัฒนาโดย ครูไต๋ กฤษณพล ทองอุ่น โรงเรียนเทพศิรินทร์ นนทบุรี
      </footer>
      <BottomNav user={user} route={route} navigate={actions.navigate} />
    </div>
  );
}
