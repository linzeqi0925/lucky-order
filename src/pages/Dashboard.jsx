import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeOrders } from '../lib/gemini'
import { getUpcomingHolidays, formatDate, isImportant } from '../lib/holidays'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (!user) return null

  return (
    <div className="dashboard">
      {/* 顶部导航 */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-mark">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <path d="M8 16h16M16 8v16" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="5" stroke="white" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <h2>Lucky Order</h2>
            <span className="badge">出库数据分析看板</span>
          </div>
        </div>
        <div className="topbar-center">
          <button className={`nav-pill ${!showImport ? 'active' : ''}`} onClick={() => setShowImport(false)}>
            📊 数据看板
          </button>
          <button className={`nav-pill ${showImport ? 'active' : ''}`} onClick={() => setShowImport(true)}>
            📥 数据导入
          </button>
        </div>
        <div className="topbar-right">
          <span className="user-email">{user.email}</span>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>退出</button>
        </div>
      </header>

      <div className="dashboard-body">
        {showImport ? (
          <DataImport onImported={() => { loadOrders(); setShowImport(false) }} />
        ) : (
          <DashboardView orders={orders} loading={loading} onRefresh={loadOrders} user={user} />
        )}
      </div>
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

      // 尝试自动识别列名
      const sample = rows[0]
      const keys = Object.keys(sample)

      // 自动匹配字段
      const fieldMap = {
        order_no: findKey(keys, ['订单号', '订单编号', 'order_no', 'order_no', 'OrderNo', 'orderno']),
        product_category: findKey(keys, ['品类', '产品大类', '分类', '产品类别', 'category', 'Category']),
        product_name: findKey(keys, ['产品名称', '产品名', '商品名称', 'product_name', 'ProductName']),
        quantity: findKey(keys, ['数量', '出库数量', '出库量', 'qty', 'Qty', 'quantity', 'Quantity']),
        total_amount: findKey(keys, ['金额', '总金额', '销售额', '金额', 'amount', 'Amount', 'total_amount']),
        order_date: findKey(keys, ['日期', '下单日期', '出库日期', '日期', 'date', 'Date', 'order_date']),
        order_status: findKey(keys, ['状态', '订单状态', 'status', 'Status']),
        supplier: findKey(keys, ['供应商', 'supplier', 'Supplier']),
        remark: findKey(keys, ['备注', 'remark', 'Remark']),
        unit_price: findKey(keys, ['单价', 'unit_price', 'UnitPrice', 'price', 'Price']),
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
      const batchSize = 100
      let imported = 0

      for (let i = 0; i < preview.allRows.length; i += batchSize) {
        const batch = preview.allRows.slice(i, i + batchSize).map(row => ({
          user_id: user.id,
          order_no: String(row[fm.order_no] || ''),
          product_category: String(row[fm.product_category] || '未分类'),
          product_name: String(row[fm.product_name] || ''),
          quantity: parseInt(row[fm.quantity]) || 1,
          unit_price: fm.unit_price ? parseFloat(row[fm.unit_price]) || null : null,
          total_amount: fm.total_amount ? parseFloat(row[fm.total_amount]) || 0 : 0,
          order_date: fm.order_date ? formatExcelDate(row[fm.order_date]) : new Date().toISOString().split('T')[0],
          order_status: fm.order_status ? mapStatus(String(row[fm.order_status])) : 'pending',
          supplier: fm.supplier ? String(row[fm.supplier] || '') : '',
          remark: fm.remark ? String(row[fm.remark] || '') : '',
        }))

        const { error: err } = await supabase.from('orders').insert(batch)
        if (err) throw err
        imported += batch.length
      }

      setPreview(null)
      onImported()
      alert(`✅ 成功导入 ${imported} 条订单数据！`)
    } catch (err) {
      setError('导入失败：' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (file) parseFile(file)
  }

  return (
    <div className="import-page">
      <div className="import-container">
        <div className="import-header">
          <h3>📥 导入出库数据</h3>
          <p>支持 Excel (.xlsx / .xls) 或 CSV 文件，系统自动识别字段并导入</p>
        </div>

        {!preview ? (
          <div className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}>
            <div className="dropzone-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="4" width="32" height="40" rx="4" stroke="#6366f1" strokeWidth="2" fill="rgba(99,102,241,0.05)"/>
                <path d="M24 18v14M17 25l7 7 7-7" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="dropzone-text">
              {parsing ? '⏳ 解析文件中...' : '拖拽 Excel / CSV 文件到此处，或点击选择文件'}
            </p>
            <p className="dropzone-hint">支持 .xlsx、.xls、.csv 格式</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleChange} hidden />
            {!parsing && <button className="btn btn-outline" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>选择文件</button>}
          </div>
        ) : (
          <div className="preview-area">
            <div className="preview-header">
              <span>📄 共识别 <strong>{preview.total}</strong> 条数据记录</span>
              <div className="preview-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setPreview(null)}>取消</button>
                <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={parsing}>
                  {parsing ? '导入中...' : '✅ 确认导入全部数据'}
                </button>
              </div>
            </div>

            <div className="field-mapping">
              <h4>字段映射</h4>
              <div className="mapping-grid">
                {Object.entries(preview.fieldMap).filter(([_, v]) => v).map(([field, col]) => (
                  <div key={field} className="mapping-item">
                    <span className="mapping-field">{field}</span>
                    <span className="mapping-arrow">→</span>
                    <span className="mapping-col">{col}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    {preview.keys.map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.keys.map(k => <td key={k}>{String(row[k] ?? '').slice(0, 30)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.total > 5 && <p className="preview-more">...还有 {preview.total - 5} 条记录</p>}
            </div>

            {error && <div className="msg msg-error">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== 数据看板 ========== */
function DashboardView({ orders, loading, onRefresh, user }) {
  const [activeTab, setActiveTab] = useState('overview')

  const catMap = {}
  orders.forEach(o => {
    if (!catMap[o.product_category]) catMap[o.product_category] = { count: 0, amount: 0 }
    catMap[o.product_category].count += o.quantity
    catMap[o.product_category].amount += parseFloat(o.total_amount || 0)
  })

  const statusMap = {}
  orders.forEach(o => {
    statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1
  })

  const urgentCount = orders.filter(o => o.is_urgent).length
  const totalAmt = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)

  const now = new Date()
  const dayMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    dayMap[d.toISOString().split('T')[0]] = 0
  }
  orders.forEach(o => {
    if (dayMap[o.order_date] !== undefined) dayMap[o.order_date]++
  })
  const maxDay = Math.max(...Object.values(dayMap), 1)

  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  const catColors = { 胶垫: '#f97316', 光敏: '#3b82f6', 金属: '#10b981', 亚克力: '#8b5cf6', 皮革: '#ec4899', 签字笔: '#14b8a6' }

  return (
    <div className="dashboard-view">
      {/* 海外节假日横幅 */}
      <HolidayBanner />

      {/* 统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card-modern">
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>📦</div>
          <div className="stat-info">
            <div className="stat-num">{orders.length}</div>
            <div className="stat-label">总订单数</div>
          </div>
          <div className="stat-trend up">+{orders.length > 0 ? Math.round((orders.length / Math.max(1, orders.length - 3)) * 100 - 100) || 0 : 0}%</div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>📊</div>
          <div className="stat-info">
            <div className="stat-num">{orders.reduce((s, o) => s + o.quantity, 0)}</div>
            <div className="stat-label">总出库量</div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>💰</div>
          <div className="stat-info">
            <div className="stat-num">¥{totalAmt.toFixed(0)}</div>
            <div className="stat-label">总金额</div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>⚡</div>
          <div className="stat-info">
            <div className="stat-num">{urgentCount}</div>
            <div className="stat-label">加急单</div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-icon" style={{ background: '#fce7f3', color: '#db2777' }}>🏆</div>
          <div className="stat-info">
            <div className="stat-num">{catMap && Object.keys(catMap).length || 0}</div>
            <div className="stat-label">品类数</div>
          </div>
        </div>
        <div className="stat-card-modern action-card" onClick={onRefresh}>
          <div className="stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>🔄</div>
          <div className="stat-info">
            <div className="stat-num" style={{ fontSize: 14 }}>刷新数据</div>
            <div className="stat-label">点击刷新</div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="dashboard-tabs">
        <button className={`dtab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>品类概览</button>
        <button className={`dtab ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>趋势分析</button>
        <button className={`dtab ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>状态分布</button>
        <button className={`dtab ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>数据明细</button>
      </div>

      {/* 内容区 */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>品类出库排行 TOP 15</h4>
                <span className="chart-badge">按出库量排序</span>
              </div>
              <div className="chart-body">
                {loading ? <div className="loading-sm">加载中...</div> :
                Object.keys(catMap).length === 0 ? <div className="empty-sm">暂无数据，请先导入订单</div> :
                <div className="bar-list">
                  {Object.entries(catMap).sort((a, b) => b[1].count - a[1].count).slice(0, 15).map(([cat, v], i) => (
                    <div key={cat} className="bar-row">
                      <span className="bar-rank">{i + 1}</span>
                      <span className="bar-name">{cat}</span>
                      <div className="bar-track-wrap">
                        <div className="bar-track-modern">
                          <div className="bar-fill-modern" style={{
                            width: `${(v.count / Math.max(...Object.values(catMap).map(x => x.count))) * 100}%`,
                            background: catColors[cat] || '#6366f1'
                          }} />
                        </div>
                      </div>
                      <span className="bar-val">{v.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>}
              </div>
            </div>

            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>品类占比</h4>
                <span className="chart-badge">TOP 8</span>
              </div>
              <div className="chart-body pie-container">
                {loading ? <div className="loading-sm">加载中...</div> :
                Object.keys(catMap).length === 0 ? <div className="empty-sm">暂无数据</div> :
                <div className="pie-chart">
                  {Object.entries(catMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([cat, v], i, arr) => {
                    const total = arr.reduce((s, [, x]) => s + x.count, 0)
                    const pct = ((v.count / total) * 100).toFixed(1)
                    const colors = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981']
                    // 计算饼图扇区的角度
                    const cumPct = arr.slice(0, i).reduce((s, [, x]) => s + (x.count / total) * 100, 0)
                    const rot = (cumPct / 100) * 360
                    const deg = (pct / 100) * 360
                    return (
                      <div key={cat} className="pie-legend-item">
                        <span className="pie-dot" style={{ background: colors[i % colors.length] }}></span>
                        <span className="pie-lname">{cat}</span>
                        <span className="pie-lpct">{pct}%</span>
                        <span className="pie-lval">{v.count.toLocaleString()}</span>
                      </div>
                    )
                  })}
                  {/* 简单的环图代替SVG */}
                  <div className="donut-chart-visual">
                    {Object.entries(catMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([cat, v], i, arr) => {
                      const total = arr.reduce((s, [, x]) => s + x.count, 0)
                      const pct = (v.count / total) * 100
                      const colors = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981']
                      return <div key={cat} className="donut-seg" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    })}
                  </div>
                </div>}
              </div>
            </div>
          </div>

          {/* AI 分析 */}
          <AIAnalysis orders={orders} />
        </div>
      )}

      {activeTab === 'trend' && (
        <div className="tab-content">
          <div className="chart-card-modern wide">
            <div className="chart-header">
              <h4>近7天订单趋势</h4>
              <span className="chart-badge">每日单量</span>
            </div>
            <div className="chart-body">
              {Object.values(dayMap).every(v => v === 0) ? <div className="empty-sm">暂无数据</div> : (
                <div className="trend-chart">
                  {Object.entries(dayMap).map(([d, v]) => {
                    const pct = (v / maxDay) * 100
                    const isToday = d === now.toISOString().split('T')[0]
                    return (
                      <div key={d} className="trend-item">
                        <div className="trend-bar-wrap">
                          <div className="trend-bar" style={{ height: `${Math.max(4, pct)}%` }}>
                            <div className={`trend-fill ${isToday ? 'trend-today' : ''}`} style={{ height: '100%' }} />
                          </div>
                        </div>
                        <span className="trend-val">{v}</span>
                        <span className={`trend-label ${isToday ? 'trend-today-label' : ''}`}>
                          {d.slice(5)}
                          {isToday && <span className="today-dot">·</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>月度汇总</h4>
              </div>
              <div className="chart-body">
                {loading ? <div className="loading-sm">加载中...</div> :
                orders.length === 0 ? <div className="empty-sm">暂无数据</div> : (
                  <div className="monthly-summary">
                    <div className="ms-item"><span className="ms-label">本月订单</span><span className="ms-val">{orders.filter(o => o.order_date?.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)).length}</span></div>
                    <div className="ms-item"><span className="ms-label">日均单量</span><span className="ms-val">{(orders.length / Math.max(1, now.getDate())).toFixed(1)}</span></div>
                    <div className="ms-item"><span className="ms-label">客单价</span><span className="ms-val">¥{(totalAmt / Math.max(1, orders.length)).toFixed(0)}</span></div>
                    <div className="ms-item"><span className="ms-label">加急占比</span><span className="ms-val">{((urgentCount / Math.max(1, orders.length)) * 100).toFixed(1)}%</span></div>
                  </div>
                )}
              </div>
            </div>
            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>供应商分布</h4>
              </div>
              <div className="chart-body">
                {loading ? <div className="loading-sm">加载中...</div> : (() => {
                  const supMap = {}
                  orders.forEach(o => {
                    if (!o.supplier) return
                    supMap[o.supplier] = (supMap[o.supplier] || 0) + o.quantity
                  })
                  const entries = Object.entries(supMap).sort((a, b) => b[1] - a[1])
                  return entries.length === 0 ? <div className="empty-sm">暂无数据</div> : (
                    <div className="bar-list">
                      {entries.slice(0, 8).map(([s, v], i) => (
                        <div key={s} className="bar-row">
                          <span className="bar-rank">{i + 1}</span>
                          <span className="bar-name">{s}</span>
                          <div className="bar-track-wrap">
                            <div className="bar-track-modern">
                              <div className="bar-fill-modern" style={{ width: `${(v / entries[0][1]) * 100}%`, background: '#06b6d4' }} />
                            </div>
                          </div>
                          <span className="bar-val">{v.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="tab-content">
          <div className="chart-row">
            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>订单状态分布</h4>
              </div>
              <div className="chart-body">
                {Object.keys(statusMap).length === 0 ? <div className="empty-sm">暂无数据</div> : (
                  <div className="bar-list">
                    {Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([s, v]) => (
                      <div key={s} className="bar-row">
                        <span className="status-badge-sm" style={{ background: statusColor[s] }}>{statusLabel[s]}</span>
                        <div className="bar-track-wrap">
                          <div className="bar-track-modern">
                            <div className="bar-fill-modern" style={{ width: `${(v / orders.length) * 100}%`, background: statusColor[s] }} />
                          </div>
                        </div>
                        <span className="bar-val">{v}单</span>
                        <span className="bar-pct">{((v / orders.length) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="chart-card-modern">
              <div className="chart-header">
                <h4>加急 vs 常规</h4>
              </div>
              <div className="chart-body">
                <div className="split-bar-container">
                  <div className="split-bar">
                    <div className="split-seg urgent-seg" style={{ flex: urgentCount }}>⚡{urgentCount}</div>
                    <div className="split-seg normal-seg" style={{ flex: orders.length - urgentCount }}>📦{orders.length - urgentCount}</div>
                  </div>
                  <div className="split-legend">
                    <span><span className="split-dot" style={{ background: '#f97316' }}></span>加急 {((urgentCount / Math.max(1, orders.length)) * 100).toFixed(0)}%</span>
                    <span><span className="split-dot" style={{ background: '#6366f1' }}></span>常规 {((1 - urgentCount / Math.max(1, orders.length)) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="tab-content">
          <OrdersTable orders={orders} loading={loading} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  )
}

const statusColor = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
  completed: '#10b981', cancelled: '#ef4444'
}

/* ========== 海外节假日 ========== */
function HolidayBanner() {
  const [holidayData, setHolidayData] = useState({ current: null, next: null })
  useEffect(() => { setHolidayData(getUpcomingHolidays()) }, [])
  const { current, next } = holidayData
  if (!current) return null

  return (
    <div className="holiday-banner">
      <div className="holiday-header">
        <span className="holiday-icon">🌍</span>
        <span className="holiday-title">海外营销日历</span>
      </div>
      <div className="holiday-body">
        <div className="holiday-month">
          <span className="month-label">{current.month}月</span>
          <div className="holiday-tags">
            {current.events.map((e, i) => (
              <span key={i} className={`holiday-tag ${isImportant(e) ? 'holiday-important' : ''}`} title={e.note}>
                <span className="holiday-date">{formatDate(e.date)}</span>
                {isImportant(e) && '🔥 '}{e.name}
                <span className="holiday-region">{e.region}</span>
              </span>
            ))}
          </div>
        </div>
        {next && (
          <div className="holiday-month">
            <span className="month-label">{next.month}月</span>
            <div className="holiday-tags">
              {next.events.slice(0, 4).map((e, i) => (
                <span key={i} className={`holiday-tag ${isImportant(e) ? 'holiday-important' : ''}`} title={e.note}>
                  <span className="holiday-date">{formatDate(e.date)}</span>
                  {isImportant(e) && '🔥 '}{e.name}
                  <span className="holiday-region">{e.region}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== AI 分析 ========== */
function AIAnalysis({ orders }) {
  const [report, setReport] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (orders.length === 0) { setReport('暂无订单数据，请先导入数据～'); return }
    setAnalyzing(true); setReport('')
    setReport(await analyzeOrders(orders))
    setAnalyzing(false)
  }

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <div className="ai-card-left">
          <span className="ai-icon">🤖</span>
          <div>
            <h4>AI 智能洞察</h4>
            <p className="ai-sub">基于 Gemini AI 自动生成数据分析报告</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? '⏳ 分析中...' : '🚀 开始分析'}
        </button>
      </div>
      {report && <div className="ai-report"><div className="ai-report-content">{report}</div></div>}
    </div>
  )
}

/* ========== 订单表格 ========== */
function OrdersTable({ orders, loading, onRefresh }) {
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

  return (
    <div>
      <div className="table-toolbar">
        <h4>📋 订单明细</h4>
        <div className="table-filters">
          <input placeholder="🔍 搜索订单号..." value={search} onChange={e => setSearch(e.target.value)} className="filter-input" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">全部状态</option>
            {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="filter-select">
            <option value="">全部品类</option>
            <option>胶垫</option><option>光敏</option><option>金属</option><option>亚克力</option><option>皮革</option><option>签字笔</option>
          </select>
          <button className="btn btn-sm btn-outline" onClick={onRefresh}>🔄</button>
        </div>
      </div>
      <div className="table-wrap">
        {loading ? <div className="loading">加载中...</div> : filtered.length === 0 ? <div className="empty">暂无数据</div> : (
          <table className="order-table">
            <thead>
              <tr>
                <th>订单号</th><th>品类</th><th>产品</th><th>数量</th><th>金额</th>
                <th>状态</th><th>供应商</th><th>下单日期</th><th>加急</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td className="order-no">{o.order_no}</td>
                  <td><span className="cat-tag">{o.product_category}</span></td>
                  <td>{o.product_name}</td>
                  <td>{o.quantity}</td>
                  <td>¥{o.total_amount}</td>
                  <td><span className="status-badge" style={{ background: statusColor[o.order_status] }}>{statusLabel[o.order_status]}</span></td>
                  <td>{o.supplier || '-'}</td>
                  <td>{o.order_date}</td>
                  <td>{o.is_urgent ? '⚡' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ========== 工具函数 ========== */
function findKey(keys, candidates) {
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()))
    if (found) return found
  }
  return null
}

function formatExcelDate(val) {
  if (!val) return new Date().toISOString().split('T')[0]
  // Excel serial date number
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  // String date
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return String(val)
}

function mapStatus(s) {
  const map = { '待处理': 'pending', 'pending': 'pending', '生产中': 'processing', 'processing': 'processing', '已发货': 'shipped', 'shipped': 'shipped', '已完成': 'completed', 'completed': 'completed', '已取消': 'cancelled', 'cancelled': 'cancelled' }
  return map[s.toLowerCase()] || 'pending'
}