export default function KpiCard({ icon, label, value, fmt, yesterday, week, month }) {
  const changes = [
    { label: '昨日', val: yesterday },
    { label: '上周', val: week },
    { label: '上月', val: month },
  ].filter(c => c.val !== undefined)
  return (
    <div className="kpi-card-v2">
      <div className="kpi-v2-top">
        <span className="kpi-v2-icon">{icon}</span>
        <span className="kpi-v2-label">{label}</span>
      </div>
      <div className="kpi-v2-value">{fmt ? fmt(value) : value}</div>
      <div className="kpi-v2-changes">
        {changes.map(c => (
          <span key={c.label} className={`kpi-v2-change ${c.val >= 0 ? 'up' : 'down'}`}>
            {c.label} {c.val >= 0 ? '↑' : '↓'}{Math.abs(c.val)}%
          </span>
        ))}
      </div>
    </div>
  )
}