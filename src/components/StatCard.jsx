export default function StatCard({ label, value, hint, accent = '#0B1F3A' }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-content">
        <p>{label}</p>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
