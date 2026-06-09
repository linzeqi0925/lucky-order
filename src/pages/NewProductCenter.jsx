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
      }))
      .filter(item => item.order_date)
  }, [orderItems, orderMap])

  const newProducts = useMemo(() => {
    const firstDate = {}
    const productName = {}
    const totalQty = {}
    const recentQty = {}
    const storeSet = {}
    const countrySet = {}

    const now = new Date()
    const cutoff = new Date(now.getTime() - windowDays * 86400000).toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    items.forEach(item => {
      const sku = item.sku
      if (!firstDate[sku] || item.order_date < firstDate[sku]) firstDate[sku] = item.order_date
      if (item.product_name && !productName[sku]) productName[sku] = item.product_name
      totalQty[sku] = (totalQty[sku] || 0) + (item.quantity || 0)
      if (item.order_date >= sevenDaysAgo) recentQty[sku] = (recentQty[sku] || 0) + (item.quantity || 0)
      if (!storeSet[sku]) storeSet[sku] = new Set()
      if (!countrySet[sku]) countrySet[sku] = new Set()
      if (item.store_name) storeSet[sku].add(item.store_name)
      if (item.country) countrySet[sku].add(item.country)
    })

    return Object.keys(firstDate)
      .filter(sku => firstDate[sku] >= cutoff)
      .map(sku => {
        const age = Math.max(1, Math.ceil((now - new Date(firstDate[sku])) / 86400000))
        const dailyAvg = totalQty[sku] / age
        const status = recentQty[sku] >= totalQty[sku] * 0.6 ? '起量中' : dailyAvg >= 1 ? '稳定观察' : '待观察'
        return {
          sku,
          productName: productName[sku] || '',
          firstDate: firstDate[sku],
          totalQty: totalQty[sku] || 0,
          recentQty: recentQty[sku] || 0,
          dailyAvg,
          stores: storeSet[sku]?.size || 0,
          countries: countrySet[sku]?.size || 0,
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
    const skuSet = new Set(newProducts.map(p => p.sku))
    items.forEach(item => {
      if (skuSet.has(item.sku) && map[item.order_date] !== undefined) {
        map[item.order_date] += item.quantity || 0
      }
    })
    const entries = Object.entries(map)
    return {
      labels: entries.map(([d]) => d.slice(5)),
      values: entries.map(([, v]) => v),
    }
  }, [items, newProducts, windowDays])

  const totalQty = newProducts.reduce((sum, p) => sum + p.totalQty, 0)
  const rising = newProducts.filter(p => p.status === '起量中').length

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
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🆕</span><span className="kpi-v2-label">新品 SKU</span></div><div className="kpi-v2-value">{newProducts.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">新品出库量</span></div><div className="kpi-v2-value">{totalQty}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🔥</span><span className="kpi-v2-label">起量中</span></div><div className="kpi-v2-value">{rising}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏆</span><span className="kpi-v2-label">最佳新品</span></div><div className="kpi-v2-value">{newProducts[0]?.sku || '-'}</div></div>
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
              <div className="chart-title">新品累计出库 TOP 20</div>
              <div style={{height: Math.max(240, newProducts.slice(0, 20).length * 34)}}>
                <ReactECharts option={getBarOption(newProducts.slice(0, 20).map(p => p.sku), newProducts.slice(0, 20).map(p => p.totalQty), '#eab308')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">新品运营建议</div>
              <div className="ai-alert-group">
                {newProducts.slice(0, 5).map(p => (
                  <div className="ai-alert-item" key={p.sku}>
                    <span className="ai-alert-icon">{p.status === '起量中' ? '🔥' : '🆕'}</span>
                    <span className="ai-alert-text"><strong>{p.sku}</strong> {p.status}，累计 {p.totalQty} 件，日均 {p.dailyAvg.toFixed(1)} 件</span>
                  </div>
                ))}
                {newProducts.length === 0 && <div className="empty-sm">当前时间范围内暂无新品</div>}
              </div>
            </div>
          </div>

          <div className="chart-card wide">
            <div className="chart-title">新品明细清单</div>
            <div className="table-wrap" style={{marginTop:12}}>
              <table className="order-table">
                <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>首次出库</th><th>累计</th><th>近7天</th><th>日均</th><th>店铺</th><th>国家</th><th>状态</th></tr></thead>
                <tbody>
                  {newProducts.map((p, i) => (
                    <tr key={p.sku}>
                      <td>{i + 1}</td>
                      <td><span className="orderno">{p.sku}</span></td>
                      <td>{p.productName || '-'}</td>
                      <td>{p.firstDate}</td>
                      <td>{p.totalQty}</td>
                      <td>{p.recentQty}</td>
                      <td>{p.dailyAvg.toFixed(1)}</td>
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
