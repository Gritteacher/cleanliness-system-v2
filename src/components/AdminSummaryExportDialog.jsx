import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

const modes = [
  { id: 'day', label: 'รายวัน' },
  { id: 'month', label: 'รายเดือน' },
  { id: 'range', label: 'ช่วงเดือน' }
];

const metricOptions = [
  { id: 'cleanliness', label: 'ความสะอาด', note: 'คะแนนเต็ม 10' },
  { id: 'management', label: 'การบริหารจัดการ', note: 'คะแนนเต็ม 10' },
  { id: 'total', label: 'คะแนนรวม', note: 'คะแนนเต็ม 20' }
];

const sheetOptions = [
  { id: 'summary', label: 'สรุปผลและอันดับ', note: 'ค่าเฉลี่ยและอันดับของแต่ละคณะสี' },
  { id: 'daily', label: 'คะแนนรายวัน', note: 'คะแนนแยกตามวันที่และคณะสี' }
];

function ChoiceCard({ active, label, note, onClick }) {
  return <button className={`export-choice-card${active ? ' active' : ''}`} type="button" aria-pressed={active} onClick={onClick}>
    <span className="export-choice-check">{active ? <Icon name="check" size={15} /> : null}</span>
    <span><strong>{label}</strong><small>{note}</small></span>
  </button>;
}

export default function AdminSummaryExportDialog({ initialPeriod, initialTeamIds, teams, onClose, onExport }) {
  const [mode, setMode] = useState(initialPeriod.mode);
  const [day, setDay] = useState(initialPeriod.day);
  const [month, setMonth] = useState(initialPeriod.month);
  const [startMonth, setStartMonth] = useState(initialPeriod.startMonth);
  const [endMonth, setEndMonth] = useState(initialPeriod.endMonth);
  const [teamIds, setTeamIds] = useState(initialTeamIds);
  const [metrics, setMetrics] = useState(['cleanliness', 'management', 'total']);
  const [sheets, setSheets] = useState(['summary', 'daily']);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !exporting) onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [exporting, onClose]);

  const allTeamsSelected = useMemo(() => teams.length > 0 && teamIds.length === teams.length, [teamIds, teams]);

  function toggleValue(setter, values, value) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
    setError('');
  }

  function toggleTeam(teamId) {
    setTeamIds((current) => current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId]);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!teamIds.length) return setError('กรุณาเลือกอย่างน้อย 1 คณะสี');
    if (!metrics.length) return setError('กรุณาเลือกอย่างน้อย 1 ประเภทคะแนน');
    if (!sheets.length) return setError('กรุณาเลือกอย่างน้อย 1 รูปแบบข้อมูล');
    if (mode === 'range' && startMonth > endMonth) return setError('เดือนเริ่มต้นต้องไม่อยู่หลังเดือนสิ้นสุด');
    setExporting(true); setError('');
    try {
      await onExport({
        mode, day, month, startMonth, endMonth, teamIds, metrics,
        includeSummary: sheets.includes('summary'),
        includeDaily: sheets.includes('daily')
      });
      onClose();
    } catch (exportError) {
      setError(exportError.message || 'ไม่สามารถสร้างไฟล์ Excel ได้');
    } finally {
      setExporting(false);
    }
  }

  return <div className="export-dialog-backdrop" role="presentation" onMouseDown={() => { if (!exporting) onClose(); }}>
    <form className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header className="export-dialog-header">
        <div className="export-dialog-title"><span><Icon name="download" size={22} /></span><div><small>Excel Export</small><h2 id="export-dialog-title">เลือกข้อมูลที่ต้องการส่งออก</h2></div></div>
        <button className="team-score-close" type="button" onClick={onClose} disabled={exporting} aria-label="ปิดหน้าต่างส่งออก">×</button>
      </header>

      <div className="export-dialog-body">
        <section className="export-section">
          <div className="export-section-heading"><span>1</span><div><strong>ช่วงเวลา</strong><small>กำหนดวันที่ของข้อมูลในไฟล์</small></div></div>
          <div className="report-mode-tabs export-mode-tabs" aria-label="เลือกรูปแบบช่วงเวลา">
            {modes.map((item) => <button className={mode === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}
          </div>
          <div className="export-date-fields">
            {mode === 'day' ? <label>วันที่<input type="date" value={day} onChange={(event) => setDay(event.target.value)} required /></label> : null}
            {mode === 'month' ? <label>เดือน<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></label> : null}
            {mode === 'range' ? <><label>ตั้งแต่เดือน<input type="month" value={startMonth} max={endMonth} onChange={(event) => setStartMonth(event.target.value)} required /></label><label>ถึงเดือน<input type="month" value={endMonth} min={startMonth} onChange={(event) => setEndMonth(event.target.value)} required /></label></> : null}
          </div>
        </section>

        <section className="export-section">
          <div className="export-section-heading"><span>2</span><div><strong>คณะสี</strong><small>เลือกเฉพาะคณะสีที่ต้องการ</small></div><button type="button" onClick={() => setTeamIds(allTeamsSelected ? [] : teams.map((team) => team.id))}>{allTeamsSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</button></div>
          <div className="export-team-grid">
            {teams.map((team) => {
              const active = teamIds.includes(team.id);
              return <button type="button" className={active ? 'active' : ''} aria-pressed={active} key={team.id} onClick={() => toggleTeam(team.id)} style={{ '--team': team.accent_color, '--team-soft': team.soft_color }}><i /><span><strong>{team.short_name}</strong><small>{team.color_name}</small></span><b>{active ? <Icon name="check" size={13} /> : null}</b></button>;
            })}
          </div>
        </section>

        <section className="export-section">
          <div className="export-section-heading"><span>3</span><div><strong>ประเภทคะแนน</strong><small>คอลัมน์คะแนนที่จะอยู่ในไฟล์</small></div></div>
          <div className="export-choice-grid">
            {metricOptions.map((item) => <ChoiceCard key={item.id} active={metrics.includes(item.id)} label={item.label} note={item.note} onClick={() => toggleValue(setMetrics, metrics, item.id)} />)}
          </div>
        </section>

        <section className="export-section">
          <div className="export-section-heading"><span>4</span><div><strong>รูปแบบข้อมูล</strong><small>แต่ละรายการจะสร้างเป็น 1 ชีต</small></div></div>
          <div className="export-choice-grid two-columns">
            {sheetOptions.map((item) => <ChoiceCard key={item.id} active={sheets.includes(item.id)} label={item.label} note={item.note} onClick={() => toggleValue(setSheets, sheets, item.id)} />)}
          </div>
        </section>

        <div className="export-holiday-note"><Icon name="calendar" size={17} /><span><strong>วันหยุดจะไม่ถูกนำมาคำนวณ</strong><small>ระบบดึงข้อมูลล่าสุดและใช้สูตรเดียวกับหน้าสรุปผล</small></span></div>
        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <footer className="export-dialog-actions">
        <button className="button button-secondary" type="button" onClick={onClose} disabled={exporting}>ยกเลิก</button>
        <button className="button button-primary" type="submit" disabled={exporting}><Icon name={exporting ? 'refresh' : 'download'} size={17} /> {exporting ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด Excel'}</button>
      </footer>
    </form>
  </div>;
}
