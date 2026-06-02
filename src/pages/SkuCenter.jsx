/**
 * SKU 分析中心 V2
 *
 * 数据源：order_items（禁止从 orders.product_sku 回退）
 * 模块：
 *   1. SKU 排行榜（7/30/90天/全部）
 *   2. SKU 趋势分析（折线图 + 单 SKU 钻取）
 *   3. 爆款 SKU（增长率 TOP20）
 *   4. 滞销 SKU（下降超 30% 预警）
 *   5. 新品观察（首次出现时间追踪）
 */

import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { COLORS, getBarOption, getTrendOption } from '../lib/charts'

export default function SkuCenter({ orders, orderItems }) {
  const [activeTab, setActiveTab] = useState('ranking')
  const [trendDays, setTrendDays] = useState(30)
  const [selectedSku, setSelectedSku] = useState(null)
  const [rankDays, setRankDays] = useState('all')

  // 建立 order_no → order_date 的映射
  const orderDateMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o.order_date })
    return map
  }, [orders])

  // 带日期的 items 视图
  const itemsWithDate = useMemo(() => {
    if (!orderItems?.length) return []
    return orderItems
      .filter(item => item.sku && item.sku.trim())
      .map(item => ({
        ...item,
        order_date: orderDateMap[item.order_no] || '',
      }))
  }, [orderItems, orderDateMap])

  // ============================
  // 工具：按天数字段数
  // ============================
  const filterByDays = (items, days) => {
    if (days === 'all' || !days) return items
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return items.filter(item => item.order_date && new Date(item.order_date) >= cutoff)
  }

  // 获取日期范围
  const getDateRange = (days) => {
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString().split('T')[0]
    return { start, end, prevStart }
  }

  // ============================
  // 模块 1：SKU 排行榜
  // ============================
  const skuRankings = useMemo(() => {
    const filtered = filterByDays(itemsWithDate, rankDays === 'all' ? null : rankDays)
    const map = {}
    filtered.forEach(item => {
      const sku = item.sku
      if (!map[sku]) map[sku] = { sku, qty: 0, orderCount: 0, productName: item.product_name || '' }
      map[sku].qty += item.quantity
      map[sku].orderCount++
    })
    const sorted = Object.values(map).sort((a, b) => b.qty - a.qty)
    const totalQty = sorted.reduce((s, sku) => s + sku.qty, 0)
    return { list: sorted.slice(0, 20), total: sorted.length, totalQty }
  }, [itemsWithDate, rankDays])

  // ============================
  // 模块 2：SKU 趋势
  // ============================
  const skuTrend = useMemo(() => {
    const now = new Date()
    const dayMap = {}
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    itemsWithDate.forEach(item => {
      if (dayMap[item.order_date] !== undefined) dayMap[item.order_date] += item.quantity
    })
    const entries = Object.entries(dayMap)
    return {
      labels: entries.map(([d]) => d.slice(5)),
      values: entries.map(([, v]) => v),
      raw: entries,
    }
  }, [itemsWithDate, trendDays])

  // 单个 SKU 趋势（点击钻取）
  const singleSkuTrend = useMemo(() => {
    if (!selectedSku) return { labels: [], values: [] }
    const now = new Date()
    const dayMap = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    itemsWithDate
      .filter(item => item.sku === selectedSku)
      .forEach(item => {
        if (dayMap[item.order_date] !== undefined) dayMap[item.order_date] += item.quantity
      })
    const entries = Object.entries(dayMap)
    return { labels: entries.map(([d]) => d.slice(5)), values: entries.map(([, v]) => v) }
  }, [itemsWithDate, selectedSku])

  // ============================
  // 模块 3：爆款 SKU
  // ============================
  const hotSkus = useMemo(() => {
    const { start, end, prevStart } = getDateRange(30)
    const cur = itemsWithDate.filter(i => i.order_date >= start && i.order_date <= end)
    const prev = itemsWithDate.filter(i => i.order_date >= prevStart && i.order_date < start)

    const curMap = {}, prevMap = {}
    cur.forEach(i => { curMap[i.sku] = (curMap[i.sku] || 0) + i.quantity })
    prev.forEach(i => { prevMap[i.sku] = (prevMap[i.sku] || 0) + i.quantity })

    const allSkus = new Set([...Object.keys(curMap), ...Object.keys(prevMap)])
    const result = []
    allSkus.forEach(sku => {
      const cv = curMap[sku] || 0
      const pv = prevMap[sku] || 0
      const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
      if (pv > 0 && cv > pv) {
        const growth = ((cv - pv) / pv * 100).toFixed(1)
        result.push({ sku, productName: pName, growth: parseFloat(growth), cur: cv, prev: pv })
      }
    })
    return result.sort((a, b) => b.growth - a.growth).slice(0, 20)
  }, [itemsWithDate])

  // ============================
  // 模块 4：滞销 SKU
  // ============================
  const slowSkus = useMemo(() => {
    const { start, end, prevStart } = getDateRange(30)
    const cur = itemsWithDate.filter(i => i.order_date >= start && i.order_date <= end)
    const prev = itemsWithDate.filter(i => i.order_date >= prevStart && i.order_date < start)

    const curMap = {}, prevMap = {}
    cur.forEach(i => { curMap[i.sku] = (curMap[i.sku] || 0) + i.quantity })
    prev.forEach(i => { prevMap[i.sku] = (prevMap[i.sku] || 0) + i.quantity })

    const allSkus = new Set([...Object.keys(curMap), ...Object.keys(prevMap)])
    const result = []
    allSkus.forEach(sku => {
      const cv = curMap[sku] || 0
      const pv = prevMap[sku] || 0
      const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
      if (pv > 2 && cv < pv * 0.7) {
        const decline = ((pv - cv) / pv * 100).toFixed(1)
        result.push({ sku, productName: pName, decline: parseFloat(decline), cur: cv, prev: pv })
      }
    })
    return result.sort((a, b) => b.decline - a.decline).slice(0, 20)
  }, [itemsWithDate])

  // ============================
  // 模块 5：新品观察
  // ============================
  const newProducts = useMemo(() => {
    const firstAppear = {}
    itemsWithDate.forEach(item => {
      if (!item.order_date) return
      if (!firstAppear[item.sku] || item.order_date < firstAppear[item.sku]) {
        firstAppear[item.sku] = item.order_date
      }
    })

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    const skuFirstMap = {}
    Object.entries(firstAppear).forEach(([sku, date]) => {
      if (!skuFirstMap[sku]) skuFirstMap[sku] = date
    })

    const result = []
    Object.entries(skuFirstMap).forEach(([sku, firstDate]) => {
      if (firstDate >= thirtyDaysAgo) {
        const totalQty = itemsWithDate.filter(i => i.sku === sku).reduce((s, i) => s + i.quantity, 0)
        const recentQty = itemsWithDate.filter(i => i.sku === sku && i.order_date >= sevenDaysAgo).reduce((s, i) => s + i.quantity, 0)
        const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
        // 成长趋势：近7天 vs 前7天
        const firstWeekEnd = new Date(new Date(firstDate).getTime() + 7 * 86400000).toISOString().split('T')[0]
        const firstWeek = itemsWithDate.filter(i => i.sku === sku && i.order_date >= firstDate && i.order_date <= firstWeekEnd).reduce((s, i) => s + i.quantity, 0)
        const secondWeek = itemsWithDate.filter(i => i.sku === sku && i.order_date > firstWeekEnd).reduce((s, i) => s + i.quantity, 0)
        const trend = secondWeek > firstWeek ? '📈 增长' : secondWeek < firstWeek ? '📉 下降' : '➡️ 平稳'
        result.push({ sku, productName: pName, firstDate, totalQty, recentQty, trend })
      }
    })
    return result.sort((a, b) => b.totalQty - a.totalQty)
  }, [itemsWithDate])

  const hasData = itemsWithDate.length > 0

  // ============================
  // 渲染
  // ============================
  return (
    <div className="dashboard-view">
      {/* SKU KPI */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">📦 SKU 分析中心</span></div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏷️</span><span className="kpi-v2-label">SKU 种类</span></div><div className="kpi-v2-value">{skuRankings.total}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">总出库量</span></div><div className="kpi-v2-value">{skuRankings.totalQty.toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🔥</span><span className="kpi-v2-label">爆款</span></div><div className="kpi-v2-value">{hotSkus.length}个</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">⚠️</span><span className="kpi-v2-label">滞销预警</span></div><div className="kpi-v2-value" style={{color:'#dc2626'}}>{slowSkus.length}个</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🆕</span><span className="kpi-v2-label">新品观察</span></div><div className="kpi-v2-value">{newProducts.length}个</div></div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="tab-bar">
        {[
          ['ranking', '排行榜'],
          ['trend', '趋势分析'],
          ['hot', '爆款 SKU'],
          ['slow', '滞销预警'],
          ['new', '新品观察'],
        ].map(([k, v]) => (
          <button key={k} className={`tab-pill ${activeTab === k ? 'active' : ''}`} onClick={() => { setActiveTab(k); setSelectedSku(null) }}>{v}</button>
        ))}
      </div>

      {!hasData && <div className="empty-state">📭 暂无 SKU 数据，请先导入订单</div>}

      {/* ===== 模块 1：排行榜 ===== */}
      {activeTab === 'ranking' && hasData && (
        <div className="tab-content">
          <div className="filter-bar">
            <div className="filter-group"><label>时间范围</label>
              {[{k:'all',v:'全部'},{k:90,v:'近90天'},{k:30,v:'近30天'},{k:7,v:'近7天'}].map(({k,v}) => (
                <button key={k} className={`trend-tab ${rankDays === k ? 'active' : ''}`}
                  onClick={() => setRankDays(k)} style={{marginRight:4}}>{v}</button>
              ))}
            </div>
            <div className="filter-count"><strong>{skuRankings.list.length}</strong> / {skuRankings.total} SKU</div>
          </div>
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">TOP 20 SKU 出库排行</div>
              <div style={{height: Math.max(200, skuRankings.list.length * 32)}}>
                <ReactECharts option={getBarOption(skuRankings.list.map(s => s.sku), skuRankings.list.map(s => s.qty), '#8b5cf6')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">TOP 20 占比</div>
              <ReactECharts option={{
                tooltip: { trigger: 'item', formatter: '{b}: {c}件 ({d}%)' },
                series: [{
                  type: 'pie', radius: ['30%', '55%'],
                  data: skuRankings.list.slice(0, 10).map((s, i) => ({
                    name: s.sku, value: s.qty,
                    itemStyle: { color: COLORS[i % COLORS.length] }
                  })),
                  label: { fontSize: 10, formatter: '{b}\n{d}%' },
                }]
              }} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          <div className="chart-card wide">
            <div className="chart-title">SKU 明细清单</div>
            <div className="table-wrap" style={{marginTop:12}}>
              <table className="order-table">
                <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>出库量</th><th>订单数</th><th>占比</th></tr></thead>
                <tbody>
                  {skuRankings.list.map((s, i) => (
                    <tr key={s.sku} style={{cursor:'pointer'}} onClick={() => { setSelectedSku(s.sku); setActiveTab('trend') }}
                      title="点击查看趋势">
                      <td>{i + 1}</td>
                      <td><span className="orderno">{s.sku}</span></td>
                      <td>{s.productName || '-'}</td>
                      <td>{s.qty.toLocaleString()}</td>
                      <td>{s.orderCount}</td>
                      <td>{skuRankings.totalQty > 0 ? ((s.qty / skuRankings.totalQty) * 100).toFixed(1) + '%' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== 模块 2：趋势分析 ===== */}
      {activeTab === 'trend' && hasData && (
        <div className="tab-content">
          <div className="filter-bar">
            <div className="filter-group"><label>天数</label>
              {[7, 30, 90].map(d => (
                <button key={d} className={`trend-tab ${trendDays === d ? 'active' : ''}`}
                  onClick={() => setTrendDays(d)} style={{marginRight:4}}>{d}天</button>
              ))}
            </div>
            {selectedSku && (
              <div className="filter-group">
                <label>选中 SKU：<strong style={{color:'#6366f1'}}>{selectedSku}</strong></label>
                <button className="btn-outline-sm" onClick={() => setSelectedSku(null)}>清除</button>
              </div>
            )}
          </div>
          <div className="chart-card wide">
            <div className="chart-title">{selectedSku ? `📈 ${selectedSku} 近30天出库趋势` : '📈 全部 SKU 出库趋势'}</div>
            <ReactECharts
              option={getTrendOption(
                selectedSku ? singleSkuTrend.labels : skuTrend.labels,
                selectedSku ? singleSkuTrend.values : skuTrend.values,
                '#8b5cf6'
              )}
              style={{height:300}} opts={{renderer:'svg'}} />
          </div>
          {!selectedSku && (
            <div className="chart-card wide">
              <div className="chart-title">点击下方 SKU 查看单个趋势</div>
              <div className="table-wrap" style={{marginTop:12}}>
                <table className="order-table">
                  <thead><tr><th>SKU</th><th>产品名称</th><th>总出库量</th><th>操作</th></tr></thead>
                  <tbody>
                    {skuRankings.list.slice(0, 15).map(s => (
                      <tr key={s.sku}>
                        <td><span className="orderno">{s.sku}</span></td>
                        <td>{s.productName || '-'}</td>
                        <td>{s.qty.toLocaleString()}</td>
                        <td><button className="btn-outline-sm" onClick={() => setSelectedSku(s.sku)}>查看趋势</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 模块 3：爆款 SKU ===== */}
      {activeTab === 'hot' && hasData && (
        <div className="tab-content">
          <div className="v2-ai-section" style={{border:'1px solid #bbf7d0',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)'}}>
            <p style={{fontSize:13,color:'#166534'}}>🔥 近30天 vs 前30天出库量对比，增长最快的 TOP 20 SKU</p>
          </div>
          {hotSkus.length === 0 ? <div className="empty-state">暂无爆款数据</div> : (
            <div className="chart-card wide">
              <div className="chart-title">增长最快 SKU TOP 20</div>
              <div className="table-wrap" style={{marginTop:12}}>
                <table className="order-table">
                  <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>增长率</th><th>近30天</th><th>前30天</th><th>增量</th></tr></thead>
                  <tbody>
                    {hotSkus.map((s, i) => (
                      <tr key={s.sku}>
                        <td>{i + 1}</td>
                        <td><span className="orderno">{s.sku}</span></td>
                        <td>{s.productName || '-'}</td>
                        <td><span style={{color:'#16a34a',fontWeight:700}}>+{s.growth}%</span></td>
                        <td>{s.cur}</td>
                        <td>{s.prev}</td>
                        <td><span style={{color:'#16a34a'}}>+{s.cur - s.prev}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="chart-card wide">
            <div className="chart-title">增长最快 SKU 柱状图</div>
            <div style={{height: Math.max(200, hotSkus.slice(0, 10).length * 40)}}>
              <ReactECharts option={getBarOption(hotSkus.slice(0, 10).map(s => s.sku), hotSkus.slice(0, 10).map(s => s.growth), '#16a34a')} style={{height:'100%'}} opts={{renderer:'svg'}} />
            </div>
          </div>
        </div>
      )}

      {/* ===== 模块 4：滞销预警 ===== */}
      {activeTab === 'slow' && hasData && (
        <div className="tab-content">
          <div className="v2-ai-section" style={{border:'1px solid #fecaca',background:'linear-gradient(135deg,#fef2f2,#fee2e2)'}}>
            <p style={{fontSize:13,color:'#991b1b'}}>⚠️ 近30天 vs 前30天出库量下降超过 30% 的 SKU，请关注库存和广告调整</p>
          </div>
          {slowSkus.length === 0 ? (
            <div className="empty-state">✅ 无滞销预警，所有 SKU 表现正常</div>
          ) : (
            <div className="chart-card wide">
              <div className="chart-title">滞销预警 SKU</div>
              <div className="table-wrap" style={{marginTop:12}}>
                <table className="order-table">
                  <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>下降率</th><th>近30天</th><th>前30天</th><th>减少量</th></tr></thead>
                  <tbody>
                    {slowSkus.map((s, i) => (
                      <tr key={s.sku}>
                        <td>{i + 1}</td>
                        <td><span className="orderno">{s.sku}</span></td>
                        <td>{s.productName || '-'}</td>
                        <td><span style={{color:'#dc2626',fontWeight:700}}>-{s.decline}%</span></td>
                        <td>{s.cur}</td>
                        <td>{s.prev}</td>
                        <td><span style={{color:'#dc2626'}}>-{s.prev - s.cur}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {slowSkus.length > 0 && (
            <div className="chart-card wide">
              <div className="chart-title">滞销 SKU 下降幅度</div>
              <div style={{height: Math.max(200, slowSkus.slice(0, 10).length * 40)}}>
                <ReactECharts option={getBarOption(slowSkus.slice(0, 10).map(s => s.sku), slowSkus.slice(0, 10).map(s => s.decline), '#dc2626')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 模块 5：新品观察 ===== */}
      {activeTab === 'new' && hasData && (
        <div className="tab-content">
          <div className="v2-ai-section" style={{border:'1px solid #fde68a',background:'linear-gradient(135deg,#fffbeb,#fef3c7)'}}>
            <p style={{fontSize:13,color:'#92400e'}}>🆕 近30天内首次出现的 SKU，自动追踪成长趋势</p>
          </div>
          {newProducts.length === 0 ? <div className="empty-state">📭 近30天暂无新品</div> : (
            <div className="chart-card wide">
              <div className="chart-title">新品观察清单</div>
              <div className="table-wrap" style={{marginTop:12}}>
                <table className="order-table">
                  <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>上线日期</th><th>累计出库</th><th>近7天</th><th>成长趋势</th></tr></thead>
                  <tbody>
                    {newProducts.map((s, i) => (
                      <tr key={s.sku}>
                        <td>{i + 1}</td>
                        <td><span className="orderno">{s.sku}</span></td>
                        <td>{s.productName || '-'}</td>
                        <td>{s.firstDate}</td>
                        <td><strong>{s.totalQty}</strong></td>
                        <td>{s.recentQty}</td>
                        <td>{s.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {newProducts.length > 0 && (
            <div className="chart-card wide">
              <div className="chart-title">新品累计出库 TOP 10</div>
              <div style={{height: Math.max(200, newProducts.slice(0, 10).length * 40)}}>
                <ReactECharts option={getBarOption(newProducts.slice(0, 10).map(s => s.sku), newProducts.slice(0, 10).map(s => s.totalQty), '#eab308')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}