import { APP_VERSION, DEVELOPER_CREDIT, APP_SHORT_NAME_TH } from '../../shared/appMetadata.mjs';

export default function AppFooter() {
  return <footer className="app-footer">
    <div className="footer-school"><strong>{APP_SHORT_NAME_TH}</strong><span className="footer-version" aria-label={`เวอร์ชัน ${APP_VERSION}`}>v{APP_VERSION}</span></div>
    <div className="footer-attribution"><span className="footer-print-version">เวอร์ชัน {APP_VERSION}</span><span>{DEVELOPER_CREDIT}</span></div>
  </footer>;
}
