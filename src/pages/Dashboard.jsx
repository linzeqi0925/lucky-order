import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeOrders } from '../lib/analyzer'
import { getUpcomingHolidays, formatDate, isImportant } from '../lib/holidays'
import { loadRules, saveRules, classifyBulk } from '../lib/classifier'
import * as XLSX from 'xlsx'
import ReactECharts from 'echarts-for-react'
import html2canvas from 'html2canvas'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dashboardRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    loadOrders()
  }, [user])

  const loadOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const el = dashboardRef.current
      if (!el) return
      const canvas = await html2canvas(el, { backgroundColor: '#f0f2f5', scale: 2, useCORS: true })
      const link = document.createElement('a')
      link.download = `出库分析报告_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      alert('导出失败：' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (!user) return null

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-box">LO</div>
          <div>
            <h2>Lucky Order</h2>
            <span className="badge">出库数据分析</span>
          </div>
        </div>
        <div className="topbar-center">
          <button className={`nav-btn ${!showImport ? 'active' : ''}`} onClick={() => setShowImport(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            数据看板
          </button>
          <button className={`nav-btn ${showImport ? 'active' : ''}`} onClick={() => setShowImport(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            数据导入
          </button>
        </div>
        <div className="topbar-right">
          <button className="btn-outline-sm" onClick={() => setShowRules(true)} title="智能分类规则">🏷️ 规则</button>
          <button className="btn-outline-sm" onClick={() => setShowShare(true)} title="分享给同事" disabled={orders.length === 0}>🔗 分享</button>
          <button className="btn-outline-sm" onClick={handleExport} disabled={exporting || orders.length === 0}>
            {exporting ? '⏳' : '📷'} 导出
          </button>
          <div className="user-avatar">{user.email?.charAt(0).toUpperCase()}</div>
          <span className="user-email">{user.email?.split('@')[0]}</span>
          <button className="btn-outline-sm" onClick={handleLogout}>退出</button>
        </div>
      </header>

      <div className="dashboard-body" ref={dashboardRef}>
        {showImport ? (
          <DataImport onImported={() => { loadOrders(); setShowImport(false) }} />
        ) : (
          <DashboardView orders={orders} loading={loading} onRefresh={loadOrders} />
        )}
      </div>

      {/* 分享弹窗 */}
      {showShare && <ShareModal orders={orders} user={user} onClose={() => setShowShare(false)} />}
      {/* 规则弹窗 */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}

/* ========== 数据导入 ========== */
function DataImport({ onImported }) {
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const parseFile = useCallback(async (file) => {
    setParsing(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)
      if (!rows || rows.length === 0) throw new Error('表格中没有数据')

      const sample = rows[0]
      const keys = Object.keys(sample)
      const fieldMap = {
        order_no: findKey(keys, ['订单号','订单编号','order_no','OrderNo','orderno']),
        product_category: findKey(keys, ['品类','产品大类','分类','产品类别','category','Category']),
        product_name: findKey(keys, ['产品名称','产品名','商品名称','product_name','ProductName']),
        quantity: findKey(keys, ['数量','出库数量','出库量','qty','Qty','quantity','Quantity']),
        total_amount: findKey(keys, ['金额','总金额','销售额','amount','Amount','total_amount']),
        order_date: findKey(keys, ['日期','下单日期','出库日期','date','Date','order_date']),
        order_status: findKey(keys, ['状态','订单状态','status','Status']),
        supplier: findKey(keys, ['供应商','supplier','Supplier']),
      }
      setPreview({ rows: rows.slice(0, 5), total: rows.length, fieldMap, allRows: rows, keys })
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }, [])

  const handleImport = async () => {
    if (!preview) return
    setParsing(true)
    setError('')
    try {
      const user = (await supabase.auth.getUser()).data.user
      const fm = preview.fieldMap
      let imported = 0
      for (let i = 0; i < preview.allRows.length; i += 100) {
        const batch = preview.allRows.slice(i, i + 100).map(row => ({
          user_id: user.id,
          order_no: String(row[fm.order_no] || '') || `IMP-${Date.now()}-${i}`,
          product_category: String(row[fm.product_category] || '未分类'),
          product_name: String(row[fm.product_name] || ''),
          quantity: parseInt(row[fm.quantity]) || 1,
          total_amount: fm.total_amount ? parseFloat(row[fm.total_amount]) || 0 : 0,
          order_date: fm.order_date ? formatExcelDate(row[fm.order_date]) : new Date().toISOString().split('T')[0],
          order_status: fm.order_status ? mapStatus(String(row[fm.order_status])) : 'completed',
          supplier: fm.supplier ? String(row[fm.supplier] || '') : '',
        }))
        const { error: err } = await supabase.from('orders').insert(batch)
        if (err) throw err
        imported += batch.length
      }
      setPreview(null)
      onImported()
    } catch (err) {
      setError('导入失败：' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file) }
  const handleChange = (e) => { const file = e.target.files[0]; if (file) parseFile(file) }

  return (
    <div className="import-page">
      <div className="import-card">
        <div className="import-header">
          <h3>📥 导入出库数据</h3>
          <p>拖拽或选择 Excel 文件，系统自动识别字段</p>
        </div>
        {!preview ? (
          <div className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
            <div className="dropzone-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="10" y="6" width="36" height="44" rx="6" stroke="#6366f1" strokeWidth="2" fill="rgba(99,102,241,0.05)"/>
                <path d="M28 20v18M19 29l9 9 9-9" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="dropzone-text">{parsing ? '⏳ 解析中...' : '拖拽 Excel / CSV 到此处'}</p>
            <p className="dropzone-hint">支持 .xlsx .xls .csv 格式</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleChange} hidden />
            {!parsing && <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>选择文件</button>}
          </div>
        ) : (
          <div className="preview-area">
            <div className="preview-header">
              <span className="preview-count">📄 识别 <strong>{preview.total}</strong> 条数据</span>
              <div className="preview-actions">
                <button className="btn-ghost" onClick={() => setPreview(null)}>取消</button>
                <button className="btn-primary-sm" onClick={handleImport} disabled={parsing}>
                  {parsing ? '⏳ 导入中...' : '✅ 确认导入'}
                </button>
              </div>
            </div>
            <div className="field-mapping-bar">
              {Object.entries(preview.fieldMap).filter(([_, v]) => v).map(([field, col]) => (
                <span key={field} className="mapping-chip"><span className="chip-field">{field}</span> ← {col}</span>
              ))}
            </div>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead><tr>{preview.keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>{preview.rows.map((row, i) => (
                  <tr key={i}>{preview.keys.map(k => <td key={k}>{String(row[k] ?? '').slice(0, 30)}</td>)}</tr>
                ))}</tbody>
              </table>
              {preview.total > 5 && <p className="preview-more">...还有 {preview.total - 5} 条</p>}
            </div>
            {error && <div className="error-msg">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== 数据看板 ========== */
function DashboardView({ orders, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview')
  // 全局筛选
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  // 所有可用的品类和供应商
  const allCats = [...new Set(orders.map(o => o.product_category).filter(Boolean))]
  const allSups = [...new Set(orders.map(o => o.supplier).filter(Boolean))]

  // 筛选后的数据
  const filtered = orders.filter(o => {
    if (filterCategory && o.product_category !== filterCategory) return false
    if (filterSupplier && o.supplier !== filterSupplier) return false
    if (dateRange.start && o.order_date < dateRange.start) return false
    if (dateRange.end && o.order_date > dateRange.end) return false
    return true
  })

  const hasFilter = filterCategory || filterSupplier || dateRange.start || dateRange.end

  const total = filtered.length
  const totalQty = filtered.reduce((s, o) => s + o.quantity, 0)
  const totalAmt = filtered.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
  const urgentCount = filtered.filter(o => o.is_urgent).length

  const catMap = {}
  filtered.forEach(o => {
    const cat = o.product_category || '未分类'
    if (!catMap[cat]) catMap[cat] = { count: 0, qty: 0, amount: 0 }
    catMap[cat].count++
    catMap[cat].qty += o.quantity
    catMap[cat].amount += parseFloat(o.total_amount || 0)
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1].qty - a[1].qty)

  const statusMap = {}
  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  filtered.forEach(o => { statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1 })

  const supMap = {}
  filtered.forEach(o => { if (o.supplier) supMap[o.supplier] = (supMap[o.supplier] || 0) + o.quantity })
  const supSorted = Object.entries(supMap).sort((a, b) => b[1] - a[1])

  const now = new Date()
  const dayMap = {}
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dayMap[d.toISOString().split('T')[0]] = 0 }
  filtered.forEach(o => { if (dayMap[o.order_date] !== undefined) dayMap[o.order_date]++ })
  const dayEntries = Object.entries(dayMap)

  const monthMap = {}
  filtered.forEach(o => {
    if (!o.order_date) return
    const m = o.order_date.slice(0, 7)
    monthMap[m] = (monthMap[m] || 0) + o.quantity
  })

  const clearFilters = () => { setDateRange({ start: '', end: '' }); setFilterCategory(''); setFilterSupplier('') }

  return (
    <div className="dashboard-view">
      <HolidayBanner />

      {/* ===== 全局筛选器 ===== */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>时间</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="filter-input" />
          <span className="filter-sep">—</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="filter-input" />
        </div>
        <div className="filter-group">
          <label>品类</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="filter-input">
            <option value="">全部</option>
            {allCats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>供应商</label>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="filter-input">
            <option value="">全部</option>
            {allSups.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {hasFilter && (
          <button className="btn-clear" onClick={clearFilters}>✕ 清除筛选</button>
        )}
        <div className="filter-count">筛选结果：<strong>{total}</strong> 单</div>
      </div>

      {/* KPI 卡片 */}
      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-icon" style={{background:'#ede9fe',color:'#6d28d9'}}>📦</div><div><div className="kpi-num">{total}</div><div className="kpi-label">总订单</div></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{background:'#dbeafe',color:'#2563eb'}}>📊</div><div><div className="kpi-num">{totalQty.toLocaleString()}</div><div className="kpi-label">总出库量</div></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{background:'#dcfce7',color:'#16a34a'}}>💰</div><div><div className="kpi-num">¥{totalAmt.toFixed(0)}</div><div className="kpi-label">总金额</div></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{background:'#fef3c7',color:'#d97706'}}>⚡</div><div><div className="kpi-num">{urgentCount}</div><div className="kpi-label">加急单</div></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{background:'#fce7f3',color:'#db2777'}}>🏷️</div><div><div className="kpi-num">{catSorted.length}</div><div className="kpi-label">品类数</div></div></div>
        <div className="kpi-card action" onClick={onRefresh}><div className="kpi-icon" style={{background:'#f3e8ff',color:'#9333ea'}}>🔄</div><div><div className="kpi-num" style={{fontSize:14}}>刷新</div><div className="kpi-label">点击刷新</div></div></div>
      </div>

      {/* Tab 导航 */}
      <div className="tab-bar">
        <button className={`tab-pill ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>品类概览</button>
        <button className={`tab-pill ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>趋势分析</button>
        <button className={`tab-pill ${activeTab === 'supplier' ? 'active' : ''}`} onClick={() => setActiveTab('supplier')}>供应商分析</button>
        <button className={`tab-pill ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>数据明细</button>
        <button className={`tab-pill ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI 洞察</button>
      </div>

      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">品类出库排行</div>
              <div style={{height: catSorted.length > 0 ? Math.max(200, catSorted.length * 36) : 200}}>
                <ReactECharts option={getBarOption(catSorted.map(([c]) => c), catSorted.map(([, v]) => v.qty), '#6366f1')} style={{height:'100%'}} opts={{renderer:'svg'}} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title">品类占比</div>
              <ReactECharts option={getPieOption(catSorted.slice(0, 8).map(([c, v]) => ({name: c, value: v.qty})))} style={{height:260}} opts={{renderer:'svg'}} />
            </div>
          </div>
          {total === 0 && <div className="empty-state">📭 暂无数据，请先导入订单数据</div>}
        </div>
      )}

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
            <div className="stat-item"><span className="stat-l">客单价</span><span className="stat-v">¥{(totalAmt / Math.max(1, total)).toFixed(0)}</span></div>
            <div className="stat-item"><span className="stat-l">加急占比</span><span className="stat-v">{((urgentCount / Math.max(1, total)) * 100).toFixed(1)}%</span></div>
            <div className="stat-item"><span className="stat-l">完成率</span><span className="stat-v">{(((statusMap['completed']||0) / Math.max(1, total)) * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      )}

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
            <div className="chart-title">加急 vs 常规</div>
            {total > 0 && (
              <div className="split-bar-container">
                <div className="split-bar"><div className="split-seg urgent-seg" style={{flex:urgentCount}}>⚡加急 {urgentCount}</div><div className="split-seg normal-seg" style={{flex:total-urgentCount}}>📦常规 {total-urgentCount}</div></div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="tab-content">
          <OrderTable orders={filtered} loading={loading} onRefresh={onRefresh} />
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="tab-content">
          <AIInsight orders={filtered} />
        </div>
      )}
    </div>
  )
}

/* ========== 图表配置 ========== */
const COLORS = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981','#06b6d4','#3b82f6']

function getBarOption(labels, values, color) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category', data: labels.reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', data: values.reverse(), itemStyle: { color, borderRadius: [0, 6, 6, 0] }, barWidth: 20 }]
  }
}

function getPieOption(data) {
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

function getTrendOption(labels, values) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 25 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'line', data: values, smooth: true, symbol: 'circle', symbolSize: 8,
      lineStyle: { color: '#6366f1', width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }] } },
      itemStyle: { color: '#6366f1' }
    }]
  }
}

/* ========== 节假日横幅 ========== */
function HolidayBanner() {
  const [hd, setHd] = useState({ current: null, next: null })
  useEffect(() => { setHd(getUpcomingHolidays()) }, [])
  if (!hd.current) return null
  return (
    <div className="holiday-banner">
      <span className="holiday-icon">🌍</span>
      <span className="holiday-label">营销日历</span>
      <div className="holiday-tags">
        {hd.current.events.map((e, i) => (
          <span key={i} className={`holiday-tag ${isImportant(e) ? 'imp' : ''}`} title={e.note}>
            <span className="holiday-date">{formatDate(e.date)}</span>
            {isImportant(e) && '🔥'}{e.name}
            <span className="holiday-region">{e.region}</span>
          </span>
        ))}
        {hd.next?.events.slice(0, 3).map((e, i) => (
          <span key={i} className={`holiday-tag ${isImportant(e) ? 'imp' : ''}`} title={e.note}>
            {formatDate(e.date)} {e.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ========== AI 洞察 ========== */
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

/* ========== 订单表格 ========== */
function OrderTable({ orders, loading, onRefresh }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = orders.filter(o => {
    if (statusFilter && o.order_status !== statusFilter) return false
    if (categoryFilter && o.product_category !== categoryFilter) return false
    if (search && !o.order_no?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  const statusColor = { pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444' }

  return (
    <div>
      <div className="table-bar">
        <h4>📋 订单明细 · <span className="count">{filtered.length}</span></h4>
        <div className="table-filters">
          <input placeholder="🔍 搜索订单号..." value={search} onChange={e => setSearch(e.target.value)} className="filter-input" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select"><option value="">全部状态</option>{Object.entries(statusLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="filter-select"><option value="">全部品类</option>{['胶垫','光敏','金属','亚克力','皮革','签字笔'].map(c => <option key={c}>{c}</option>)}</select>
          <button className="btn-outline-sm" onClick={onRefresh}>🔄</button>
        </div>
      </div>
      <div className="table-wrap">
        {loading ? <div className="empty-state">加载中...</div> : filtered.length === 0 ? <div className="empty-state">暂无数据</div> : (
          <table className="order-table">
            <thead><tr><th>订单号</th><th>品类</th><th>产品</th><th>数量</th><th>金额</th><th>状态</th><th>供应商</th><th>日期</th><th>加急</th></tr></thead>
            <tbody>{filtered.map(o => (
              <tr key={o.id}>
                <td><span className="orderno">{o.order_no}</span></td>
                <td><span className="cat-tag">{o.product_category}</span></td>
                <td>{o.product_name}</td>
                <td>{o.quantity}</td>
                <td>¥{o.total_amount}</td>
                <td><span className="status-tag" style={{background:statusColor[o.order_status]}}>{statusLabel[o.order_status]}</span></td>
                <td>{o.supplier || '-'}</td>
                <td>{o.order_date}</td>
                <td>{o.is_urgent ? '⚡' : '-'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ========== 分享弹窗 ========== */
function ShareModal({ orders, user, onClose }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}?shared=${user.id}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>🔗 分享数据给同事</h3>
        <p className="modal-desc">把链接发给同事，对方打开就能看到你的数据</p>
        <div className="share-url-box">
          <input readOnly value={shareUrl} className="share-input" onClick={e => e.target.select()} />
          <button className="btn-primary-sm" onClick={handleCopy}>{copied ? '✅ 已复制' : '📋 复制链接'}</button>
        </div>
        <div className="share-info">
          <span>📊 共 {orders.length} 条订单数据</span>
          <span>👤 分享者：{user.email}</span>
        </div>
      </div>
    </div>
  )
}

/* ========== 智能规则弹窗 ========== */
function RulesModal({ onClose }) {
  const [rules, setRules] = useState([])
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => { setRules(loadRules()) }, [])

  const handleAdd = () => {
    if (!newKeyword.trim() || !newCategory.trim()) return
    const updated = [...rules, { keyword: newKeyword.trim(), category: newCategory.trim() }]
    saveRules(updated)
    setRules(updated)
    setNewKeyword('')
    setNewCategory('')
  }

  const handleDelete = (idx) => {
    const updated = rules.filter((_, i) => i !== idx)
    saveRules(updated)
    setRules(updated)
  }

  const handleReset = () => {
    saveRules(loadRules())
    setRules(loadRules())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>🏷️ 智能分类规则</h3>
        <p className="modal-desc">根据产品名称中的关键词自动分配到品类，导入时生效</p>

        <div className="rules-add">
          <input placeholder="关键词（如：光敏）" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            className="filter-input" style={{flex:1}} />
          <input placeholder="分类到（如：光敏）" value={newCategory} onChange={e => setNewCategory(e.target.value)} 
            className="filter-input" style={{flex:1}} />
          <button className="btn-primary-sm" onClick={handleAdd}>➕ 添加</button>
        </div>

        <div className="rules-list">
          {rules.map((r, i) => (
            <div key={i} className="rule-item">
              <span className="rule-keyword">{r.keyword}</span>
              <span className="rule-arrow">→</span>
              <span className="rule-cat">{r.category}</span>
              <button className="rule-del" onClick={() => handleDelete(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className="rules-footer">
          <span className="rules-count">共 {rules.length} 条规则</span>
          <button className="btn-outline-sm" onClick={handleReset}>🔄 恢复默认</button>
        </div>
      </div>
    </div>
  )
}

/* ========== 工具函数 ========== */
function findKey(keys, candidates) { for (const c of candidates) { const f = keys.find(k => k.toLowerCase().includes(c.toLowerCase())); if (f) return f } return null }
function formatExcelDate(val) { if (!val) return new Date().toISOString().split('T')[0]; if (typeof val === 'number') { const d = new Date((val - 25569) * 86400 * 1000); return d.toISOString().split('T')[0] }; const d = new Date(val); return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(val) }
function mapStatus(s) { const map = { '待处理':'pending','pending':'pending','生产中':'processing','processing':'processing','已发货':'shipped','shipped':'shipped','已完成':'completed','completed':'completed','已取消':'cancelled','cancelled':'cancelled' }; return map[s.toLowerCase()] || 'pending' }