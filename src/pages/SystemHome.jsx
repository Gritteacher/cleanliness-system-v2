export default function SystemHome({ navigate }) {
  return <section className="page-container system-home">
    <span className="eyebrow">เทพศิรินทร์ นนทบุรี</span>
    <h1>ร่วมดูแล ใส่ใจทุกกิจกรรม</h1><p>เลือกระบบที่ต้องการใช้งาน</p>
    <div className="system-choice-grid">
      <button type="button" className="system-choice cleanliness-choice" onClick={() => navigate('/cleanliness')}>
        <span className="system-choice-number">01 · CLEAN & CARE</span><h2>ระบบรณรงค์<br />ความสะอาด</h2><p>บันทึกเวร ดูภาพพื้นที่ และติดตามผลคะแนนคณะสี</p><span className="system-choice-action">เข้าสู่ระบบรณรงค์ความสะอาด →</span>
      </button>
      <button type="button" className="system-choice practice-choice" onClick={() => navigate('/practice')}>
        <span className="system-choice-number">02 · COLOR TEAM ACTIVITIES</span><h2>ระบบรายงานเวรดูแลนักเรียน<br />ฝึกซ้อมกิจกรรมคณะสี</h2><p>2–30 พฤศจิกายน 2569 · ครูกรอกรายงานได้ทันที</p><span className="system-choice-action">รายงานเวรฝึกซ้อม →</span>
      </button>
    </div>
  </section>;
}
