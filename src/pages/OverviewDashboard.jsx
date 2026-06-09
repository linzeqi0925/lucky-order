import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import HolidayBanner from '../components/HolidayBanner'
import KpiCard from '../components/KpiCard'
import MonitorCard from '../components/MonitorCard'
import FilterBar from '../components/FilterBar'
import OrderTable from '../components/OrderTable'
import CountryMap from '../components/CountryMap'
import {
  getBarOption, getPieOption, getTrendOption,
  getDayComp, getPeriodComp,
  findDrops, renderAIAlerts, renderAIGrowth,
} from '../lib/charts'

export default function OverviewDashboard({ orders, orderItems = [], loading, onRefresh }) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [drillCat, setDrillCat] = useState('')
  const [trendDays, setTrendDays] = useState(7)
  const [activeTab, setActiveTab] = useState('overview')
  const [compareMode, setCompareMode] = useState(false)
  const [period1, setPeriod1] = useState({ start: '', end: '' })
  const [period2, setPeriod2] = useState({ start: '', end: '' })

  const filtered = orders.filter(o => {
    if (filterCategory && o.product_category !== filterCategory) return false
    if (filterSupplier && o.supplier !== filterSupplier) return false
    if (filterStore && o.store_name !== filterStore) return false
    if (dateRange.start && o.order_date < dateRange.start) return false
    if (dateRange.end && o.order_date > dateRange.end) return false
    return true
  })
  const hasFilter = filterCategory || filterSupplier || filterStore || dateRange.start || dateRange.end

  const total = filtered.length
  const totalQty = filtered.reduce((s, o) => s + o.quantity, 0)
  const totalAmt = filtered.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)

  // 品类统计
  const catMap = {}
  filtered.forEach(o => {
    const cat = o.product_category || '未分类'
    if (!catMap[cat]) catMap[cat] = { count: 0, qty: 0, amount: 0 }
    catMap[cat].count++
    catMap[cat].qty += o.quantity
    catMap[cat].amount += parseFloat(o.total_amount || 0)
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1].qty - a[1].qty)

  // 状态统计
  const statusMap = {}
  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  filtered.forEach(o => { statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1 })

  // 供应商统计
  const supMap = {}
  filtered.forEach(o => { if (o.supplier) supMap[o.supplier] = (supMap[o.supplier] || 0) + o.quantity })
  const supSorted = Object.entries(supMap).sort((a, b) => b[1] - a[1])

  // 国家统计
  const countryMap = {}
  const provinceMap = {}
  filtered.forEach(o => {
    const c = o.country || ''
    const p = o.province || ''
    if (c) countryMap[c] = (countryMap[c] || 0) + o.quantity
    if (p) provinceMap[p] = (provinceMap[p] || 0) + o.quantity
  })
  const countrySorted = Object.entries(countryMap).sort((a, b) => b[1] - a[1])
  const provinceSorted = Object.entries(provinceMap).sort((a, b) => b[1] - a[1])

  // 店铺统计
  const storeMap = {}
  filtered.forEach(o => { const s = o.store_name; if (s) storeMap[s] = (storeMap[s] || 0) + o.quantity })
  const storeSorted = Object.entries(storeMap).sort((a, b) => b[1] - a[1])

  // SKU 统计
  const filteredOrderNos = new Set(filtered.map(o => o.order_no))
  const filteredItems = (orderItems || []).filter(item => filteredOrderNos.has(item.order_no))
  const skuMap = {}
  const skuOrderMap = {}
  filteredItems.forEach(item => {
    const sku = item.sku || '未知 SKU'
    if (!skuMap[sku]) skuMap[sku] = { sku, qty: 0, orderCount: 0, productName: item.product_name || '' }
    skuMap[sku].qty += item.quantity || 0
    if (!skuOrderMap[sku]) skuOrderMap[sku] = new Set()
    skuOrderMap[sku].add(item.order_no)
    if (item.product_name && !skuMap[sku].productName) skuMap[sku].productName = item.product_name
  })
  const skuSorted = Object.values(skuMap)
    .map(s => ({ ...s, orderCount: skuOrderMap[s.sku]?.size || s.orderCount }))
    .sort((a, b) => b.qty - a.qty)
  const topSkuQty = skuSorted[0]?.qty || 0
  const topSkuShare = totalQty > 0 ? (topSkuQty / totalQty * 100).toFixed(1) : 0

  // 交叉分析
  const topStores = storeSorted.slice(0, 6).map(([name]) => name)
  const topCountries = countrySorted.slice(0, 6).map(([name]) => name)
  const topCategories = catSorted.slice(0, 6).map(([name]) => name)
  const storeCountryMatrix = topStores.map(store => ({
    store,
    total: storeMap[store] || 0,
    values: topCountries.map(country => filtered
      .filter(o => o.store_name === store && o.country === country)
      .reduce((sum, o) => sum + o.quantity, 0)),
  }))
  const categoryStoreMatrix = topCategories.map(category => ({
    category,
    total: catMap[category]?.qty || 0,
    values: topStores.map(store => filtered
      .filter(o => (o.product_category || '未分类') === category && o.store_name === store)
      .reduce((sum, o) => sum + o.quantity, 0)),
  }))
  const maxMatrixValue = Math.max(
    1,
    ...storeCountryMatrix.flatMap(row => row.values),
    ...categoryStoreMatrix.flatMap(row => row.values),
  )
  const multiSkuOrders = Object.values(filteredItems.reduce((map, item) => {
    if (!map[item.order_no]) map[item.order_no] = 0
    map[item.order_no] += 1
    return map
  }, {})).filter(count => count > 1).length
  const concentrationTips = [
    storeSorted[0] ? `最大店铺 ${storeSorted[0][0]} 占出库量 ${((storeSorted[0][1] / Math.max(1, totalQty)) * 100).toFixed(1)}%` : '',
    countrySorted[0] ? `最大国家 ${countrySorted[0][0]} 占出库量 ${((countrySorted[0][1] / Math.max(1, totalQty)) * 100).toFixed(1)}%` : '',
    skuSorted[0] ? `最大 SKU ${skuSorted[0].sku} 占出库量 ${topSkuShare}%` : '',
    multiSkuOrders ? `${multiSkuOrders} 笔订单包含多个 SKU` : '',
  ].filter(Boolean)

  // 环比
  const period7 = getPeriodComp(orders, 7)
  const orderChange = period7 > 0 ? period7 : 0
  const qtyChange = getPeriodComp(orders, 7, 'qty')

  // 近7天趋势
  const now = new Date()
  const dayMap = {}
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dayMap[d.toISOString().split('T')[0]] = 0 }
  filtered.forEach(o => { if (dayMap[o.order_date] !== undefined) dayMap[o.order_date]++ })
  const dayEntries = Object.entries(dayMap)

  // 月度趋势
  const monthMap = {}
  filtered.forEach(o => {
    if (!o.order_date) return
    const m = o.order_date.slice(0, 7)
    monthMap[m] = (monthMap[m] || 0) + o.quantity
  })

  // 热力图
  const heatData = {}
  filtered.forEach(o => {
    if (!o.order_date) return
    const d = new Date(o.order_date)
    const dayOfWeek = d.getDay()
    const weekNum = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 604800000)
    const key = `${dayOfWeek}-${weekNum}`
    heatData[key] = (heatData[key] || 0) + o.quantity
  })
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六']
  const heatMax = Math.max(...Object.values(heatData), 1)

  // AI 洞察
  const aiDrops = {
    categories: findDrops(orders, o => o.product_category),
    stores: findDrops(orders, o => o.store_name),
    countries: findDrops(orders, o => o.country),
  }

  // 趋势
  const trendMap = {}
  for (let i = trendDays - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); trendMap[d.toISOString().split('T')[0]] = 0 }
  filtered.forEach(o => { if (trendMap[o.order_date] !== undefined) trendMap[o.order_date]++ })
  const trendLabels = Object.keys(trendMap).map(d => d.slice(5))
  const trendOrders = Object.values(trendMap)

  const clearFilters = () => { setDateRange({ start: '', end: '' }); setFilterCategory(''); setFilterSupplier(''); setFilterStore(''); setDrillCat('') }
  const handleCatClick = (cat) => { setFilterCategory(cat); setActiveTab('table') }
  const getPeriodStats = (start, end) => {
    const d = orders.filter(o => o.order_date >= start && o.order_date <= end)
    return { total: d.length, qty: d.reduce((s, o) => s + o.quantity, 0), amt: d.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) }
  }
  const getTrendDayMap = (all, days) => {
    const map = {}
    for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); map[d.toISOString().split('T')[0]] = 0 }
    all.forEach(o => { if (map[o.order_date] !== undefined) map[o.order_date]++ })
    return map
  }

  return (
    <div className="dashboard-view">
      <HolidayBanner />

      {/* 筛选器 */}
      <FilterBar
        orders={orders}
        dateRange={dateRange} setDateRange={setDateRange}
        filterCategory={filterCategory} setFilterCategory={setFilterCategory}
        filterSupplier={filterSupplier} setFilterSupplier={setFilterSupplier}
        filterStore={filterStore} setFilterStore={setFilterStore}
        total={total} onClear={clearFilters}
      />

      {/* KPI */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">📊 经营概览</span></div>
        <div className="v2-kpi-grid">
          <KpiCard icon="📦" label="总订单" value={total} fmt={v => v.toLocaleString()}
            yesterday={getDayComp(orders, 1)} week={getPeriodComp(orders, 7)} month={getPeriodComp(orders, 30)} />
          <KpiCard icon="💰" label="总销售额" value={totalAmt} fmt={v => `¥${v.toFixed(0)}`}
            yesterday={getDayComp(orders, 1, 'amount')} week={getPeriodComp(orders, 7, 'amount')} month={getPeriodComp(orders, 30, 'amount')} />
          <KpiCard icon="📊" label="总出库量" value={totalQty} fmt={v => v.toLocaleString()}
            yesterday={getDayComp(orders, 1, 'qty')} week={getPeriodComp(orders, 7, 'qty')} month={getPeriodComp(orders, 30, 'qty')} />
          <KpiCard icon="🎯" label="客单价" value={total > 0 ? totalAmt / total : 0} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard icon="🌍" label="覆盖国家" value={countrySorted.length} fmt={v => v.toString()} />
          <KpiCard icon="🏪" label="运营店铺" value={storeSorted.length} fmt={v => v.toString()} />
        </div>
      </div>

      {/* AI 洞察 */}
      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">🧠 AI 经营洞察</span></div>
        <div className="v2-ai-content">
          {total === 0 ? <div className="empty-sm">暂无数据，导入后自动生成洞察</div> : (
            <div className="v2-ai-grid">
              <div className="v2-ai-alerts">
                <h4>⚠️ 异常下降</h4>
                {renderAIAlerts(aiDrops.categories, '品类', '📦')}
                {renderAIAlerts(aiDrops.countries, '国家', '🌍')}
                {renderAIAlerts(aiDrops.stores, '店铺', '🏪')}
                {!aiDrops.categories.length && !aiDrops.countries.length && !aiDrops.stores.length &&
                  <p className="ai-good">✅ 各项指标平稳，无显著异常</p>}
              </div>
              <div className="v2-ai-growth">
                <h4>🔥 增长机会</h4>
                {renderAIGrowth(aiDrops.categories, '品类')}
                {renderAIGrowth(aiDrops.countries, '国家')}
                {!aiDrops.categories.length && !aiDrops.countries.length &&
                  <p className="ai-good">✅ 暂无突出增长点</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 全球地图 */}
      <div className="v2-map-section">
        <CountryMap orders={filtered} filters={dateRange} />
      </div>

      {/* 趋势 */}
      <div className="v2-trend-section">
        <div className="v2-section-header">
          <span className="section-badge">📈 销售趋势</span>
          <div className="trend-tabs">
            {[7, 30, 90].map(d => (
              <button key={d} className={`trend-tab ${trendDays === d ? 'active' : ''}`}
                onClick={() => setTrendDays(d)}>近{d}天</button>
            ))}
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-card wide">
            <div style={{height:260}}>
              <ReactECharts option={getTrendOption(trendLabels, trendOrders)} style={{height:'100%'}} opts={{renderer:'svg'}} />
            </div>
          </div>
        </div>
      </div>

      {/* 异常监控 */}
      <div className="v2-monitor-section">
        <div className="v2-section-header"><span className="section-badge">🚨 异常监控</span></div>
        <div className="v2-monitor-grid">
          <MonitorCard title="📦 下降最快品类" items={aiDrops.categories.slice(0, 3)} />
          <MonitorCard title="🏪 下降最快店铺" items={aiDrops.stores.slice(0, 3)} />
          <MonitorCard title="🌍 下降最快国家" items={aiDrops.countries.slice(0, 3)} />
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="tab-bar">
        {[
          ['overview', '品类'], ['trend', '趋势'], ['heatmap', '热力图'],
          ['sku', 'SKU'], ['matrix', '交叉分析'],
          ['store', '店铺'], ['country', '国家'], ['supplier', '供应商'],
          ['table', '明细'], ['ai', 'AI'],
        ].map(([k, v]) => (
          <button key={k} className={`tab-pill ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{v}</button>
        ))}
      </div>

      {/* 品类 */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card clickable" onClick={() => catSorted.length > 0 && handleCatClick(catSorted[0][0])}>
              <div className="chart-title">品类出库排行 <span className="chart-hint">点击查看明细</span></div>
              <div style={{height: catSorted.length > 0 ? Math.max(200, catSorted.length * 36) : 200}}>
                <ReactECharts option={getBarOption(catSorted.map(([c]) => c), catSorted.map(([, v]) => v.qty), '#6366f1')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">品类占比</div>
              <ReactECharts option={getPieOption(catSorted.slice(0, 8).map(([c, v]) => ({name: c, value: v.qty})))} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-item"><span className="stat-l">近7天订单</span><span className="stat-v">{period7} <span className={`trend-s ${orderChange>=0?'up':'down'}`}>{orderChange>=0?'↑':'↓'}{Math.abs(orderChange)}%</span></span></div>
            <div className="stat-item"><span className="stat-l">近7天出库量</span><span className="stat-v">{qtyChange} <span className={`trend-s ${qtyChange>=0?'up':'down'}`}>{qtyChange>=0?'↑':'↓'}{Math.abs(qtyChange)}%</span></span></div>
            <div className="stat-item"><span className="stat-l">日均出库</span><span className="stat-v">{(totalQty/Math.max(1,now.getDate())).toFixed(1)}件</span></div>
            <div className="stat-item"><span className="stat-l">完成率</span><span className="stat-v">{(((statusMap['completed']||0) / Math.max(1, total)) * 100).toFixed(0)}%</span></div>
          </div>
          {total === 0 && <div className="empty-state">📭 暂无数据，请先导入订单数据</div>}
        </div>
      )}

      {/* SKU */}
      {activeTab === 'sku' && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-item"><span className="stat-l">SKU 种类</span><span className="stat-v">{skuSorted.length}</span></div>
            <div className="stat-item"><span className="stat-l">SKU 明细</span><span className="stat-v">{filteredItems.length}</span></div>
            <div className="stat-item"><span className="stat-l">TOP SKU 占比</span><span className="stat-v">{topSkuShare}%</span></div>
            <div className="stat-item"><span className="stat-l">多 SKU 订单</span><span className="stat-v">{multiSkuOrders}</span></div>
          </div>
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">TOP 20 SKU 出库排行</div>
              <div style={{height: skuSorted.length > 0 ? Math.max(240, skuSorted.slice(0, 20).length * 34) : 240}}>
                <ReactECharts option={getBarOption(skuSorted.slice(0, 20).map(s => s.sku), skuSorted.slice(0, 20).map(s => s.qty), '#8b5cf6')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">TOP SKU 占比</div>
              <ReactECharts option={getPieOption(skuSorted.slice(0, 10).map(s => ({name: s.sku, value: s.qty})))} style={{height:300}} opts={{renderer:'svg'}} />
            </div>
          </div>
          <div className="chart-card wide">
            <div className="chart-title">SKU 明细排行</div>
            <div className="matrix-table-wrap">
              <table className="matrix-table">
                <thead><tr><th>#</th><th>SKU</th><th>产品名称</th><th>出库量</th><th>订单数</th><th>占比</th></tr></thead>
                <tbody>
                  {skuSorted.slice(0, 20).map((s, i) => (
                    <tr key={s.sku}>
                      <td>{i + 1}</td>
                      <td><span className="orderno-sm">{s.sku}</span></td>
                      <td>{s.productName || '-'}</td>
                      <td>{s.qty}</td>
                      <td>{s.orderCount}</td>
                      <td>{totalQty > 0 ? ((s.qty / totalQty) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {skuSorted.length === 0 && <div className="empty-state">📭 暂无 SKU 明细，请确认 order_items 已写入</div>}
        </div>
      )}

      {/* 交叉分析 */}
      {activeTab === 'matrix' && (
        <div className="tab-content">
          <div className="insight-strip">
            {concentrationTips.map((tip, i) => <div className="insight-chip" key={i}>{tip}</div>)}
          </div>
          <div className="chart-row">
            <div className="chart-card wide">
              <div className="chart-title">店铺 × 国家出库矩阵 <span className="chart-hint">适合判断每个店铺主攻市场</span></div>
              <MatrixTable rows={storeCountryMatrix} columns={topCountries} labelKey="store" maxValue={maxMatrixValue} />
            </div>
          </div>
          <div className="chart-row">
            <div className="chart-card wide">
              <div className="chart-title">品类 × 店铺出库矩阵 <span className="chart-hint">适合判断不同店铺的品类结构</span></div>
              <MatrixTable rows={categoryStoreMatrix} columns={topStores} labelKey="category" maxValue={maxMatrixValue} />
            </div>
          </div>
          {provinceSorted.length > 0 && (
            <div className="chart-card wide">
              <div className="chart-title">省/州出库排行 <span className="chart-hint">你的样本里美国州、省份信息很丰富</span></div>
              <div style={{height: Math.max(240, provinceSorted.slice(0, 20).length * 32)}}>
                <ReactECharts option={getBarOption(provinceSorted.slice(0, 20).map(([p]) => p), provinceSorted.slice(0, 20).map(([, v]) => v), '#0f766e')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 趋势 */}
      {activeTab === 'trend' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card wide">
              <div className="chart-title">近7天订单趋势</div>
              <ReactECharts option={getTrendOption(dayEntries.map(([d]) => d.slice(5)), dayEntries.map(([, v]) => v))} style={{height:280}} opts={{renderer:'svg'}} />
            </div>
          </div>
          {Object.keys(monthMap).length > 0 && (
            <div className="chart-card wide">
              <div className="chart-title">月度出库趋势</div>
              <ReactECharts option={getTrendOption(Object.keys(monthMap), Object.values(monthMap))} style={{height:280}} opts={{renderer:'svg'}} />
            </div>
          )}
          <div className="stats-grid">
            <div className="stat-item"><span className="stat-l">日均出库</span><span className="stat-v">{(totalQty / Math.max(1, now.getDate())).toFixed(1)}件</span></div>
            <div className="stat-item"><span className="stat-l">完成率</span><span className="stat-v">{(((statusMap['completed']||0) / Math.max(1, total)) * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      )}

      {/* 热力图 */}
      {activeTab === 'heatmap' && (
        <div className="tab-content">
          <div className="chart-card wide">
            <div className="chart-title">📅 出库热力图 <span className="chart-hint">颜色越深 = 出库越多</span></div>
            <div className="heatmap-container">
              {Object.keys(heatData).length === 0 ? <div className="empty-sm">暂无数据</div> : (
                <div className="heatmap-grid">
                  {weekdays.map((day, di) => (
                    <div key={di} className="heatmap-row">
                      <span className="heatmap-label">{day}</span>
                      {Array.from({length: 10}, (_, wi) => {
                        const key = `${di}-${wi}`
                        const val = heatData[key] || 0
                        const intensity = val / heatMax
                        return (
                          <div key={wi} className="heatmap-cell" style={{
                            background: val > 0 ? `rgba(99,102,241,${0.1 + intensity * 0.8})` : '#f8fafc',
                            border: val > 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid #f1f5f9'
                          }} title={`${day} 第${wi+1}周: ${val}件`}>
                            <span style={{fontSize:10,color:val > 0 ? '#1e293b' : '#cbd5e1'}}>{val || ''}</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
              <div className="heatmap-legend">
                <span>少</span>
                <div className="hm-legend-bar"><div style={{background:'#f8fafc',flex:1}}></div><div style={{background:'rgba(99,102,241,0.2)',flex:1}}></div><div style={{background:'rgba(99,102,241,0.5)',flex:1}}></div><div style={{background:'rgba(99,102,241,0.8)',flex:1}}></div><div style={{background:'#6366f1',flex:1}}></div></div>
                <span>多</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 店铺 */}
      {activeTab === 'store' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">店铺出库排行</div>
              <div style={{height: storeSorted.length > 0 ? Math.max(200, storeSorted.length * 42) : 200}}>
                <ReactECharts option={getBarOption(storeSorted.map(([s]) => s), storeSorted.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">店铺占比</div>
              <ReactECharts option={getPieOption(storeSorted.slice(0, 8).map(([s, v]) => ({name: s, value: v})))} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          {storeSorted.length === 0 && <div className="empty-state">📭 暂无店铺数据，导入马帮数据后自动显示</div>}
        </div>
      )}

      {/* 国家 */}
      {activeTab === 'country' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">🌍 国家出库排名</div>
              <div style={{height: countrySorted.length > 0 ? Math.max(200, countrySorted.length * 36) : 200}}>
                <ReactECharts option={getBarOption(countrySorted.map(([c]) => c), countrySorted.map(([, v]) => v), '#f97316')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">国家分布占比</div>
              <ReactECharts option={getPieOption(countrySorted.slice(0, 8).map(([c, v]) => ({name: c, value: v})))} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          {provinceSorted.length > 0 && (
            <div className="chart-card wide">
              <div className="chart-title">偏远地区分布（州/省）</div>
              <p className="chart-hint" style={{marginBottom:12}}>TOP 15 州/省出库量，分析是否为偏远地区</p>
              <div style={{height: Math.max(200, provinceSorted.slice(0, 15).length * 36)}}>
                <ReactECharts option={getBarOption(provinceSorted.slice(0, 15).map(([p]) => p), provinceSorted.slice(0, 15).map(([, v]) => v), '#ef4444')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
          )}
          {countrySorted.length === 0 && <div className="empty-state">📭 暂无国家数据，导入马帮数据后自动显示</div>}
        </div>
      )}

      {/* 供应商 */}
      {activeTab === 'supplier' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">供应商出库排名</div>
              <div style={{height: supSorted.length > 0 ? Math.max(200, supSorted.length * 42) : 200}}>
                <ReactECharts option={getBarOption(supSorted.map(([s]) => s), supSorted.map(([, v]) => v), '#06b6d4')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">订单状态分布</div>
              <ReactECharts option={getPieOption(Object.entries(statusMap).map(([k, v]) => ({name: statusLabel[k]||k, value: v})))} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          <div className="chart-card wide">
            <div className="chart-title">完成率</div>
            {total > 0 && (
              <div className="split-bar-container">
                <div className="split-bar"><div className="split-seg" style={{flex:(statusMap['completed']||0),background:'#10b981'}}>✅完成 {(statusMap['completed']||0)}</div><div className="split-seg" style={{flex:total-(statusMap['completed']||0),background:'#94a3b8'}}>⏳进行中 {total-(statusMap['completed']||0)}</div></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 明细 */}
      {activeTab === 'table' && (
        <div className="tab-content">
          <OrderTable orders={filtered} loading={loading} onRefresh={onRefresh} />
        </div>
      )}

      {/* AI */}
      {activeTab === 'ai' && (
        <div className="tab-content">
          <AIInsight orders={filtered} />
        </div>
      )}

      {/* 对比模式 */}
      {compareMode && (
        <div className="compare-panel">
          <div className="compare-header">
            <h4>📊 时间段对比</h4>
            <button className="btn-outline-sm" onClick={() => setCompareMode(false)}>关闭</button>
          </div>
          <div className="compare-body">
            <div className="compare-col">
              <label>时间段1</label>
              <div className="compare-inputs">
                <input type="date" value={period1.start} onChange={e => setPeriod1(p => ({...p, start: e.target.value}))} className="filter-input" />
                <span className="filter-sep">—</span>
                <input type="date" value={period1.end} onChange={e => setPeriod1(p => ({...p, end: e.target.value}))} className="filter-input" />
              </div>
              {period1.start && period1.end && (() => {
                const s = getPeriodStats(period1.start, period1.end)
                return <div className="compare-stats"><div>📦 {s.total}单</div><div>📊 {s.qty}件</div><div>💰 ¥{s.amt.toFixed(0)}</div></div>
              })()}
            </div>
            <div className="compare-vs">VS</div>
            <div className="compare-col">
              <label>时间段2</label>
              <div className="compare-inputs">
                <input type="date" value={period2.start} onChange={e => setPeriod2(p => ({...p, start: e.target.value}))} className="filter-input" />
                <span className="filter-sep">—</span>
                <input type="date" value={period2.end} onChange={e => setPeriod2(p => ({...p, end: e.target.value}))} className="filter-input" />
              </div>
              {period2.start && period2.end && (() => {
                const s = getPeriodStats(period2.start, period2.end)
                return <div className="compare-stats"><div>📦 {s.total}单</div><div>📊 {s.qty}件</div><div>💰 ¥{s.amt.toFixed(0)}</div></div>
              })()}
            </div>
          </div>
          {period1.start && period1.end && period2.start && period2.end && (() => {
            const a = getPeriodStats(period1.start, period1.end)
            const b = getPeriodStats(period2.start, period2.end)
            const diff = b.total > 0 ? ((a.total - b.total) / b.total * 100).toFixed(0) : 0
            return <div className="compare-result">📊 对比结果：时间段1 比 时间段2 <strong style={{color: diff >= 0 ? '#16a34a' : '#dc2626'}}>{diff >= 0 ? '↑' : '↓'}{Math.abs(diff)}%</strong></div>
          })()}
        </div>
      )}
    </div>
  )
}

function MatrixTable({ rows, columns, labelKey, maxValue }) {
  if (!rows.length || !columns.length) {
    return <div className="empty-sm">暂无足够数据生成交叉分析</div>
  }

  return (
    <div className="matrix-table-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>{labelKey === 'store' ? '店铺' : '品类'}</th>
            {columns.map(col => <th key={col}>{col}</th>)}
            <th>合计</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[labelKey]}>
              <td className="matrix-row-label">{row[labelKey]}</td>
              {row.values.map((value, i) => {
                const intensity = value / Math.max(1, maxValue)
                return (
                  <td key={`${row[labelKey]}-${columns[i]}`}>
                    <span
                      className="matrix-cell"
                      style={{
                        background: value > 0 ? `rgba(99,102,241,${0.08 + intensity * 0.7})` : '#f8fafc',
                        color: intensity > 0.55 ? '#fff' : '#1e293b',
                      }}
                      title={`${row[labelKey]} / ${columns[i]}: ${value}`}
                    >
                      {value || '-'}
                    </span>
                  </td>
                )
              })}
              <td className="matrix-total">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ========== AI 洞察 ========== */
import { analyzeOrders } from '../lib/analyzer'

function AIInsight({ orders }) {
  const [report, setReport] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (orders.length === 0) { setReport('暂无数据，请先导入订单～'); return }
    setAnalyzing(true); setReport('')
    setReport(await analyzeOrders(orders))
    setAnalyzing(false)
  }

  return (
    <div className="ai-card">
      <div className="ai-header">
        <div className="ai-title"><span className="ai-icon">🧠</span><div><h4>AI 智能数据洞察</h4><p className="ai-desc">基于订单数据的本地智能分析，不限次数永久免费</p></div></div>
        <button className={`btn-ai ${analyzing ? 'loading' : ''}`} onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? '⏳ 分析中...' : '🚀 开始分析'}
        </button>
      </div>
      {report && <div className="ai-report"><pre className="ai-text">{report}</pre></div>}
    </div>
  )
}
