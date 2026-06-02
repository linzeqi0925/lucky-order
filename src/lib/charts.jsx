/**
 * 图表配置函数库
 * 统一管理所有 ECharts 图表配置
 */

export const COLORS = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981','#06b6d4','#3b82f6']

export function getBarOption(labels, values, color) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category', data: [...labels].reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', data: [...values].reverse(), itemStyle: { color, borderRadius: [0, 6, 6, 0] }, barWidth: 20 }]
  }
}

export function getPieOption(data) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['35%', '65%'], center: ['50%', '50%'],
      data: data.map((d, i) => ({ ...d, itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { fontSize: 12, formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } }
    }]
  }
}

export function getTrendOption(labels, values, color = '#6366f1') {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 25 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 8,
      lineStyle: { color, width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: color.replace(')', ',0.3)').replace('rgb', 'rgba') },
        { offset: 1, color: color.replace(')', ',0.02)').replace('rgb', 'rgba') }
      ]}},
      itemStyle: { color }
    }]
  }
}

// ============================================================
// 环比计算工具
// ============================================================

export function getDayComp(orders, days, type) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
  const dayBefore = new Date(now.getTime() - (days + 1) * 86400000).toISOString().split('T')[0]
  const cur = orders.filter(o => o.order_date === yesterday)
  const prev = orders.filter(o => o.order_date === dayBefore)
  const get = (arr, t) => t === 'qty' ? arr.reduce((s, o) => s + o.quantity, 0) : t === 'amount' ? arr.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) : arr.length
  const cv = get(cur, type || 'count'), pv = get(prev, type || 'count')
  return pv > 0 ? Math.round((cv - pv) / pv * 100) : 0
}

export function getPeriodComp(orders, days, type) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
  const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString().split('T')[0]
  const cur = orders.filter(o => o.order_date >= start && o.order_date <= end)
  const prev = orders.filter(o => o.order_date >= prevStart && o.order_date < start)
  const get = (arr, t) => t === 'qty' ? arr.reduce((s, o) => s + o.quantity, 0) : t === 'amount' ? arr.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) : arr.length
  const cv = get(cur, type || 'count'), pv = get(prev, type || 'count')
  return pv > 0 ? Math.round((cv - pv) / pv * 100) : 0
}

// ============================================================
// AI 洞察辅助
// ============================================================

export function findDrops(orders, field) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
  const prev30 = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0]
  const cur = orders.filter(o => o.order_date >= start30 && o.order_date <= end)
  const prev = orders.filter(o => o.order_date >= prev30 && o.order_date < start30)
  if (cur.length < 5) return []
  const curMap = {}, prevMap = {}
  cur.forEach(o => { const v = field(o) || '未知'; curMap[v] = (curMap[v] || 0) + 1 })
  prev.forEach(o => { const v = field(o) || '未知'; prevMap[v] = (prevMap[v] || 0) + 1 })
  return Object.entries(curMap).map(([k, v]) => {
    const pv = prevMap[k] || 0
    const chg = pv > 0 ? ((v - pv) / pv * 100).toFixed(0) : 0
    return { name: k, cur: v, prev: pv, change: parseFloat(chg) }
  }).sort((a, b) => a.change - b.change).filter(x => x.prev >= 3).slice(0, 5)
}

export function renderAIAlerts(items, typeName, icon) {
  const bad = items.filter(x => x.change < -10).slice(0, 3)
  if (bad.length === 0) return null
  return (
    <div className="ai-alert-group">
      {bad.map((item, i) => (
        <div key={i} className="ai-alert-item" style={i === 0 ? {background:'#fef2f2',borderColor:'#fecaca'} : {}}>
          <span className="ai-alert-icon">{icon}</span>
          <span className="ai-alert-text"><strong>{item.name}</strong> 下降 {item.change}%</span>
          <span className="ai-alert-detail">{item.cur}单 → {item.prev}单</span>
        </div>
      ))}
    </div>
  )
}

export function renderAIGrowth(items, typeName) {
  const good = items.filter(x => x.change > 20).slice(0, 3)
  if (good.length === 0) return null
  return (
    <div className="ai-growth-group">
      {good.map((item, i) => (
        <div key={i} className="ai-growth-item">
          <span>🔥 <strong>{item.name}</strong> 增长 <span className="growth-pct">{item.change}%</span></span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 工具函数
// ============================================================

export function findKey(keys, candidates) {
  for (const c of candidates) {
    const f = keys.find(k => k.toLowerCase().includes(c.toLowerCase()))
    if (f) return f
  }
  return null
}

export function formatExcelDate(val) {
  if (!val) return new Date().toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  const d = new Date(val)
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(val)
}

export function getWeekday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

export function getMonth(dateStr) {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}年${parseInt(m[2])}月` : ''
}

export function parseMeta(remark, key) {
  if (!remark) return ''
  const m = remark.match(new RegExp(`\\[${key}:([^\\]]+)\\]`))
  return m ? m[1] : ''
}