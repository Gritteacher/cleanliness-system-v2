export default function ProgressBar({ value = 0, max = 100, label }) {
  const percent = max ? Math.min((Number(value) / Number(max)) * 100, 100) : 0;

  return (
    <div className="progress-wrap">
      {label ? <div className="progress-label">{label}</div> : null}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span>{Math.round(percent)}%</span>
    </div>
  );
}
