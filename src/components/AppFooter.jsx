import { APP_VERSION, DEVELOPER_CREDIT } from '../../shared/appMetadata.mjs';

export default function AppFooter() {
  return <footer className="app-footer">
    <div className="footer-school"><strong>Clean & Care</strong><span>โรงเรียนเทพศิรินทร์ นนทบุรี</span></div>
    <div className="footer-attribution"><span>เวอร์ชัน {APP_VERSION}</span><span>{DEVELOPER_CREDIT}</span></div>
  </footer>;
}
