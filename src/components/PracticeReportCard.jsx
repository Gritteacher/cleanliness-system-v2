import { useState } from 'react';
import Icon from './Icon.jsx';
import { reportTeacherNames } from '../utils/practiceTeachers.js';

export default function PracticeReportCard({ report, onPhoto, emptyText = 'ยังไม่มีรายงานของคณะสีนี้' }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState('');
  const photos = report?.photos || [];
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  const active = photos[index];
  const teachers = reportTeacherNames(report);
  const time = report ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.created_at)) : '';
  return <article className={`practice-report-card${!report ? ' practice-report-card-empty' : ''}`}>
    {active ? <button className="practice-report-cover" type="button" onClick={() => onPhoto(active.full)} aria-label={`ดูภาพรายงานของ ${teachers.join(' และ ')} รูปที่ ${index + 1}`}>
      {failed !== active.full ? <img src={active.thumbnail} alt={`ภาพการปฏิบัติเวร รูปที่ ${index + 1}`} loading="lazy" onError={() => setFailed(active.full)} /> : <span className="practice-cover-placeholder"><Icon name="image" size={30} /><span>เปิดภาพตัวอย่างไม่ได้ · กดดูภาพใหญ่</span></span>}
      <span className="practice-cover-count">{index + 1}/{photos.length}</span><span className="practice-cover-expand"><Icon name="image" size={14} /> ดูภาพใหญ่</span>
    </button> : <div className="practice-report-cover practice-cover-placeholder"><span className="practice-cover-empty-icon"><Icon name="sparkle" size={30} /></span><span>ยังไม่มีรูปภาพ</span></div>}
    {photos.length > 1 && <div className="practice-report-thumbs" aria-label="เลือกภาพรายงาน">{photos.map((photo, i) => <button key={photo.full} type="button" className={i === index ? 'active' : ''} aria-label={`เลือกภาพที่ ${i + 1}`} aria-pressed={i === index} onClick={() => setSelected(i)}><img src={photo.thumbnail} alt={`ภาพตัวอย่างที่ ${i + 1}`} loading="lazy" /></button>)}</div>}
    <div className="practice-report-card-body">
      <div className="practice-report-card-meta"><span className="practice-teacher-label"><Icon name="user" size={16} /> ครูผู้ปฏิบัติเวร</span><span className={`practice-outcome ${report?.outcome || ''}`}>{!report ? 'รอข้อมูลเวร' : report.outcome === 'normal' ? 'ปกติ' : 'มีเหตุการณ์'}</span></div>
      {teachers.length ? <ul className="practice-teacher-names">{teachers.map((name, i) => <li key={`${i}-${name}`}>{name}</li>)}</ul> : <p className="practice-report-awaiting">{emptyText}</p>}
      {report && <><div className="practice-report-description"><small>รายละเอียดการดูแล</small><p>{report.details}</p>{report.action_taken && <><small>การดำเนินการ</small><p>{report.action_taken}</p></>}</div><div className="practice-report-card-time"><Icon name="calendar" size={14} /><span>ส่งเมื่อ {time} น.</span></div><small className="practice-reference">เลขอ้างอิง {report.id}</small></>}
    </div>
  </article>;
}
