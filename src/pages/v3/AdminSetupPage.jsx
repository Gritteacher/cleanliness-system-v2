import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { saveArea, saveAreaAssignment, saveDutySchedule, saveSchoolTerm } from '../../services/v3Service.js';

export default function AdminSetupPage({ data, onRefresh, navigate }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitTerm(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      await saveSchoolTerm({ id: data?.term?.id, academicYear: form.get('academicYear'), semester: form.get('semester'), name: form.get('name'), startDate: form.get('startDate'), endDate: form.get('endDate'), active: true });
      setMessage('บันทึกภาคเรียนแล้ว'); await onRefresh();
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  async function submitArea(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      await saveArea({ code: form.get('code'), name: form.get('name'), sortOrder: data?.areas?.length || 0 });
      event.currentTarget.reset(); setMessage('เพิ่มพื้นที่แล้ว'); await onRefresh();
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  async function submitAssignment(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      await saveAreaAssignment({ termId: data.term.id, teamId: form.get('teamId'), areaId: form.get('areaId'), roomLabel: form.get('roomLabel'), sortOrder: data.assignments.length });
      event.currentTarget.reset(); setMessage('จับคู่พื้นที่กับคณะแล้ว'); await onRefresh();
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  async function submitSchedule(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      await saveDutySchedule({ termId: data.term.id, weekday: form.get('weekday'), teamId: form.get('teamId') });
      setMessage('บันทึกตารางเวรแล้ว'); await onRefresh();
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  const readiness = [
    { label: 'ภาคเรียนที่เปิดใช้งาน', done: Boolean(data?.term), value: data?.term?.name || 'ยังไม่ได้ตั้งค่า' },
    { label: 'พื้นที่ตรวจความสะอาด', done: Boolean(data?.areas?.length), value: `${data?.areas?.length || 0} พื้นที่` },
    { label: 'การจับคู่คณะกับพื้นที่', done: Boolean(data?.assignments?.length), value: `${data?.assignments?.length || 0} รายการ` },
    { label: 'ตารางเวร จ.–ศ.', done: data?.schedules?.length === 5, value: `${data?.schedules?.length || 0}/5 วัน` }
  ];

  return (
    <div className="page-container admin-page">
      <section className="workspace-heading"><div><span className="eyebrow">Admin Console</span><h1>ตั้งค่าระบบ</h1><p>เตรียมข้อมูลหลักก่อนเปิดใช้งานกับประธานคณะ</p></div><button className="button button-secondary" onClick={() => navigate('/workspace')}><Icon name="clipboard" /> ดูงานวันนี้</button></section>
      {message ? <div className="notice-bar">{message}</div> : null}
      <div className="readiness-grid">{readiness.map((item) => <article className={item.done ? 'done' : ''} key={item.label}><span><Icon name={item.done ? 'check' : 'plus'} /></span><div><small>{item.label}</small><strong>{item.value}</strong></div></article>)}</div>

      <div className="admin-grid">
        <section className="settings-card">
          <div className="card-title"><span className="summary-icon green"><Icon name="calendar" /></span><div><h2>ภาคเรียน</h2><p>ระบบอนุญาตให้เปิดใช้งานได้ครั้งละหนึ่งภาคเรียน</p></div></div>
          <form className="settings-form" onSubmit={submitTerm}>
            <div className="field-row"><label>ปีการศึกษา<input name="academicYear" type="number" min="2500" defaultValue={data?.term?.academic_year || 2569} required /></label><label>ภาคเรียน<select name="semester" defaultValue={data?.term?.semester || 1}><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option><option value="3">ภาคฤดูร้อน</option></select></label></div>
            <label>ชื่อที่แสดง<input name="name" defaultValue={data?.term?.name || 'ภาคเรียนที่ 1 ปีการศึกษา 2569'} required /></label>
            <div className="field-row"><label>วันที่เริ่ม<input name="startDate" type="date" defaultValue={data?.term?.start_date || '2026-05-18'} required /></label><label>วันที่สิ้นสุด<input name="endDate" type="date" defaultValue={data?.term?.end_date || '2026-10-09'} required /></label></div>
            <button className="button button-primary" disabled={busy}>บันทึกภาคเรียน</button>
          </form>
        </section>

        <section className="settings-card">
          <div className="card-title"><span className="summary-icon yellow"><Icon name="plus" /></span><div><h2>พื้นที่</h2><p>สร้างรหัสและชื่อพื้นที่สำหรับนำไปจับคู่กับห้อง</p></div></div>
          <form className="settings-form inline-form" onSubmit={submitArea}><label>รหัส<input name="code" placeholder="A01" required /></label><label className="grow">ชื่อพื้นที่<input name="name" placeholder="เช่น อาคาร 1 ชั้น 2" required /></label><button className="button button-primary" disabled={busy}>เพิ่ม</button></form>
          <div className="area-list">{data?.areas?.length ? data.areas.map((area) => <div key={area.id}><span>{area.code}</span><strong>{area.name}</strong><small>เปิดใช้งาน</small></div>) : <div className="mini-empty">ยังไม่มีพื้นที่ในระบบ</div>}</div>
        </section>
      </div>

      <div className="admin-grid admin-grid-secondary">
        <section className="settings-card">
          <div className="card-title"><span className="summary-icon cream"><Icon name="clipboard" /></span><div><h2>จับคู่ห้องและพื้นที่</h2><p>หนึ่งคณะมีได้หลายพื้นที่ในภาคเรียนเดียวกัน</p></div></div>
          {!data?.term || !data?.areas?.length ? <div className="mini-empty">กรุณาตั้งค่าภาคเรียนและพื้นที่ก่อน</div> : <form className="settings-form" onSubmit={submitAssignment}>
            <div className="field-row"><label>คณะ<select name="teamId" required>{data.teams.map((team) => <option value={team.id} key={team.id}>{team.short_name}</option>)}</select></label><label>พื้นที่<select name="areaId" required>{data.areas.map((area) => <option value={area.id} key={area.id}>{area.code} · {area.name}</option>)}</select></label></div>
            <label>ชื่อห้อง/จุดที่แสดง<input name="roomLabel" placeholder="เช่น ห้อง 221" required /></label>
            <button className="button button-primary" disabled={busy}>เพิ่มการจับคู่</button>
          </form>}
          <div className="assignment-list">{data?.assignments?.map((item) => <div key={item.id}><span className="team-dot" style={{ background: item.team?.accent_color }} /><div><strong>{item.room_label}</strong><small>{item.team?.short_name} · {item.area?.name}</small></div></div>)}</div>
        </section>

        <section className="settings-card">
          <div className="card-title"><span className="summary-icon green"><Icon name="calendar" /></span><div><h2>ตารางเวรประจำสัปดาห์</h2><p>กำหนดหนึ่งคณะต่อหนึ่งวัน จันทร์–ศุกร์</p></div></div>
          {!data?.term ? <div className="mini-empty">กรุณาตั้งค่าภาคเรียนก่อน</div> : <form className="settings-form inline-form" onSubmit={submitSchedule}>
            <label>วัน<select name="weekday">{['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'].map((day, index) => <option value={index + 1} key={day}>{day}</option>)}</select></label>
            <label className="grow">คณะ<select name="teamId">{data.teams.map((team) => <option value={team.id} key={team.id}>{team.short_name}</option>)}</select></label>
            <button className="button button-primary" disabled={busy}>บันทึก</button>
          </form>}
          <div className="schedule-list">{[1,2,3,4,5].map((weekday) => { const row = data?.schedules?.find((item) => item.weekday === weekday); return <div key={weekday}><strong>{['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'][weekday - 1]}</strong>{row ? <span><i style={{ background: row.team?.accent_color }} />{row.team?.short_name}</span> : <small>ยังไม่กำหนด</small>}</div>; })}</div>
        </section>
      </div>

      <section className="next-step-card"><span className="brand-mark"><Icon name="sparkle" /></span><div><h3>พร้อมเปิดใช้งานเมื่อ checklist ครบ</h3><p>ประธานคณะจะเห็นพื้นที่ของเวรในวันนั้น และส่งข้อมูลให้ทุกคณะร่วมประเมินได้ทันที</p></div><span className="soon-badge">V3 Foundation</span></section>
    </div>
  );
}
