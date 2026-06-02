export default function MonitorCard({ title, items }) {
  return (
    <div className="monitor-card">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="monitor-empty">✅ 无异常</p> : (
        items.map((item, i) => (
          <div key={i} className="monitor-item">
            <span className="monitor-name">{item.name}</span>
            <span className="monitor-change down">{item.change}%</span>
            <span className="monitor-detail">{item.cur}单 vs {item.prev}单</span>
          </div>
        ))
      )}
    </div>
  )
}