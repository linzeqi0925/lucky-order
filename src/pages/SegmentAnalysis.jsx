import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { getBarOption, getPieOption, getTrendOption } from '../lib/charts'

export default function SegmentAnalysis({ orders, orderItems }) {
  const [filters, setFilters] = useState({
    start: '',
    end: '',
    store: '',
    country: '',
    category: '',
    sku: '',
  })

  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o })
    return map
  }, [orders])

  const itemsWithMeta = useMemo(() => {
    return (orderItems || []).map(item => ({
      ...item,
      order: orderMap[item.order_no],
      order_date: orderMap[item.order_no]?.order_date || '',
      store_name: orderMap[item.order_no]?.store_name || '',
      country: orderMap[item.order_no]?.country || '',
      category: orderMap[item.order_no]?.product_category || '未分类',
    }))
  }, [orderItems, orderMap])

  const filteredOrders = useMemo(() => {
    const skuOrderNos = filters.sku
      ? new Set(itemsWithMeta.filter(i => i.sku === filters.sku).map(i => i.order_no))
      : null

    return orders.filter(o => {
      if (filters.start && o.order_date < filters.start) return false
      if (filters.end && o.order_date > filters.end) return false
      if (filters.store && o.store_name !== filters.store) return false
      if (filters.country && o.country !== filters.country) return false
      if (filters.category && (o.product_category || '未分类') !== filters.category) return false
      if (skuOrderNos && !skuOrderNos.has(o.order_no)) return false
      return true
    })
  }, [orders, filters, itemsWithMeta])

  const filteredOrderNos = useMemo(() => new Set(filteredOrders.map(o => o.order_no)), [filteredOrders])
  const filteredItems = useMemo(() => {
    return itemsWithMeta.filter(item => {
      if (!filteredOrderNos.has(item.order_no)) return false
      if (filters.sku && item.sku !== filters.sku) return false
      return true
    })
  }, [itemsWithMeta, filteredOrderNos, filters.sku])

  const options = useMemo(() => ({
    stores: [...new Set(orders.map(o => o.store_name).filter(Boolean))].sort(),
    countries: [...new Set(orders.map(o => o.country).filter(Boolean))].sort(),
    categories: [...new Set(orders.map(o => o.product_category || '未分类').filter(Boolean))].sort(),
    skus: [...new Set((orderItems || []).map(i => i.sku).filter(Boolean))].sort(),
  }), [orders, orderItems])

  const rank = (list, keyFn, qtyFn = x => x.quantity || 0) => {
    const map = {}
    list.forEach(item => {
      const key = keyFn(item) || '未知'
      map[key] = (map[key] || 0) + qtyFn(item)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  const storeRank = rank(filteredOrders, o => o.store_name)
  const countryRank = rank(filteredOrders, o => o.country)
  const categoryRank = rank(filteredOrders, o => o.product_category || '未分类')
  const skuRank = rank(filteredItems, i => i.sku, i => i.quantity || 0)

  const totalQty = filteredOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
  const trend = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      if (!o.order_date) return
      map[o.order_date] = (map[o.order_date] || 0) + (o.quantity || 0)
    })
    const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
    return {
      labels: entries.map(([d]) => d.slice(5)),
      values: entries.map(([, v]) => v),
    }
  }, [filteredOrders])

  const suggestions = useMemo(() => {
    const list = []
    const topSku = skuRank[0]
    const topStore = storeRank[0]
    const topCountry = countryRank[0]
    const topCategory = categoryRank[0]
    const unclassified = categoryRank.find(([name]) => name === '未分类')?.[1] || 0

    if (filteredOrders.length === 0) return ['当前筛选条件下没有数据，可以放宽时间或维度。']
    if (topSku) list.push(`重点关注 SKU「${topSku[0]}」，它在当前范围贡献 ${topSku[1]} 件。`)
    if (topStore && topCountry) list.push(`当前主力组合是「${topStore[0]} × ${topCountry[0]}」，适合单独做库存和广告复盘。`)
    if (topCategory) list.push(`当前主力品类是「${topCategory[0]}」，可继续下钻到 SKU 看是否由单品拉动。`)
    if (unclassified > 0) list.push(`仍有 ${unclassified} 件未分类，建议先完善分类规则，否则品类分析会失真。`)
    if (skuRank.length > 0 && skuRank[0][1] / Math.max(1, totalQty) > 0.35) list.push('当前范围较依赖单个 SKU，建议检查是否存在爆品依赖或断货风险。')
    if (countryRank.length > 1) list.push('国家分布不止一个市场，可以对比不同国家的 TOP SKU，判断是否需要差异化备货。')

    return list
  }, [filteredOrders.length, skuRank, storeRank, countryRank, categoryRank, totalQty])

  const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const clear = () => setFilters({ start: '', end: '', store: '', country: '', category: '', sku: '' })

  return (
    <div className="dashboard-view">
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">🔎 局部筛选分析</span></div>
        <div className="filter-bar">
          <div className="filter-group"><label>时间</label><input className="filter-input" type="date" value={filters.start} onChange={e => set('start', e.target.value)} /><span className="filter-sep">—</span><input className="filter-input" type="date" value={filters.end} onChange={e => set('end', e.target.value)} /></div>
          <div className="filter-group"><label>店铺</label><select className="filter-input" value={filters.store} onChange={e => set('store', e.target.value)}><option value="">全部</option>{options.stores.map(v => <option key={v}>{v}</option>)}</select></div>
          <div className="filter-group"><label>国家</label><select className="filter-input" value={filters.country} onChange={e => set('country', e.target.value)}><option value="">全部</option>{options.countries.map(v => <option key={v}>{v}</option>)}</select></div>
          <div className="filter-group"><label>品类</label><select className="filter-input" value={filters.category} onChange={e => set('category', e.target.value)}><option value="">全部</option>{options.categories.map(v => <option key={v}>{v}</option>)}</select></div>
          <div className="filter-group"><label>SKU</label><select className="filter-input" value={filters.sku} onChange={e => set('sku', e.target.value)}><option value="">全部</option>{options.skus.slice(0, 500).map(v => <option key={v}>{v}</option>)}</select></div>
          <button className="btn-clear" onClick={clear}>清除</button>
        </div>
      </div>

      <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">订单</span></div><div className="kpi-v2-value">{filteredOrders.length}</div></div>
        <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">出库量</span></div><div className="kpi-v2-value">{totalQty}</div></div>
        <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏪</span><span className="kpi-v2-label">店铺</span></div><div className="kpi-v2-value">{storeRank.length}</div></div>
        <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🌍</span><span className="kpi-v2-label">国家</span></div><div className="kpi-v2-value">{countryRank.length}</div></div>
        <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏷️</span><span className="kpi-v2-label">SKU</span></div><div className="kpi-v2-value">{skuRank.length}</div></div>
      </div>

      <div className="chart-row">
        <div className="chart-card wide">
          <div className="chart-title">当前范围出库趋势</div>
          <ReactECharts option={getTrendOption(trend.labels, trend.values, '#0f766e')} style={{height:260}} opts={{renderer:'svg'}} />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-card"><div className="chart-title">SKU TOP 15</div><div style={{height:Math.max(220, skuRank.slice(0, 15).length * 32)}}><ReactECharts option={getBarOption(skuRank.slice(0, 15).map(([k]) => k), skuRank.slice(0, 15).map(([, v]) => v), '#8b5cf6')} style={{height:'100%'}} opts={{renderer:'svg'}} /></div></div>
        <div className="chart-card"><div className="chart-title">品类占比</div><ReactECharts option={getPieOption(categoryRank.slice(0, 8).map(([name, value]) => ({ name, value })))} style={{height:260}} opts={{renderer:'svg'}} /></div>
      </div>

      <div className="chart-row">
        <div className="chart-card"><div className="chart-title">店铺排行</div><div style={{height:Math.max(220, storeRank.length * 34)}}><ReactECharts option={getBarOption(storeRank.map(([k]) => k), storeRank.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} /></div></div>
        <div className="chart-card"><div className="chart-title">国家排行</div><div style={{height:Math.max(220, countryRank.length * 34)}}><ReactECharts option={getBarOption(countryRank.map(([k]) => k), countryRank.map(([, v]) => v), '#2563eb')} style={{height:'100%'}} opts={{renderer:'svg'}} /></div></div>
      </div>

      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">运营建议</span></div>
        <div className="ai-alert-group">
          {suggestions.map((text, index) => (
            <div className="ai-alert-item" key={index}>
              <span className="ai-alert-icon">•</span>
              <span className="ai-alert-text">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
