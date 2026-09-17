import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { bangkokDate, loadAdminSummary, subscribeLiveUpdates } from '../../services/v3Service.js';

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

function averageScore(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value != null).map(Number);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
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

function RankingTable({ title, eyebrow, rows, metric, accent, description, onSelect }) {
  return (
    <section className="report-table-card">
      <div className="report-card-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><p>{description}</p></div>
      <div className="report-table-scroll">
        <table className="report-table">
          <thead><tr><th>อันดับ</th><th>คณะสี</th><th className="score-column">คะแนน /10</th></tr></thead>
          <tbody>{rows.map((row) => <tr className="report-clickable-row" key={row.team.id} tabIndex="0" role="button" aria-label={`ดูคะแนนรายวันของ${row.team.short_name}`} onClick={() => onSelect(row.team.id, metric)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row.team.id, metric); } }}>
            <td><span className={row.rank && row.rank <= 3 ? `rank-badge rank-${row.rank}` : 'rank-badge'}>{row.rank || '—'}</span></td>
            <td><TeamCell team={row.team} /></td>
            <td className="score-column"><strong>{formatScore(row[metric])}</strong><ScoreBar value={row[metric]} color={accent} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function TeamScoreDrawer({ team, summary, scores, periodLabel, focusMetric, onClose }) {
  useEffect(() => {
    if (!team) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, team]);

  if (!team) return null;
  const dailyScores = [...scores]
    .filter((score) => score.team_id === team.id)
    .sort((a, b) => b.score_date.localeCompare(a.score_date));
  const focusLabel = focusMetric === 'cleanliness' ? 'ความสะอาด' : focusMetric === 'management' ? 'การบริหารจัดการ' : 'คะแนนรวม';

  return <div className="team-score-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={`team-score-drawer focus-${focusMetric}`} role="dialog" aria-modal="true" aria-labelledby="team-score-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="team-score-drawer-header">
        <div className="team-score-identity" style={{ '--team': team.accent_color, '--team-soft': team.soft_color }}><i /><div><span className="eyebrow">รายละเอียดคะแนนรายวัน</span><h2 id="team-score-title">{team.short_name}</h2><p>{team.color_name} · {periodLabel}</p></div></div>
        <button className="team-score-close" type="button" onClick={onClose} aria-label="ปิดรายละเอียด">×</button>
      </header>

      <div className="team-score-focus"><Icon name="chart" size={17} /><span>เปิดจากอันดับ{focusLabel}</span></div>
      <div className="team-score-summary">
        <article><small>วันที่มีคะแนน</small><strong>{dailyScores.length}<i> วัน</i></strong></article>
        <article><small>ความสะอาด</small><strong>{formatScore(summary?.cleanliness)}<i>/10</i></strong></article>
        <article><small>การบริหารจัดการ</small><strong>{formatScore(summary?.management)}<i>/10</i></strong></article>
        <article className="total"><small>คะแนนรวม</small><strong>{formatScore(summary?.total)}<i>/20</i></strong></article>
      </div>

      <div className="team-score-table-wrap">
        {dailyScores.length ? <table className="team-score-table">
          <thead><tr><th>วันที่</th><th>ความสะอาด /10</th><th>การบริหารจัดการ /10</th><th>รวม /20</th></tr></thead>
          <tbody>{dailyScores.map((score) => {
            const total = score.cleanliness_score == null || score.attendance_score == null ? null : Number(score.cleanliness_score) + Number(score.attendance_score);
            return <tr key={score.score_date}>
              <td><strong>{thaiDate(score.score_date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><small>{thaiDate(score.score_date, { year: 'numeric' })}</small></td>
              <td>{formatScore(score.cleanliness_score)}</td>
              <td>{formatScore(score.attendance_score)}</td>
              <td><strong>{formatScore(total)}</strong></td>
            </tr>;
          })}</tbody>
        </table> : <div className="team-score-empty"><span className="empty-icon"><Icon name="calendar" /></span><h3>ไม่มีคะแนนในช่วงนี้</h3><p>ลองเปลี่ยนวันที่หรือช่วงเดือนในหน้าสรุปผล</p></div>}
      </div>
    </section>
  </div>;
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
  const [liveTick, setLiveTick] = useState(0);
  const [teamDetail, setTeamDetail] = useState(null);
  const requestId = useRef(0);
  const bounds = reportBounds(mode, day, month, startMonth, endMonth);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    loadAdminSummary({ ...bounds, teamIds: selectedTeamIds })
      .then((next) => { if (id === requestId.current) setData(next); })
      .catch((loadError) => { if (id === requestId.current) setError(loadError.message); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [bounds.startDate, bounds.endDate, selectedTeamIds.join(','), liveTick]);

  useEffect(() => subscribeLiveUpdates((changedDate) => {
    if (!changedDate || (changedDate >= bounds.startDate && changedDate <= bounds.endDate)) setLiveTick((value) => value + 1);
  }), [bounds.startDate, bounds.endDate]);

  const reportRows = useMemo(() => {
    const latestByTeamDate = new Map();
    (data.scores || []).forEach((score) => {
      const key = `${score.team_id}:${score.score_date}`;
      latestByTeamDate.set(key, score);
    });
    const visibleTeams = selectedTeamIds.length ? data.teams.filter((team) => selectedTeamIds.includes(team.id)) : data.teams;
    return visibleTeams.map((team) => {
      const scores = [...latestByTeamDate.values()].filter((score) => score.team_id === team.id);
      if (!scores.length) return { team, cleanliness: null, management: null, total: null };
      const cleanliness = averageScore(scores, 'cleanliness_score');
      const management = averageScore(scores, 'attendance_score');
      const total = cleanliness == null || management == null ? null : cleanliness + management;
      return { team, cleanliness, management, total };
    });
  }, [data, selectedTeamIds]);

  const cleanlinessRows = useMemo(() => sortRanking(reportRows, 'cleanliness'), [reportRows]);
  const managementRows = useMemo(() => sortRanking(reportRows, 'management'), [reportRows]);
  const totalRows = useMemo(() => sortRanking(reportRows, 'total', ['cleanliness', 'management']), [reportRows]);
  const hasScores = reportRows.some((row) => row.cleanliness != null || row.management != null);
  const detailTeam = teamDetail ? data.teams.find((team) => team.id === teamDetail.teamId) : null;
  const detailSummary = detailTeam ? reportRows.find((row) => row.team.id === detailTeam.id) : null;
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

  function openTeamDetail(teamId, focusMetric) {
    setTeamDetail({ teamId, focusMetric });
  }

  return (
    <div className="page-container report-page">
      <section className="workspace-heading report-heading">
        <div><span className="eyebrow">Admin Analytics · Real-time</span><h1>สรุปผลและจัดอันดับ</h1><p>เปรียบเทียบความสะอาด การบริหารจัดการ และคะแนนรวมจากข้อมูลล่าสุด</p></div>
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

      <div className="report-detail-hint"><Icon name="chart" size={15} /> กดที่การ์ดหรือแถวคณะสีเพื่อดูคะแนนรายวัน</div>
      {error ? <div className="form-error report-error">{error}</div> : null}
      {loading ? <div className="loading-panel report-loading">กำลังคำนวณและจัดอันดับ…</div> : !hasScores ? <div className="empty-panel report-empty"><span className="empty-icon"><Icon name="chart" /></span><h2>ยังไม่มีคะแนนในช่วงนี้</h2><p>ลองเลือกวัน เดือน ช่วงเดือน หรือคณะสีอื่น</p></div> : <>
        <div className="report-winner-grid">
          {[
            { label: 'อันดับ 1 ความสะอาด', row: cleanlinessRows[0], metric: 'cleanliness', tone: 'green' },
            { label: 'อันดับ 1 การบริหารจัดการ', row: managementRows[0], metric: 'management', tone: 'yellow' },
            { label: 'อันดับ 1 คะแนนรวม', row: totalRows[0], metric: 'total', tone: 'dark' }
          ].map((item) => <button className={`report-winner ${item.tone}`} type="button" key={item.label} onClick={() => openTeamDetail(item.row.team.id, item.metric)} aria-label={`ดูคะแนนรายวันของ${item.row.team.short_name}`}><small>{item.label}</small><div><TeamCell team={item.row.team} /><strong>{formatScore(item.row[item.metric])}<span>/{item.metric === 'total' ? 20 : 10}</span></strong></div></button>)}
        </div>

        <div className="report-table-grid">
          <RankingTable title="อันดับความสะอาด" eyebrow="ประเภทที่ 1" rows={cleanlinessRows} metric="cleanliness" accent="var(--green-600)" description="คะแนนเฉลี่ยความสะอาดจากข้อมูลล่าสุด" onSelect={openTeamDetail} />
          <RankingTable title="อันดับการบริหารจัดการ" eyebrow="ประเภทที่ 2" rows={managementRows} metric="management" accent="var(--yellow-500)" description="คะแนนเฉลี่ยที่คำนวณจากจำนวนนักเรียนเข้าเวร" onSelect={openTeamDetail} />
          <section className="report-table-card report-total-card">
            <div className="report-card-heading"><div><span className="eyebrow">รวมทั้งสองประเภท</span><h2>อันดับคะแนนรวม</h2></div><p>ความสะอาด + การบริหารจัดการ คะแนนเต็ม 20</p></div>
            <div className="report-table-scroll"><table className="report-table report-total-table">
              <thead><tr><th>อันดับ</th><th>คณะสี</th><th>ความสะอาด /10</th><th>การบริหารจัดการ /10</th><th className="score-column">รวม /20</th></tr></thead>
              <tbody>{totalRows.map((row) => <tr className="report-clickable-row" key={row.team.id} tabIndex="0" role="button" aria-label={`ดูคะแนนรายวันของ${row.team.short_name}`} onClick={() => openTeamDetail(row.team.id, 'total')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTeamDetail(row.team.id, 'total'); } }}>
                <td><span className={row.rank && row.rank <= 3 ? `rank-badge rank-${row.rank}` : 'rank-badge'}>{row.rank || '—'}</span></td>
                <td><TeamCell team={row.team} /></td>
                <td>{formatScore(row.cleanliness)}</td><td>{formatScore(row.management)}</td>
                <td className="score-column"><strong>{formatScore(row.total)}</strong><ScoreBar value={row.total} max={20} color="var(--green-800)" /></td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </div>
      </>}
      <TeamScoreDrawer team={detailTeam} summary={detailSummary} scores={data.scores || []} periodLabel={periodLabel} focusMetric={teamDetail?.focusMetric || 'total'} onClose={() => setTeamDetail(null)} />
    </div>
  );
}
