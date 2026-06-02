/**
 * 国家分析中心 V2
 *
 * 数据源：orders（国家维度）+ order_items（SKU维度）
 * 模块：
 *   1. 国家排行榜
 *   2. 国家趋势（点击钻取）
 *   3. 国家 SKU 排行
 *   4. 国家品类排行
 *   5. 国家经营建议（规则引擎）
 */

import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import CountryMap from '../components/CountryMap'
import { getBarOption, getTrendOption, getPieOption, COLORS } from '../lib/charts'

export default function CountryCenter({ orders, orderItems }) {
  const [selectedCountry, setSelectedCountry] = useState(null)

  // order_no → order_date 映射
  const orderDateMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o.order_date })
    return map
  }, [orders])

  // 带日期的 items
  const itemsWithDate = useMemo(() => {
    if (!orderItems?.length) return []
    return orderItems.map(item => ({
      ...item,
      order_date: orderDateMap[item.order_no] || '',
    }))
  }, [orderItems, orderDateMap])

  // ============================
  // 模块 1：国家排行榜
  // ============================
  const countryStats = useMemo(() => {
    const qtyMap = {}
    const orderMap = {}
    let totalQty = 0
    orders.forEach(o => {
      const c = o.country || '未知'
      qtyMap[c] = (qtyMap[c] || 0) + o.quantity
      orderMap[c] = (orderMap[c] || 0) + 1
      totalQty += o.quantity
    })
    const entries = Object.entries(qtyMap).sort((a, b) => b[1] - a[1])
    return { qtyMap, orderMap, entries, totalQty }
  }, [orders])

  // ============================
  // 模块 2：国家趋势
  // ============================
  const countryTrend = useMemo(() => {
    if (!selectedCountry) return { labels: [], values: [] }
    const now = new Date()
    const dayMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    orders.filter(o => o.country === selectedCountry).forEach(o => {
      if (dayMap[o.order_date] !== undefined) dayMap[o.order_date] += o.quantity
    })
    const entries = Object.entries(dayMap)
    return { labels: entries.filter((_, i) => i % 5 === 0).map(([d]) => d.slice(5)), values: entries.map(([, v]) => v) }
  }, [orders, selectedCountry])

  // ============================
  // 模块 3：国家 SKU 排行
  // ============================
  const countrySkuStats = useMemo(() => {
    if (!selectedCountry || !itemsWithDate.length) return []
    const countryOrderNos = new Set(orders.filter(o => o.country === selectedCountry).map(o => o.order_no))
    const skuMap = {}
    itemsWithDate.filter(item => countryOrderNos.has(item.order_no)).forEach(item => {
      const sku = item.sku || '未知'
      skuMap[sku] = (skuMap[sku] || 0) + item.quantity
    })
    return Object.entries(skuMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [orders, orderItems, itemsWithDate, selectedCountry])

  // ============================
  // 模块 4：国家品类排行
  // ============================
  const countryCatStats = useMemo(() => {
    if (!selectedCountry) return []
    const catMap = {}
    orders.filter(o => o.country === selectedCountry).forEach(o => {
      const cat = o.product_category || '未分类'
      catMap[cat] = (catMap[cat] || 0) + o.quantity
    })
    return Object.entries(catMap).sort((a, b) => b[1] - a[1])
  }, [orders, selectedCountry])

  // ============================
  // 模块 5：经营建议（规则引擎）
  // ============================
  const countryAdvice = useMemo(() => {
    const advice = []
    if (!selectedCountry) return advice

    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const start30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const start60 = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0]

    const curOrders = orders.filter(o => o.country === selectedCountry && o.order_date >= start30 && o.order_date <= end)
    const prevOrders = orders.filter(o => o.country === selectedCountry && o.order_date >= start60 && o.order_date < start30)

    const curQty = curOrders.reduce((s, o) => s + o.quantity, 0)
    const prevQty = prevOrders.reduce((s, o) => s + o.quantity, 0)

    if (prevQty > 0) {
      const change = ((curQty - prevQty) / prevQty * 100).toFixed(1)
      if (change > 0) advice.push(`📈 出库量增长 ${change}%，建议保持现有策略并关注库存`)
      else if (change < -10) advice.push(`📉 出库量下降 ${change}%，建议检查广告投放和竞品动态`)
      else advice.push(`➡️ 出库量基本平稳（${change}%），建议做常规维护`)
    }

    // 品类变化
    const curCat = {}
    curOrders.forEach(o => { const c = o.product_category || '未分类'; curCat[c] = (curCat[c] || 0) + o.quantity })
    const prevCat = {}
    prevOrders.forEach(o => { const c = o.product_category || '未分类'; prevCat[c] = (prevCat[c] || 0) + o.quantity })

    Object.entries(curCat).forEach(([cat, qty]) => {
      const pv = prevCat[cat] || 0
      if (pv > 0) {
        const chg = ((qty - pv) / pv * 100).toFixed(1)
        if (chg > 30) advice.push(`🔥 ${cat}品类增长 ${chg}%，是重要增长点`)
        else if (chg < -20) advice.push(`⚠️ ${cat}品类下降 ${chg}%，建议检查原因`)
      } else if (qty > 0) {
        advice.push(`🆕 ${cat}品类在本市场首次出现，可作为新机会点`)
      }
    })

    // 新品
    if (itemsWithDate.length > 0) {
      const countryOrderNos = new Set(orders.filter(o => o.country === selectedCountry).map(o => o.order_no))
      const countrySkus = new Set(itemsWithDate.filter(i => countryOrderNos.has(i.order_no)).map(i => i.sku))
      const newSkus = []
      countrySkus.forEach(sku => {
        const firstDate = itemsWithDate
          .filter(i => i.sku === sku && i.order_date)
          .sort((a, b) => a.order_date.localeCompare(b.order_date))[0]?.order_date
        if (firstDate && firstDate >= start30) newSkus.push(sku)
      })
      if (newSkus.length > 0) advice.push(`🆕 本市场有 ${newSkus.length} 个新品上线，可查看 SKU 中心了解详情`)
    }

    // TOP SKU
    if (countrySkuStats[0]) {
      advice.push(`🏆 热销 SKU：${countrySkuStats[0][0]}（${countrySkuStats[0][1]}件）`)
    }

    return advice
  }, [orders, orderItems, itemsWithDate, selectedCountry, countrySkuStats])

  const top10 = countryStats.entries.slice(0, 10)
  const totalQty = countryStats.totalQty
  const hasData = orders.length > 0

  return (
    <div className="dashboard-view">
      {/* KPI */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">🌍 国家分析中心</span></div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🌍</span><span className="kpi-v2-label">覆盖国家</span></div><div className="kpi-v2-value">{countryStats.entries.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">总出库量</span></div><div className="kpi-v2-value">{totalQty.toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏆</span><span className="kpi-v2-label">最大市场</span></div><div className="kpi-v2-value">{top10[0]?.[0] || '-'}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📈</span><span className="kpi-v2-label">TOP1 占比</span></div><div className="kpi-v2-value">{totalQty > 0 && top10[0] ? ((top10[0][1] / totalQty) * 100).toFixed(1) + '%' : '-'}</div></div>
        </div>
      </div>

      {/* 世界地图 */}
      <div className="v2-map-section">
        <CountryMap orders={orders} />
      </div>

      {/* 国家排行 */}
      <div className="chart-row">
        <div className="chart-card">
          <div className="chart-title">国家出库排行</div>
          <div style={{height: Math.max(200, top10.length * 36)}}>
            <ReactECharts option={getBarOption(top10.map(([c]) => c), top10.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">国家分布</div>
          <ReactECharts option={getPieOption(top10.slice(0, 8).map(([c, v]) => ({name: c, value: v})))} style={{height:260}} opts={{renderer:'svg'}} />
        </div>
      </div>

      {/* 国家选择 */}
      <div className="chart-card wide">
        <div className="chart-title">🔍 选择国家查看详情</div>
        <div className="filter-bar" style={{marginTop:8}}>
          <div className="filter-group"><label>国家</label>
            <select value={selectedCountry || ''} onChange={e => setSelectedCountry(e.target.value || null)} className="filter-input" style={{minWidth:160}}>
              <option value="">选择国家...</option>
              {countryStats.entries.map(([c]) => <option key={c}>{c}（{countryStats.qtyMap[c]}件）</option>)}
            </select>
          </div>
          {selectedCountry && <button className="btn-outline-sm" onClick={() => setSelectedCountry(null)}>清除</button>}
        </div>
      </div>

      {/* 国家详情 */}
      {selectedCountry && (
        <>
          <div className="v2-kpi-section">
            <div className="v2-kpi-header">
              <span className="section-badge">🔍 {selectedCountry} 详情</span>
            </div>
            <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">订单数</span></div><div className="kpi-v2-value">{countryStats.orderMap[selectedCountry] || 0}</div></div>
              <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">出库量</span></div><div className="kpi-v2-value">{countryStats.qtyMap[selectedCountry]?.toLocaleString() || 0}</div></div>
              <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">占比</span></div><div className="kpi-v2-value">{totalQty > 0 ? ((countryStats.qtyMap[selectedCountry] / totalQty) * 100).toFixed(1) + '%' : '-'}</div></div>
              <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏷️</span><span className="kpi-v2-label">SKU 种类</span></div><div className="kpi-v2-value">{countrySkuStats.length}</div></div>
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">近30天出库趋势</div>
              <ReactECharts option={getTrendOption(countryTrend.labels, countryTrend.values, '#f97316')} style={{height:220}} opts={{renderer:'svg'}} />
            </div>
            <div className="chart-card">
              <div className="chart-title">品类占比</div>
              <ReactECharts option={getPieOption(countryCatStats.slice(0, 8).map(([c, v]) => ({name: c, value: v})))} style={{height:220}} opts={{renderer:'svg'}} />
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">热销 SKU TOP 20</div>
              <div className="cd-sku-list" style={{maxHeight:400}}>
                {countrySkuStats.slice(0, 20).map(([sku, qty], i) => (
                  <div key={i} className="cd-sku-item">
                    <span className="cd-sku-idx">{i + 1}</span>
                    <span className="cd-sku-name">{sku}</span>
                    <span className="cd-sku-val">{qty}件</span>
                  </div>
                ))}
                {countrySkuStats.length === 0 && <p className="empty-sm">暂无 SKU 数据</p>}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">品类排行</div>
              <div style={{height: Math.max(200, countryCatStats.length * 36)}}>
                <ReactECharts option={getBarOption(countryCatStats.map(([c]) => c), countryCatStats.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          </div>

          {/* 经营建议 */}
          {countryAdvice.length > 0 && (
            <div className="cd-ai-section">
              <h4>🧠 {selectedCountry} 经营建议</h4>
              <p className="cd-ai-text">
                {countryAdvice.map((a, i) => (
                  <span key={i}>{a}<br /></span>
                ))}
              </p>
            </div>
          )}
        </>
      )}

      {!hasData && <div className="empty-state">📭 暂无数据，请先导入订单</div>}
    </div>
  )
}