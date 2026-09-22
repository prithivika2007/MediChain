// One number card on the dashboard.
export default function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color || '#94a3b8' }}>
      <div className="stat-value" style={{ color: color || 'inherit' }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
