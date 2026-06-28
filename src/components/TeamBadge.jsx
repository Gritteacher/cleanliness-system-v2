import { getTeam } from '../data/colorTeams.js';

export default function TeamBadge({ teamId, label, size = 'normal' }) {
  const team = getTeam(teamId);
  if (!team && !label) return null;

  return (
    <span
      className={`team-badge team-badge-${size}`}
      style={{
        '--team-color': team?.accentColor || '#0B1F3A',
        '--team-soft': team?.softColor || '#EEF2FF'
      }}
    >
      <span className="team-dot" />
      {label || team.name}
    </span>
  );
}
