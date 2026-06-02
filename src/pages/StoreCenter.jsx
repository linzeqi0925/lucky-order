/**
 * 店铺分析中心 V2
 *
 * 数据源：orders（店铺维度）+ order_items（SKU维度）
 * 模块：
 *   1. 店铺排行榜
 *   2. 店铺趋势（30/90天）
 *   3. 店铺 SKU 排行
 *   4. 店铺品类分析
 *   5. 店铺预警（订单/SKU/品类下降）
 */

import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { getBarOption, getTrendOption, getPieOption, COLORS } from '../lib/charts'

export default function StoreCenter({ orders, orderItems }) {
  const [selectedStore, setSelectedStore] = useState(null)

  const orderDateMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o.order_date })
    return map
  }, [orders])

  const itemsWithDate = useMemo(() => {
    if (!orderItems?.length) return []
    return orderItems.map(item => ({ ...item, order_date: orderDateMap[item.order_no] || '' }))
  }, [orderItems, orderDateMap])

  // ============================
  // 模块 1：店铺排行榜
  // ============================
  const storeStats = useMemo(() => {
    const qtyMap = {}, orderMap = {}
    let totalQty = 0
    orders.forEach(o => {
      const s = o.store_name || '未知店铺'
      qtyMap[s] = (qtyMap[s] || 0) + o.quantity
      orderMap[s] = (orderMap[s] || 0) + 1
      totalQty += o.quantity
    })
    return Object.entries(qtyMap).sort((a, b) => b[1] - a[1]).map(([s, qty]) => ({
      store: s, qty, orders: orderMap[s] || 0, pct: totalQty > 0 ? ((qty / totalQty) * 100).toFixed(1) : 0
    }))
  }, [orders])

  // ============================
  // 模块 2：店铺趋势
  // ============================
  const storeTrend = useMemo(() => {
    if (!selectedStore) return { labels30: [], values30: [], labels90: [], values90: [] }
    const now = new Date()
    const map30 = {}, map90 = {}
    for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); map30[d.toISOString().split('T')[0]] = 0 }
    for (let i = 89; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); map90[d.toISOString().split('T')[0]] = 0 }
    orders.filter(o => o.store_name === selectedStore).forEach(o => {
      if (map30[o.order_date] !== undefined) map30[o.order_date] += o.quantity
      if (map90[o.order_date] !== undefined) map90[o.order_date] += o.quantity
    })
    const e30 = Object.entries(map30), e90 = Object.entries(map90)
    return {
      labels30: e30.filter((_, i) => i % 5 === 0).map(([d]) => d.slice(5)),
      values30: e30.map(([, v]) => v),
      labels90: e90.filter((_, i) => i % 10 === 0).map(([d]) => d.slice(5)),
      values90: e90.map(([, v]) => v),
    }
  }, [orders, selectedStore])

  // ============================
  // 模块 3：店铺 SKU 排行
  // ============================
  const storeSkuStats = useMemo(() => {
    if (!selectedStore) return []
    const skuMap = {}
    const storeOrderNos = new Set(orders.filter(o => o.store_name === selectedStore).map(o => o.order_no))
    itemsWithDate.filter(i => storeOrderNos.has(i.order_no)).forEach(i => {
      const sku = i.sku || '未知'
      skuMap[sku] = (skuMap[sku] || 0) + i.quantity
    })
    return Object.entries(skuMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [orders, itemsWithDate, selectedStore])

  // ============================
  // 模块 4：店铺品类分析
  // ============================
  const storeCatStats = useMemo(() => {
    if (!selectedStore) return []
    const catMap = {}
    orders.filter(o => o.store_name === selectedStore).forEach(o => {
      const cat = o.product_category || '未分类'
      catMap[cat] = (catMap[cat] || 0) + o.quantity
    })
    return Object.entries(catMap).sort((a, b) => b[1] - a[1])
  }, [orders, selectedStore])

  // ============================
  // 模块 5：店铺预警
  // ============================
  const storeAlerts = useMemo(() => {
    const alerts = []
    if (!selectedStore) return alerts

    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const s30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const s60 = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0]

    const cur = orders.filter(o => o.store_name === selectedStore && o.order_date >= s30 && o.order_date <= end)
    const prev = orders.filter(o => o.store_name === selectedStore && o.order_date >= s60 && o.order_date < s30)

    const curQty = cur.reduce((s, o) => s + o.quantity, 0)
    const prevQty = prev.reduce((s, o) => s + o.quantity, 0)
    if (prevQty > 0) {
      const change = ((curQty - prevQty) / prevQty * 100).toFixed(1)
      if (change < -20) alerts.push({ type: 'order', text: `📉 出库量下降 ${change}%，请检查运营状况` })
    }

    // SKU 下降
    const storeOrderNos = new Set(orders.filter(o => o.store_name === selectedStore).map(o => o.order_no))
    const curSku = {}, prevSku = {}
    itemsWithDate.filter(i => storeOrderNos.has(i.order_no) && i.order_date >= s30 && i.order_date <= end).forEach(i => {
      curSku[i.sku] = (curSku[i.sku] || 0) + i.quantity
    })
    itemsWithDate.filter(i => storeOrderNos.has(i.order_no) && i.order_date >= s60 && i.order_date < s30).forEach(i => {
      prevSku[i.sku] = (prevSku[i.sku] || 0) + i.quantity
    })
    Object.entries(prevSku).forEach(([sku, pv]) => {
      const cv = curSku[sku] || 0
      if (pv > 2 && cv < pv * 0.5) {
        alerts.push({ type: 'sku', text: `⚠️ SKU ${sku} 出库下降超 50%（${pv}→${cv}）` })
      }
    })

    // 品类下降
    const curCat = {}, prevCat = {}
    cur.forEach(o => { const c = o.product_category || '未分类'; curCat[c] = (curCat[c] || 0) + o.quantity })
    prev.forEach(o => { const c = o.product_category || '未分类'; prevCat[c] = (prevCat[c] || 0) + o.quantity })
    Object.entries(prevCat).forEach(([cat, pv]) => {
      const cv = curCat[cat] || 0
      if (pv > 3 && cv < pv * 0.5) {
        alerts.push({ type: 'cat', text: `⚠️ ${cat}品类出库下降超 50%（${pv}→${cv}）` })
      }
    })

    return alerts
  }, [orders, orderItems, itemsWithDate, selectedStore])

  const hasData = orders.length > 0

  return (
    <div className="dashboard-view">
      {/* KPI */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">🏪 店铺分析中心</span></div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏪</span><span className="kpi-v2-label">运营店铺</span></div><div className="kpi-v2-value">{storeStats.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏆</span><span className="kpi-v2-label">最佳店铺</span></div><div className="kpi-v2-value">{storeStats[0]?.store || '-'}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">总出库量</span></div><div className="kpi-v2-value">{storeStats.reduce((s, st) => s + st.qty, 0).toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">总订单</span></div><div className="kpi-v2-value">{storeStats.reduce((s, st) => s + st.orders, 0).toLocaleString()}</div></div>
        </div>
      </div>

      {/* 店铺排行 */}
      <div className="chart-row">
        <div className="chart-card">
          <div className="chart-title">店铺出库排行</div>
          <div style={{height: Math.max(200, storeStats.length * 42)}}>
            <ReactECharts option={getBarOption(storeStats.map(s => s.store), storeStats.map(s => s.qty), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">店铺占比</div>
          <ReactECharts option={getPieOption(storeStats.slice(0, 8).map(s => ({name: s.store, value: s.qty})))} style={{height:260}} opts={{renderer:'svg'}} />
        </div>
      </div>

      {/* 店铺明细表 */}
      <div className="chart-card wide">
        <div className="chart-title">店铺明细</div>
        <div className="table-wrap" style={{marginTop:12}}>
          <table className="order-table">
            <thead><tr><th>#</th><th>店铺名称</th><th>订单数</th><th>出库量</th><th>占比</th><th>操作</th></tr></thead>
            <tbody>
              {storeStats.map((s, i) => (
                <tr key={s.store}>
                  <td>{i + 1}</td>
                  <td><strong>{s.store}</strong></td>
                  <td>{s.orders}</td>
                  <td>{s.qty.toLocaleString()}</td>
                  <td>{s.pct}%</td>
                  <td><button className="btn-outline-sm" onClick={() => setSelectedStore(s.store)}>查看详情</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 店铺详情 */}
      {selectedStore && (
        <>
          <div className="v2-kpi-section">
            <div className="v2-kpi-header">
              <span className="section-badge">🔍 {selectedStore} 详情</span>
              <button className="btn-outline-sm" onClick={() => setSelectedStore(null)}>关闭</button>
            </div>

            {/* 预警 */}
            {storeAlerts.length > 0 && (
              <div className="v2-ai-section" style={{border:'1px solid #fecaca',background:'linear-gradient(135deg,#fef2f2,#fee2e2)',marginBottom:16}}>
                <h4 style={{fontSize:14,fontWeight:600,marginBottom:8}}>🚨 店铺预警</h4>
                {storeAlerts.map((a, i) => (
                  <p key={i} style={{fontSize:13,color:'#991b1b',marginBottom:4}}>{a.text}</p>
                ))}
                {storeAlerts.length === 0 && <p style={{fontSize:13,color:'#166534'}}>✅ 无异常</p>}
              </div>
            )}
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">近30天出库趋势</div>
              <ReactECharts option={getTrendOption(storeTrend.labels30, storeTrend.values30, '#f97316')} style={{height:200}} opts={{renderer:'svg'}} />
            </div>
            <div className="chart-card">
              <div className="chart-title">近90天出库趋势</div>
              <ReactECharts option={getTrendOption(storeTrend.labels90, storeTrend.values90, '#f97316')} style={{height:200}} opts={{renderer:'svg'}} />
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">热销 SKU TOP 20</div>
              <div className="cd-sku-list" style={{maxHeight:400}}>
                {storeSkuStats.slice(0, 20).map(([sku, qty], i) => (
                  <div key={i} className="cd-sku-item">
                    <span className="cd-sku-idx">{i + 1}</span>
                    <span className="cd-sku-name">{sku}</span>
                    <span className="cd-sku-val">{qty}件</span>
                  </div>
                ))}
                {storeSkuStats.length === 0 && <p className="empty-sm">暂无 SKU 数据</p>}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">品类占比</div>
              <ReactECharts option={getPieOption(storeCatStats.slice(0, 8).map(([c, v]) => ({name: c, value: v})))} style={{height:220}} opts={{renderer:'svg'}} />
            </div>
          </div>

          <div className="chart-card wide">
            <div className="chart-title">品类出库排行</div>
            <div style={{height: Math.max(200, storeCatStats.length * 36)}}>
              <ReactECharts option={getBarOption(storeCatStats.map(([c]) => c), storeCatStats.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
            </div>
          </div>
        </>
      )}

      {!hasData && <div className="empty-state">📭 暂无店铺数据</div>}
    </div>
  )
}