import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { bangkokDate, loadAdminSummary } from '../../services/v3Service.js';

const periodModes = [
  { id: 'day', label: 'รายวัน' },
  { id: 'month', label: 'รายเดือน' },
  { id: 'range', label: 'ช่วงเดือน' }
];

function monthBounds(value) {
  const [year, month] = value.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { startDate: `${value}-01`, endDate: `${value}-${String(lastDay).padStart(2, '0')}` };
}

function reportBounds(mode, day, month, startMonth, endMonth) {
  if (mode === 'day') return { startDate: day, endDate: day };
  if (mode === 'month') return monthBounds(month);
  return { startDate: monthBounds(startMonth).startDate, endDate: monthBounds(endMonth).endDate };
}

function thaiDate(value, options = { dateStyle: 'long' }) {
  return new Intl.DateTimeFormat('th-TH', { ...options, timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`));
}

function formatScore(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}

function sortRanking(rows, primary, tieBreakers = []) {
  const metrics = [primary, ...tieBreakers];
  return [...rows].sort((a, b) => {
    if (a[primary] == null && b[primary] == null) return a.team.sort_order - b.team.sort_order;
    if (a[primary] == null) return 1;
    if (b[primary] == null) return -1;
    for (const metric of metrics) {
      const difference = Number(b[metric] || 0) - Number(a[metric] || 0);
      if (difference) return difference;
    }
    return a.team.sort_order - b.team.sort_order;
  }).map((row, index) => ({ ...row, rank: row[primary] == null ? null : index + 1 }));
}

function ScoreBar({ value, max = 10, color }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return <span className="report-score-bar"><i style={{ width: `${width}%`, background: color }} /></span>;
}

function TeamCell({ team }) {
  return <span className="report-team"><i style={{ background: team.accent_color }} /><span><strong>{team.short_name}</strong><small>{team.color_name}</small></span></span>;
}

function RankingTable({ title, eyebrow, rows, metric, accent, description }) {
  return (
    <section className="report-table-card">
      <div className="report-card-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><p>{description}</p></div>
      <div className="report-table-scroll">
        <table className="report-table">
          <thead><tr><th>อันดับ</th><th>คณะสี</th><th className="score-column">คะแนน /10</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.team.id}>
            <td><span className={row.rank && row.rank <= 3 ? `rank-badge rank-${row.rank}` : 'rank-badge'}>{row.rank || '—'}</span></td>
            <td><TeamCell team={row.team} /></td>
            <td className="score-column"><strong>{formatScore(row[metric])}</strong><ScoreBar value={row[metric]} color={accent} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminSummaryPage({ navigate }) {
  const today = bangkokDate();
  const currentMonth = today.slice(0, 7);
  const [mode, setMode] = useState('day');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(currentMonth);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [data, setData] = useState({ teams: [], scores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const bounds = reportBounds(mode, day, month, startMonth, endMonth);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    loadAdminSummary({ ...bounds, teamIds: selectedTeamIds })
      .then((next) => { if (id === requestId.current) setData(next); })
      .catch((loadError) => { if (id === requestId.current) setError(loadError.message); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [bounds.startDate, bounds.endDate, selectedTeamIds.join(',')]);

  const reportRows = useMemo(() => {
    const latestByTeamDate = new Map();
    (data.scores || []).forEach((score) => {
      const key = `${score.team_id}:${score.score_date}`;
      const current = latestByTeamDate.get(key);
      if (!current || new Date(score.published_at) > new Date(current.published_at)) latestByTeamDate.set(key, score);
    });
    const visibleTeams = selectedTeamIds.length ? data.teams.filter((team) => selectedTeamIds.includes(team.id)) : data.teams;
    return visibleTeams.map((team) => {
      const scores = [...latestByTeamDate.values()].filter((score) => score.team_id === team.id);
      if (!scores.length) return { team, cleanliness: null, management: null, total: null };
      const cleanliness = scores.reduce((sum, score) => sum + Number(score.cleanliness_score || 0), 0) / scores.length;
      const management = scores.reduce((sum, score) => sum + Number(score.attendance_score || 0), 0) / scores.length;
      return { team, cleanliness, management, total: cleanliness + management };
    });
  }, [data, selectedTeamIds]);

  const cleanlinessRows = useMemo(() => sortRanking(reportRows, 'cleanliness'), [reportRows]);
  const managementRows = useMemo(() => sortRanking(reportRows, 'management'), [reportRows]);
  const totalRows = useMemo(() => sortRanking(reportRows, 'total', ['cleanliness', 'management']), [reportRows]);
  const hasScores = reportRows.some((row) => row.total != null);
  const periodLabel = mode === 'day'
    ? thaiDate(day)
    : mode === 'month'
      ? thaiDate(`${month}-01`, { month: 'long', year: 'numeric' })
      : `${thaiDate(`${startMonth}-01`, { month: 'short', year: 'numeric' })} – ${thaiDate(monthBounds(endMonth).endDate, { month: 'short', year: 'numeric' })}`;

  function toggleTeam(teamId) {
    setSelectedTeamIds((current) => {
      if (!current.length) return [teamId];
      if (current.includes(teamId)) {
        const next = current.filter((id) => id !== teamId);
        return next.length ? next : [];
      }
      return [...current, teamId];
    });
  }

  return (
    <div className="page-container report-page">
      <section className="workspace-heading report-heading">
        <div><span className="eyebrow">Admin Analytics</span><h1>สรุปผลและจัดอันดับ</h1><p>เปรียบเทียบความสะอาด การบริหารจัดการ และคะแนนรวมตามช่วงเวลาที่ต้องการ</p></div>
        <button className="button button-secondary" type="button" onClick={() => navigate('/admin')}><Icon name="shield" /> จัดการระบบ</button>
      </section>

      <section className="report-filter-panel">
        <div className="report-mode-tabs" aria-label="เลือกรูปแบบรายงาน">
          {periodModes.map((item) => <button className={mode === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}
        </div>
        <div className="report-date-fields">
          {mode === 'day' ? <label>วันที่<input type="date" value={day} onInput={(event) => setDay(event.currentTarget.value)} onChange={(event) => setDay(event.target.value)} /></label> : null}
          {mode === 'month' ? <label>เดือน<input type="month" value={month} onInput={(event) => setMonth(event.currentTarget.value)} onChange={(event) => setMonth(event.target.value)} /></label> : null}
          {mode === 'range' ? <><label>ตั้งแต่เดือน<input type="month" value={startMonth} max={endMonth} onInput={(event) => setStartMonth(event.currentTarget.value)} onChange={(event) => setStartMonth(event.target.value)} /></label><label>ถึงเดือน<input type="month" value={endMonth} min={startMonth} onInput={(event) => setEndMonth(event.currentTarget.value)} onChange={(event) => setEndMonth(event.target.value)} /></label></> : null}
          <span className="report-period-label"><Icon name="calendar" />{periodLabel}</span>
        </div>
        <div className="report-team-filter">
          <div className="report-filter-label"><span>คณะสีที่แสดง</span><button type="button" onClick={() => setSelectedTeamIds([])}>เลือกทั้งหมด</button></div>
          <div className="team-filter-chips">
            {data.teams.map((team) => {
              const active = !selectedTeamIds.length || selectedTeamIds.includes(team.id);
              return <button type="button" className={active ? 'active' : ''} aria-pressed={active} key={team.id} onClick={() => toggleTeam(team.id)} style={{ '--team': team.accent_color, '--team-soft': team.soft_color }}><i />{team.short_name}</button>;
            })}
          </div>
        </div>
      </section>

      {error ? <div className="form-error report-error">{error}</div> : null}
      {loading ? <div className="loading-panel report-loading">กำลังคำนวณและจัดอันดับ…</div> : !hasScores ? <div className="empty-panel report-empty"><span className="empty-icon"><Icon name="chart" /></span><h2>ยังไม่มีผลเผยแพร่ในช่วงนี้</h2><p>ลองเลือกวัน เดือน ช่วงเดือน หรือคณะสีอื่น</p></div> : <>
        <div className="report-winner-grid">
          {[
            { label: 'อันดับ 1 ความสะอาด', row: cleanlinessRows[0], metric: 'cleanliness', tone: 'green' },
            { label: 'อันดับ 1 การบริหารจัดการ', row: managementRows[0], metric: 'management', tone: 'yellow' },
            { label: 'อันดับ 1 คะแนนรวม', row: totalRows[0], metric: 'total', tone: 'dark' }
          ].map((item) => <article className={`report-winner ${item.tone}`} key={item.label}><small>{item.label}</small><div><TeamCell team={item.row.team} /><strong>{formatScore(item.row[item.metric])}<span>/{item.metric === 'total' ? 20 : 10}</span></strong></div></article>)}
        </div>

        <div className="report-table-grid">
          <RankingTable title="อันดับความสะอาด" eyebrow="ประเภทที่ 1" rows={cleanlinessRows} metric="cleanliness" accent="var(--green-600)" description="คะแนนเฉลี่ยความสะอาดจากผลที่เผยแพร่แล้ว" />
          <RankingTable title="อันดับการบริหารจัดการ" eyebrow="ประเภทที่ 2" rows={managementRows} metric="management" accent="var(--yellow-500)" description="คะแนนเฉลี่ยที่คำนวณจากจำนวนนักเรียนเข้าเวร" />
          <section className="report-table-card report-total-card">
            <div className="report-card-heading"><div><span className="eyebrow">รวมทั้งสองประเภท</span><h2>อันดับคะแนนรวม</h2></div><p>ความสะอาด + การบริหารจัดการ คะแนนเต็ม 20</p></div>
            <div className="report-table-scroll"><table className="report-table report-total-table">
              <thead><tr><th>อันดับ</th><th>คณะสี</th><th>ความสะอาด /10</th><th>การบริหารจัดการ /10</th><th className="score-column">รวม /20</th></tr></thead>
              <tbody>{totalRows.map((row) => <tr key={row.team.id}>
                <td><span className={row.rank && row.rank <= 3 ? `rank-badge rank-${row.rank}` : 'rank-badge'}>{row.rank || '—'}</span></td>
                <td><TeamCell team={row.team} /></td>
                <td>{formatScore(row.cleanliness)}</td><td>{formatScore(row.management)}</td>
                <td className="score-column"><strong>{formatScore(row.total)}</strong><ScoreBar value={row.total} max={20} color="var(--green-800)" /></td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </div>
      </>}
    </div>
  );
}
