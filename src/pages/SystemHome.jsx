import Icon from '../components/Icon.jsx';
import { APP_NAME_TH, APP_NAME_EN } from '../../shared/appMetadata.mjs';

export default function SystemHome({ navigate }) {
  return <section className="page-container system-home">
    <header className="system-home-intro">
      <span className="eyebrow">เทพศิรินทร์ นนทบุรี</span>
      <h1>{APP_NAME_TH}</h1>
      <p className="system-home-name-en">{APP_NAME_EN}</p>
      <p>พื้นที่สำหรับดูแลความสะอาดและกิจกรรมคณะสีของโรงเรียน</p>
      <div className="system-home-colors" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </header>
    <div className="system-section-heading"><h2>เลือกระบบที่ต้องการใช้งาน</h2><span>2 ระบบ</span></div>
    <div className="system-choice-grid">
      <button type="button" className="system-choice cleanliness-choice" onClick={() => navigate('/cleanliness')}>
        <span className="system-choice-head"><span className="system-choice-icon"><Icon name="sparkle" size={24} /></span><span className="system-choice-number">01 · CLEANLINESS</span></span>
        <h2>ระบบรณรงค์ความสะอาด</h2><p>บันทึกเวร ดูภาพพื้นที่ และติดตามผลคะแนนคณะสี</p><span className="system-choice-action">เข้าสู่ระบบความสะอาด <span><Icon name="arrow" size={18} /></span></span>
      </button>
      <button type="button" className="system-choice practice-choice" onClick={() => navigate('/practice')}>
        <span className="system-choice-head"><span className="system-choice-icon"><Icon name="clipboard" size={24} /></span><span className="system-choice-number">02 · COLOR TEAM</span></span>
        <h2>ระบบรายงานเวรดูแลนักเรียน<span>ฝึกซ้อมกิจกรรมคณะสี</span></h2><p>2–30 พฤศจิกายน 2569 · กรอกรายงานได้ทันที</p><span className="system-choice-action">รายงานเวรฝึกซ้อม <span><Icon name="arrow" size={18} /></span></span>
      </button>
    </div>
  </section>;
}
