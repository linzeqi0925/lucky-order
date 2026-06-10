import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { getBarOption, getPieOption, getTrendOption } from '../lib/charts'

export default function CategoryCenter({ orders, orderItems = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [timeGrain, setTimeGrain] = useState('day')

  const orderByNo = useMemo(() => {
    const map = {}
    orders.forEach(order => { map[order.order_no] = order })
    return map
  }, [orders])

  const categoryStats = useMemo(() => {
    const map = {}
    orders.forEach(order => {
      const category = order.product_category || '未分类'
      if (!map[category]) {
        map[category] = {
          name: category,
          orders: 0,
          qty: 0,
          amount: 0,
          stores: new Set(),
          countries: new Set(),
          skus: new Set(),
          dates: {},
        }
      }
      map[category].orders += 1
      map[category].qty += order.quantity || 0
      map[category].amount += Number(order.total_amount || 0)
      if (order.store_name) map[category].stores.add(order.store_name)
      if (order.country) map[category].countries.add(order.country)
      if (order.order_date) map[category].dates[order.order_date] = (map[category].dates[order.order_date] || 0) + (order.quantity || 0)
    })

    orderItems.forEach(item => {
      const order = orderByNo[item.order_no]
      const category = order?.product_category || '未分类'
      if (map[category] && item.sku) map[category].skus.add(item.sku)
    })

    return Object.values(map)
      .map(item => ({
        ...item,
        stores: item.stores.size,
        countries: item.countries.size,
        skus: item.skus.size,
      }))
      .sort((a, b) => b.qty - a.qty)
  }, [orders, orderItems, orderByNo])

  const totalQty = categoryStats.reduce((sum, item) => sum + item.qty, 0)
  const totalOrders = categoryStats.reduce((sum, item) => sum + item.orders, 0)
  const unclassified = categoryStats.find(item => item.name === '未分类')
  const selected = categoryStats.find(item => item.name === selectedCategory) || categoryStats[0]

  const selectedItems = useMemo(() => {
    if (!selected) return []
    const orderNos = new Set(orders.filter(order => (order.product_category || '未分类') === selected.name).map(order => order.order_no))
    const map = {}
    orderItems.forEach(item => {
      if (!orderNos.has(item.order_no) || !item.sku) return
      if (!map[item.sku]) map[item.sku] = { sku: item.sku, qty: 0, orders: new Set(), productName: item.product_name || '' }
      map[item.sku].qty += item.quantity || 0
      map[item.sku].orders.add(item.order_no)
      if (item.product_name && !map[item.sku].productName) map[item.sku].productName = item.product_name
    })
    return Object.values(map)
      .map(item => ({ ...item, orders: item.orders.size }))
      .sort((a, b) => b.qty - a.qty)
  }, [orders, orderItems, selected])

  const trend = useMemo(() => {
    if (!selected) return { labels: [], values: [] }
    const grouped = {}
    Object.entries(selected.dates).forEach(([day, qty]) => {
      const key = getDateGroupKey(day, timeGrain)
      grouped[key] = (grouped[key] || 0) + qty
    })
    const entries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))
    return {
      labels: entries.map(([day]) => day),
      values: entries.map(([, qty]) => qty),
    }
  }, [selected, timeGrain])

  const topShare = totalQty > 0 && categoryStats[0] ? ((categoryStats[0].qty / totalQty) * 100).toFixed(1) : '0.0'
  const categoryHealth = categoryStats.filter(item => item.qty > 0).length

  return (
    <div className="dashboard-view">
      <div className="v2-kpi-section">
        <div className="v2-kpi-header">
          <span className="section-badge">🏷️ 品类经营分析</span>
          <div className="toolbar-inline">
            <select className="filter-input compact" value={selected?.name || ''} onChange={event => setSelectedCategory(event.target.value)}>
              {categoryStats.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <div className="trend-tabs">
              {[
                ['day', '日'],
                ['week', '周'],
                ['month', '月'],
              ].map(([key, label]) => (
                <button key={key} className={`trend-tab ${timeGrain === key ? 'active' : ''}`} onClick={() => setTimeGrain(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏷️</span><span className="kpi-v2-label">经营品类</span></div><div className="kpi-v2-value">{categoryStats.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">总出库量</span></div><div className="kpi-v2-value">{totalQty.toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📋</span><span className="kpi-v2-label">订单数</span></div><div className="kpi-v2-value">{totalOrders.toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">⚠️</span><span className="kpi-v2-label">未分类</span></div><div className="kpi-v2-value" style={{color: unclassified ? '#dc2626' : '#16a34a'}}>{unclassified?.qty || 0}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🎯</span><span className="kpi-v2-label">TOP1 占比</span></div><div className="kpi-v2-value">{topShare}%</div></div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-card">
          <div className="chart-title">品类出库排行</div>
          <div style={{height: categoryStats.length > 0 ? Math.max(260, categoryStats.slice(0, 15).length * 34) : 260}}>
            <ReactECharts option={getBarOption(categoryStats.slice(0, 15).map(item => item.name), categoryStats.slice(0, 15).map(item => item.qty), '#6366f1')} style={{height:'100%'}} opts={{renderer:'svg'}} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">品类结构占比</div>
          <ReactECharts option={getPieOption(categoryStats.slice(0, 10).map(item => ({ name: item.name, value: item.qty })))} style={{height:300}} opts={{renderer:'svg'}} />
        </div>
      </div>

      <div className="chart-card wide">
        <div className="chart-title">品类经营清单</div>
        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead><tr><th>品类</th><th>出库量</th><th>订单数</th><th>SKU数</th><th>店铺数</th><th>国家数</th><th>占比</th></tr></thead>
            <tbody>
              {categoryStats.map(item => (
                <tr key={item.name} className={selected?.name === item.name ? 'row-active' : ''} onClick={() => setSelectedCategory(item.name)}>
                  <td className="matrix-row-label">{item.name}</td>
                  <td>{item.qty}</td>
                  <td>{item.orders}</td>
                  <td>{item.skus}</td>
                  <td>{item.stores}</td>
                  <td>{item.countries}</td>
                  <td>{totalQty > 0 ? ((item.qty / totalQty) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <div className="insight-strip">
            <div className="insight-chip">当前查看：{selected.name}</div>
            <div className="insight-chip">覆盖 {selected.skus} 个 SKU</div>
            <div className="insight-chip">{selected.stores} 个店铺在卖</div>
            <div className="insight-chip">{selected.countries} 个国家有出库</div>
          </div>
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">{selected.name} {timeGrain === 'day' ? '按日' : timeGrain === 'week' ? '按周' : '按月'}出库趋势</div>
              <ReactECharts option={getTrendOption(trend.labels, trend.values, '#0f766e')} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
            <div className="chart-card">
              <div className="chart-title">{selected.name} SKU TOP 10</div>
              <div style={{height: selectedItems.length > 0 ? Math.max(240, selectedItems.slice(0, 10).length * 34) : 240}}>
                <ReactECharts option={getBarOption(selectedItems.slice(0, 10).map(item => item.sku), selectedItems.slice(0, 10).map(item => item.qty), '#8b5cf6')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">品类动作建议</span></div>
        <div className="ai-alert-group">
          {unclassified && <div className="ai-alert-item"><span className="ai-alert-icon">!</span><span className="ai-alert-text">还有 {unclassified.qty} 件未分类，先做人工归并，否则品类占比和新品观察会失真。</span></div>}
          {Number(topShare) > 45 && <div className="ai-alert-item"><span className="ai-alert-icon">!</span><span className="ai-alert-text">TOP1 品类占比 {topShare}%，业务较集中，建议检查供应商和库存依赖风险。</span></div>}
          {categoryHealth > 8 && <div className="ai-alert-item"><span className="ai-alert-icon">!</span><span className="ai-alert-text">品类较多，建议保留经营一级品类，把材质、颜色、尺寸放到 SKU 维度观察。</span></div>}
        </div>
      </div>
    </div>
  )
}

function getDateGroupKey(dateText, grain) {
  if (grain === 'month') return dateText.slice(0, 7)
  if (grain === 'week') {
    const date = new Date(`${dateText}T00:00:00`)
    const day = date.getDay() || 7
    date.setDate(date.getDate() + 4 - day)
    const yearStart = new Date(date.getFullYear(), 0, 1)
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return dateText.slice(5)
}
