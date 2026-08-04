import { useCallback, useEffect, useRef, useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import BottomNav from './components/BottomNav.jsx';
import PublicOverview from './pages/v3/PublicOverview.jsx';
import LoginPage from './pages/v3/LoginPage.jsx';
import WorkspacePage from './pages/v3/WorkspacePage.jsx';
import AdminSetupPage from './pages/v3/AdminSetupPage.jsx';
import AccountPage from './pages/v3/AccountPage.jsx';
import { bangkokDate, loadPublicOverview, loadWorkspace } from './services/v3Service.js';
import { getCurrentUser, logout } from './utils/auth.js';

function currentRoute() { return window.location.hash.replace('#', '') || '/'; }

export default function App() {
  const [route, setRoute] = useState(currentRoute());
  const [user, setUser] = useState(null);
  const [date, setDate] = useState(bangkokDate());
  const [publicData, setPublicData] = useState({ teams: [], scores: [], rooms: [] });
  const [workspace, setWorkspace] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [publicLoading, setPublicLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [error, setError] = useState('');
  const publicRequestId = useRef(0);
  const workspaceRequestId = useRef(0);

  const navigate = useCallback((path) => { window.location.hash = path; setRoute(path); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const refreshPublic = useCallback(async () => {
    const requestId = ++publicRequestId.current;
    setPublicLoading(true); setError('');
    try {
      const next = await loadPublicOverview(date);
      if (requestId === publicRequestId.current) setPublicData(next);
    } catch (loadError) {
      if (requestId === publicRequestId.current) setError(loadError.message);
    }
    if (requestId === publicRequestId.current) setPublicLoading(false);
  }, [date]);

  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    const requestId = ++workspaceRequestId.current;
    setWorkspaceLoading(true); setError('');
    try {
      const next = await loadWorkspace(date);
      if (requestId === workspaceRequestId.current) setWorkspace(next);
    } catch (loadError) {
      if (requestId === workspaceRequestId.current) setError(loadError.message);
    }
    if (requestId === workspaceRequestId.current) setWorkspaceLoading(false);
  }, [date, user]);

  useEffect(() => { const handler = () => setRoute(currentRoute()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setAuthLoading(false)); }, []);
  useEffect(() => { refreshPublic(); }, [route, refreshPublic]);
  useEffect(() => { if (user) refreshWorkspace(); else setWorkspace(null); }, [user, refreshWorkspace]);

  function authenticated(page, adminOnly = false) {
    if (authLoading) return <div className="page-container"><div className="loading-panel">กำลังตรวจสอบสิทธิ์…</div></div>;
    if (!user) return <LoginPage onLogin={handleLogin} navigate={navigate} />;
    if (adminOnly && user.role !== 'admin') return <div className="page-container"><div className="empty-panel tall"><h2>ไม่มีสิทธิ์เข้าถึง</h2><p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p><button className="button button-primary" onClick={() => navigate('/workspace')}>กลับพื้นที่ทำงาน</button></div></div>;
    return page;
  }

  async function handleLogout() { await logout(); setUser(null); navigate('/'); }
  async function refreshProfile() { const next = await getCurrentUser(); setUser(next); }
  function handleLogin(next) { setWorkspaceLoading(true); setUser(next); navigate('/workspace'); }

  let page;
  if (route === '/login') page = user ? <WorkspacePage user={user} data={workspace} loading={workspaceLoading} date={date} onDateChange={setDate} onRefresh={refreshWorkspace} navigate={navigate} /> : <LoginPage onLogin={handleLogin} navigate={navigate} />;
  else if (route === '/workspace') page = authenticated(<WorkspacePage user={user} data={workspace} loading={workspaceLoading} date={date} onDateChange={setDate} onRefresh={refreshWorkspace} navigate={navigate} />);
  else if (route === '/admin') page = authenticated(<AdminSetupPage data={workspace} onRefresh={refreshWorkspace} navigate={navigate} />, true);
  else if (route === '/account') page = authenticated(<AccountPage user={user} onUpdated={refreshProfile} onLogout={handleLogout} />);
  else page = <PublicOverview data={publicData} loading={publicLoading} date={date} onDateChange={setDate} onRefresh={refreshPublic} navigate={navigate} />;

  return <div className="app-shell"><AppHeader user={user} route={route} navigate={navigate} onLogout={handleLogout} />{error ? <div className="global-error">{error}</div> : null}<main>{page}</main><footer><strong>Clean & Care</strong><span>ระบบติดตามความสะอาด โรงเรียนเทพศิรินทร์ นนทบุรี</span></footer><BottomNav user={user} route={route} navigate={navigate} /></div>;
}
