import { getTeam } from '../data/colorTeams.js';

const LOGO_URL = 'https://www.tsn.ac.th/web/wp-content/uploads/2013/12/Logo_Blue-700x639.png';

export default function AppHeader({ user, route, navigate, onLogout }) {
  const team = getTeam(user?.colorTeamId);

  return (
    <header className="app-header">
      <div className="brand" onClick={() => navigate('/')} role="button" tabIndex="0">
        <img src={LOGO_URL} alt="โรงเรียนเทพศิรินทร์ นนทบุรี" />
        <div>
          <h1>ระบบตรวจความสะอาดคณะสี</h1>
          <p>ปีการศึกษา 2569 • โรงเรียนเทพศิรินทร์ นนทบุรี</p>
        </div>
      </div>

      <div className="header-actions">
        {user ? (
          <>
            <div className="user-chip">
              <strong>{user.displayName}</strong>
              <span>{user.role === 'ADMIN' ? 'Admin' : team?.shortName}</span>
            </div>
            <button className="btn btn-ghost" type="button" onClick={onLogout}>ออกจากระบบ</button>
          </>
        ) : (
          <button
            className={route === '/login' ? 'btn btn-primary' : 'btn btn-ghost'}
            type="button"
            onClick={() => navigate('/login')}
          >
            เข้าสู่ระบบ
          </button>
        )}
      </div>
    </header>
  );
}
