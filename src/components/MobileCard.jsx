export default function MobileCard({ title, subtitle, children, actions, accent }) {
  return (
    <article className="mobile-card" style={{ '--accent': accent || '#0B1F3A' }}>
      <div className="mobile-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <span className="mini-line" />
      </div>
      <div className="mobile-card-body">{children}</div>
      {actions ? <div className="mobile-card-actions">{actions}</div> : null}
    </article>
  );
}
