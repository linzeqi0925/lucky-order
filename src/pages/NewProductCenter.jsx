import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { getBarOption, getTrendOption } from '../lib/charts'

export default function NewProductCenter({ orders, orderItems }) {
  const [windowDays, setWindowDays] = useState(30)

  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o })
    return map
  }, [orders])

  const items = useMemo(() => {
    return (orderItems || [])
      .filter(item => item.sku && item.sku.trim())
      .map(item => ({
        ...item,
        order_date: orderMap[item.order_no]?.order_date || '',
        store_name: orderMap[item.order_no]?.store_name || '',
        country: orderMap[item.order_no]?.country || '',
        category: orderMap[item.order_no]?.product_category || '未分类',
      }))
      .filter(item => item.order_date)
  }, [orderItems, orderMap])

  const newCategories = useMemo(() => {
    const firstDate = {}
    const totalQty = {}
    const recentQty = {}
    const storeSet = {}
    const countrySet = {}
    const skuSet = {}
    const skuQty = {}
    const productNames = {}

    const now = new Date()
    const cutoff = new Date(now.getTime() - windowDays * 86400000).toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    items.forEach(item => {
      const category = item.category || '未分类'
      const qty = item.quantity || 0
      if (!firstDate[category] || item.order_date < firstDate[category]) firstDate[category] = item.order_date
      totalQty[category] = (totalQty[category] || 0) + qty
      if (item.order_date >= sevenDaysAgo) recentQty[category] = (recentQty[category] || 0) + qty
      if (!storeSet[category]) storeSet[category] = new Set()
      if (!countrySet[category]) countrySet[category] = new Set()
      if (!skuSet[category]) skuSet[category] = new Set()
      if (!skuQty[category]) skuQty[category] = {}
      if (!productNames[category]) productNames[category] = new Set()
      if (item.store_name) storeSet[category].add(item.store_name)
      if (item.country) countrySet[category].add(item.country)
      if (item.sku) {
        skuSet[category].add(item.sku)
        skuQty[category][item.sku] = (skuQty[category][item.sku] || 0) + qty
      }
      if (item.product_name) productNames[category].add(item.product_name)
    })

    return Object.keys(firstDate)
      .filter(category => firstDate[category] >= cutoff)
      .map(category => {
        const age = Math.max(1, Math.ceil((now - new Date(firstDate[category])) / 86400000))
        const dailyAvg = totalQty[category] / age
        const status = recentQty[category] >= totalQty[category] * 0.6 ? '起量中' : dailyAvg >= 1 ? '稳定观察' : '待观察'
        const topSkus = Object.entries(skuQty[category] || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sku]) => sku)
        return {
          category,
          productNames: [...(productNames[category] || [])].slice(0, 3).join(' / '),
          firstDate: firstDate[category],
          totalQty: totalQty[category] || 0,
          recentQty: recentQty[category] || 0,
          dailyAvg,
          stores: storeSet[category]?.size || 0,
          countries: countrySet[category]?.size || 0,
          skuCount: skuSet[category]?.size || 0,
          topSkus,
          status,
        }
      })
      .sort((a, b) => b.totalQty - a.totalQty)
  }, [items, windowDays])

  const trend = useMemo(() => {
    const now = new Date()
    const map = {}
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      map[d.toISOString().split('T')[0]] = 0
    }
    const categorySet = new Set(newCategories.map(p => p.category))
    items.forEach(item => {
      if (categorySet.has(item.category) && map[item.order_date] !== undefined) {
        map[item.order_date] += item.quantity || 0
      }
    })
    const entries = Object.entries(map)
    return {
      labels: entries.map(([d]) => d.slice(5)),
      values: entries.map(([, v]) => v),
    }
  }, [items, newCategories, windowDays])

  const totalQty = newCategories.reduce((sum, p) => sum + p.totalQty, 0)
  const rising = newCategories.filter(p => p.status === '起量中').length
  const totalSkuCount = newCategories.reduce((sum, p) => sum + p.skuCount, 0)

  return (
    <div className="dashboard-view">
      <div className="v2-kpi-section">
        <div className="v2-kpi-header">
          <span className="section-badge">🆕 新品分析</span>
          <div className="trend-tabs">
            {[7, 14, 30, 60].map(days => (
              <button key={days} className={`trend-tab ${windowDays === days ? 'active' : ''}`} onClick={() => setWindowDays(days)}>
                近{days}天
              </button>
            ))}
          </div>
        </div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🆕</span><span className="kpi-v2-label">新品品类</span></div><div className="kpi-v2-value">{newCategories.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">新品出库量</span></div><div className="kpi-v2-value">{totalQty}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🔥</span><span className="kpi-v2-label">起量中</span></div><div className="kpi-v2-value">{rising}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏷️</span><span className="kpi-v2-label">覆盖 SKU</span></div><div className="kpi-v2-value">{totalSkuCount}</div></div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">📭 暂无 SKU 明细。请重新导入马帮订单导出文件，系统会自动生成 SKU 数据。</div>
      ) : (
        <>
          <div className="chart-row">
            <div className="chart-card wide">
              <div className="chart-title">新品出库趋势</div>
              <ReactECharts option={getTrendOption(trend.labels, trend.values, '#eab308')} style={{height:280}} opts={{renderer:'svg'}} />
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">新品品类累计出库 TOP 20</div>
              <div style={{height: Math.max(240, newCategories.slice(0, 20).length * 34)}}>
                <ReactECharts option={getBarOption(newCategories.slice(0, 20).map(p => p.category), newCategories.slice(0, 20).map(p => p.totalQty), '#eab308')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">新品运营建议</div>
              <div className="ai-alert-group">
                {newCategories.slice(0, 5).map(p => (
                  <div className="ai-alert-item" key={p.category}>
                    <span className="ai-alert-icon">{p.status === '起量中' ? '🔥' : '🆕'}</span>
                    <span className="ai-alert-text"><strong>{p.category}</strong> {p.status}，累计 {p.totalQty} 件，覆盖 {p.skuCount} 个 SKU，日均 {p.dailyAvg.toFixed(1)} 件</span>
                  </div>
                ))}
                {newCategories.length === 0 && <div className="empty-sm">当前时间范围内暂无新品类</div>}
              </div>
            </div>
          </div>

          <div className="chart-card wide">
            <div className="chart-title">新品品类观察清单</div>
            <div className="table-wrap" style={{marginTop:12}}>
              <table className="order-table">
                <thead><tr><th>#</th><th>品类</th><th>代表产品</th><th>首次出库</th><th>累计</th><th>近7天</th><th>日均</th><th>SKU数</th><th>代表SKU</th><th>店铺</th><th>国家</th><th>状态</th></tr></thead>
                <tbody>
                  {newCategories.map((p, i) => (
                    <tr key={p.category}>
                      <td>{i + 1}</td>
                      <td><span className="cat-tag">{p.category}</span></td>
                      <td>{p.productNames || '-'}</td>
                      <td>{p.firstDate}</td>
                      <td>{p.totalQty}</td>
                      <td>{p.recentQty}</td>
                      <td>{p.dailyAvg.toFixed(1)}</td>
                      <td>{p.skuCount}</td>
                      <td>{p.topSkus.join(' / ') || '-'}</td>
                      <td>{p.stores}</td>
                      <td>{p.countries}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
