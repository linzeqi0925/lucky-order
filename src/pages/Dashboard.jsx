import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeOrders } from '../lib/analyzer'
import { getUpcomingHolidays, formatDate, isImportant } from '../lib/holidays'
import { loadRules, saveRules, classifyProduct } from '../lib/classifier'
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
  const [showClear, setShowClear] = useState(false)
  const [clearing, setClearing] = useState(false)
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
          <button className="btn-outline-sm" onClick={() => setShowClear(true)} disabled={orders.length === 0} style={{color:'#dc2626',borderColor:'#fecaca'}}>🗑️ 清空</button>
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
      {/* 清空弹窗 */}
      {showClear && <ClearModal user={user} onClose={() => setShowClear(false)} onCleared={() => { setOrders([]); setShowClear(false) }} />}
    </div>
  )
}

/* ========== 清空数据弹窗 ========== */
function ClearModal({ user, onClose, onCleared }) {
  const [step, setStep] = useState(0)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleClear = async () => {
    setDeleting(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('orders')
        .delete()
        .eq('user_id', user.id)
      if (err) throw err
      onCleared()
    } catch (err) {
      setError('清空失败：' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {step === 0 ? (
          <>
            <h3 style={{color:'#dc2626'}}>⚠️ 清空数据确认</h3>
            <p className="modal-desc" style={{marginTop:8}}>
              此操作将<strong style={{color:'#dc2626'}}>永久删除</strong>你账号下的全部订单数据（共 {user.ordersCount || '全部'} 条），无法恢复！
            </p>
            <p className="modal-desc">确认要继续吗？</p>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn-ghost" onClick={onClose} style={{flex:1}}>取消</button>
              <button className="btn-primary-sm" onClick={() => setStep(1)} style={{flex:1,background:'#dc2626'}}>确认清空</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{color:'#dc2626'}}>🗑️ 最后确认</h3>
            <p className="modal-desc" style={{marginTop:8}}>输入 <strong>DELETE</strong> 确认清空所有数据</p>
            <input placeholder='输入 DELETE 确认' className="filter-input" style={{width:'100%',marginBottom:12}}
              value={confirmText} onChange={e => setConfirmText(e.target.value)} />
            {confirmText === 'DELETE' && (
              <>
                {error && <div className="error-msg">{error}</div>}
                <button className="btn-primary-sm" onClick={handleClear} disabled={deleting}
                  style={{width:'100%',background:'#dc2626'}}>
                  {deleting ? '⏳ 清空中...' : '✅ 确认清空全部数据'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ========== 马帮导入引擎（V2 重构） ========== */

// 国家名标准化映射
const COUNTRY_MAP = {
  'united states': '美国', 'us': '美国', 'usa': '美国', 'america': '美国',
  'united kingdom': '英国', 'uk': '英国', 'england': '英国',
  'canada': '加拿大', 'ca': '加拿大',
  'australia': '澳大利亚', 'au': '澳大利亚',
  'germany': '德国', 'de': '德国', 'deutschland': '德国',
  'france': '法国', 'fr': '法国',
  'japan': '日本', 'jp': '日本',
  'south korea': '韩国', 'korea': '韩国', 'kr': '韩国',
  'italy': '意大利', 'it': '意大利',
  'spain': '西班牙', 'es': '西班牙',
  'netherlands': '荷兰', 'nl': '荷兰', 'holland': '荷兰',
  'brazil': '巴西', 'br': '巴西',
  'mexico': '墨西哥', 'mx': '墨西哥',
  'singapore': '新加坡', 'sg': '新加坡',
  'india': '印度', 'in': '印度',
  'new zealand': '新西兰', 'nz': '新西兰',
  'sweden': '瑞典', 'se': '瑞典',
  'switzerland': '瑞士', 'ch': '瑞士',
  'norway': '挪威', 'no': '挪威',
  'denmark': '丹麦', 'dk': '丹麦',
  'poland': '波兰', 'pl': '波兰',
  'russia': '俄罗斯', 'ru': '俄罗斯',
  'thailand': '泰国', 'th': '泰国',
  'vietnam': '越南', 'vn': '越南',
  'malaysia': '马来西亚', 'my': '马来西亚',
  'philippines': '菲律宾', 'ph': '菲律宾',
  'indonesia': '印度尼西亚', 'id': '印度尼西亚',
  'turkey': '土耳其', 'tr': '土耳其',
  'saudi arabia': '沙特阿拉伯', 'sa': '沙特阿拉伯',
  'uae': '阿联酋', 'united arab emirates': '阿联酋',
}

function normalizeCountry(val) {
  if (!val) return ''
  const key = val.toString().trim().toLowerCase()
  return COUNTRY_MAP[key] || val.toString().trim()
}

// 从发货时间提取星期
function getWeekday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

// 从发货时间提取月份
function getMonth(dateStr) {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}年${parseInt(m[2])}月` : ''
}

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
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      if (!rawRows || rawRows.length < 2) throw new Error('表格中没有数据')

      const header = rawRows[0]
      const dataRows = rawRows.slice(1).filter(r => r.some(c => c !== ''))
      if (dataRows.length === 0) throw new Error('表格中没有数据')

      // 检测马帮格式
      const isMabang = header.some(h => ['订单编号','SKU','店铺名','订单商品名称','发货时间'].includes(h))

      let orders, cleanInfo
      if (isMabang) {
        const result = processMabang(header, dataRows)
        orders = result.orders
        cleanInfo = result.cleanInfo
      } else {
        // 通用格式：简单映射
        const keys = header
        const fieldMap = {
          order_no: findKey(keys, ['订单号','订单编号','order_no','OrderNo']),
          product_category: findKey(keys, ['品类','产品大类','分类','category']),
          product_name: findKey(keys, ['产品名称','商品名称','product_name']),
          quantity: findKey(keys, ['数量','出库量','qty','Qty','quantity']),
          order_date: findKey(keys, ['日期','下单日期','出库日期','date','Date']),
          store_name: findKey(keys, ['店铺名','店铺','store_name']),
          country: findKey(keys, ['国家','country']),
        }
        orders = dataRows.map((row, i) => {
          const get = (k) => k ? String(row[header.indexOf(k)] ?? '') : ''
          const dateStr = get(fieldMap.order_date)
          return {
            order_no: get(fieldMap.order_no) || `IMP-${Date.now()}-${i}`,
            store_name: get(fieldMap.store_name),
            country: normalizeCountry(get(fieldMap.country)),
            province: '',
            product_name: get(fieldMap.product_name),
            product_sku: '',
            product_category: get(fieldMap.product_category) || '未分类',
            quantity: parseInt(get(fieldMap.quantity)) || 1,
            order_date: formatExcelDate(dateStr),
            weekday: getWeekday(dateStr),
            month: getMonth(dateStr),
            total_amount: 0,
          }
        })
        cleanInfo = { rawRows: dataRows.length, mergedOrders: orders.length, filledDown: 0, normalizedCountries: 0, orders }
      }

      setPreview({ orders: orders.slice(0, 20), total: orders.length, allOrders: orders, cleanInfo, isMabang })
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
      const orders = preview.allOrders
      let imported = 0
      for (let i = 0; i < orders.length; i += 100) {
        const batch = orders.slice(i, i + 100).map(o => ({
          user_id: user.id,
          order_no: String(o.order_no),
          store_name: o.store_name || '',
          country: o.country || '',
          province: o.province || '',
          product_category: o.product_category || '未分类',
          product_name: o.product_name || '',
          product_sku: o.product_sku || '',
          quantity: o.quantity || 1,
          total_amount: o.total_amount || 0,
          order_date: o.order_date || new Date().toISOString().split('T')[0],
          order_status: 'completed',
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
          <p>支持马帮ERP原始文件，自动清洗、填充、聚合、标准化</p>
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
            {/* 清洗预览头部 */}
            <div className="preview-header">
              <span className="preview-count">
                🚚 马帮文件 · <strong>{preview.total}</strong> 笔订单
                <span className="mabang-badge">已清洗</span>
              </span>
              <div className="preview-actions">
                <button className="btn-ghost" onClick={() => setPreview(null)}>取消</button>
                <button className="btn-primary-sm" onClick={handleImport} disabled={parsing}>
                  {parsing ? '⏳ 导入中...' : '✅ 确认导入'}
                </button>
              </div>
            </div>

            {/* 数据清洗报告 */}
            <div className="clean-report">
              <div className="clean-stat"><span className="clean-label">原始行数</span><span className="clean-val">{preview.cleanInfo.rawRows}</span></div>
              <div className="clean-stat"><span className="clean-label">合并后订单</span><span className="clean-val">{preview.cleanInfo.mergedOrders}</span></div>
              <div className="clean-stat"><span className="clean-label">空号填充</span><span className="clean-val">{preview.cleanInfo.filledDown} 行</span></div>
              <div className="clean-stat"><span className="clean-label">国家标准化</span><span className="clean-val">{preview.cleanInfo.normalizedCountries} 条</span></div>
              <div className="clean-stat"><span className="clean-label">维度</span><span className="clean-val">订单级别 ✅</span></div>
            </div>

            {/* 字段映射 */}
            <div className="field-mapping-bar">
              <span className="mapping-chip"><span className="chip-field">订单编号</span> 强制字符串 + 向下填充</span>
              <span className="mapping-chip"><span className="chip-field">商品/SKU</span> 同订单自动聚合</span>
              <span className="mapping-chip"><span className="chip-field">国家</span> 标准化（US→美国）</span>
              <span className="mapping-chip"><span className="chip-field">发货时间</span> 提取日/星期/月份</span>
            </div>

            {/* 预览数据（订单维度） */}
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead><tr><th>订单号</th><th>店铺</th><th>国家</th><th>商品/SKU</th><th>数量</th><th>日期</th><th>星期</th></tr></thead>
                <tbody>{preview.orders.map((o, i) => (
                  <tr key={i}>
                    <td><span className="orderno-sm">{o.order_no}</span></td>
                    <td>{o.store_name}</td>
                    <td>{o.country}</td>
                    <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{o.product_name}</td>
                    <td>{o.quantity}</td>
                    <td>{o.order_date}</td>
                    <td>{o.weekday}</td>
                  </tr>
                ))}</tbody>
              </table>
              {preview.total > 20 && <p className="preview-more">...还有 {preview.total - 20} 笔订单</p>}
            </div>
            {error && <div className="error-msg">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== 马帮处理核心 ========== */
function processMabang(header, dataRows) {
  const idx = (name) => header.indexOf(name)

  const orderNoIdx = idx('订单编号')
  const storeIdx = idx('店铺名')
  const skuTotalIdx = idx('SKU总数量')
  const skuDetailIdx = idx('SKU明细')
  const countryIdx = idx('国家')
  const provinceIdx = idx('所属地区（省/州）')
  const cityIdx = idx('所属城市')
  const skuIdx = idx('SKU')
  const productNameIdx = idx('订单商品名称')
  const dateIdx = idx('发货时间')

  // Step 1: 填充空白订单号（向下填充）
  let lastOrderNo = ''
  let filledDown = 0
  let normalizedCountries = 0
  const filled = dataRows.map(row => {
    const rawNo = row[orderNoIdx]
    if (rawNo && rawNo.toString().trim()) {
      lastOrderNo = rawNo.toString().trim()
    } else {
      filledDown++
    }
    const rawCountry = row[countryIdx]
    const normCountry = normalizeCountry(rawCountry)
    if (normCountry !== (rawCountry || '').toString().trim() && rawCountry) normalizedCountries++
    return {
      order_no: lastOrderNo,
      store_name: String(row[storeIdx] || ''),
      country: normCountry,
      province: String(row[provinceIdx] || ''),
      city: String(row[cityIdx] || ''),
      sku: String(row[skuIdx] || ''),
      product_name: String(row[productNameIdx] || ''),
      quantity: parseInt(row[skuTotalIdx]) || 1,
      rawDate: row[dateIdx],
    }
  })

  // Step 2: 按订单号聚合（订单维度）
  const orderMap = {}
  filled.forEach(row => {
    if (!row.order_no) return
    if (!orderMap[row.order_no]) {
      orderMap[row.order_no] = {
        order_no: row.order_no,
        store_name: row.store_name,
        country: row.country,
        province: row.province,
        totalQty: 0,
        skus: [],
        productNames: [],
        rawDate: row.rawDate,
      }
    }
    const o = orderMap[row.order_no]
    o.totalQty += row.quantity
    if (row.sku && !o.skus.includes(row.sku)) o.skus.push(row.sku)
    if (row.product_name && !o.productNames.includes(row.product_name)) o.productNames.push(row.product_name)
    // 取最新的店铺/国家
    if (row.store_name) o.store_name = row.store_name
    if (row.country) o.country = row.country
    if (row.rawDate && !o.rawDate) o.rawDate = row.rawDate
  })

  // Step 3: 转为订单维度数据
  const orders = Object.values(orderMap).map(o => {
    const dateStr = formatExcelDate(o.rawDate)
    return {
      order_no: o.order_no,
      store_name: o.store_name,
      country: o.country,
      province: o.province,
      product_name: o.productNames.join('; ') || o.skus.join(', '),
      product_sku: o.skus.join(', '),
      product_category: classifyProduct(o.productNames[0] || o.skus[0] || ''),
      quantity: o.totalQty,
      order_date: dateStr,
      weekday: getWeekday(dateStr),
      month: getMonth(dateStr),
      total_amount: 0,
    }
  })

  return {
    orders,
    cleanInfo: {
      rawRows: dataRows.length,
      mergedOrders: orders.length,
      filledDown,
      normalizedCountries,
    }
  }
}

/* ========== 数据看板 ========== */
function DashboardView({ orders, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [drillCat, setDrillCat] = useState('')
  const [trendDays, setTrendDays] = useState(7)

  const allCats = [...new Set(orders.map(o => o.product_category).filter(Boolean))]
  const allSups = [...new Set(orders.map(o => o.supplier).filter(Boolean))]
  const allStores = [...new Set(orders.map(o => o.store_name).filter(Boolean))]

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

  // 直接读字段
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
  filtered.forEach(o => {
    const s = o.store_name
    if (s) storeMap[s] = (storeMap[s] || 0) + o.quantity
  })
  const storeSorted = Object.entries(storeMap).sort((a, b) => b[1] - a[1])

  // 环比计算
  const getPeriodData = (orders, days) => {
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString().split('T')[0]
    const cur = orders.filter(o => o.order_date >= start && o.order_date <= end)
    const prev = orders.filter(o => o.order_date >= prevStart && o.order_date < start)
    return {
      curQty: cur.reduce((s, o) => s + o.quantity, 0),
      prevQty: prev.reduce((s, o) => s + o.quantity, 0),
      curOrders: cur.length,
      prevOrders: prev.length,
    }
  }
  const period7 = getPeriodData(orders, 7)
  const orderChange = period7.prevOrders > 0 ? ((period7.curOrders - period7.prevOrders) / period7.prevOrders * 100).toFixed(0) : 0
  const qtyChange = period7.prevQty > 0 ? ((period7.curQty - period7.prevQty) / period7.prevQty * 100).toFixed(0) : 0

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

  // 热力图数据（周几×周次）
  const heatData = {}
  filtered.forEach(o => {
    if (!o.order_date) return
    const d = new Date(o.order_date)
    const dayOfWeek = d.getDay() // 0=周日
    const weekNum = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 604800000)
    const key = `${dayOfWeek}-${weekNum}`
    heatData[key] = (heatData[key] || 0) + o.quantity
  })
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六']
  const heatMax = Math.max(...Object.values(heatData), 1)

  // 对比分析：可选两个时间段
  const [compareMode, setCompareMode] = useState(false)
  const [period1, setPeriod1] = useState({ start: '', end: '' })
  const [period2, setPeriod2] = useState({ start: '', end: '' })
  const getPeriodStats = (start, end) => {
    const d = orders.filter(o => o.order_date >= start && o.order_date <= end)
    return { total: d.length, qty: d.reduce((s, o) => s + o.quantity, 0), amt: d.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) }
  }

  const clearFilters = () => { setDateRange({ start: '', end: '' }); setFilterCategory(''); setFilterSupplier(''); setFilterStore(''); setDrillCat('') }
  const handleCatClick = (cat) => { setFilterCategory(cat); setActiveTab('table') }

  // AI 自动发现异常
  const findDrops = (field, labelMap) => {
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const start30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const prev30 = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0]
    const cur = orders.filter(o => o.order_date >= start30 && o.order_date <= end)
    const prev = orders.filter(o => o.order_date >= prev30 && o.order_date < start30)
    if (cur.length < 5) return []
    const curMap = {}, prevMap = {}
    cur.forEach(o => { const v = field(o) || '未知'; curMap[v] = (curMap[v] || 0) + 1 })
    prev.forEach(o => { const v = field(o) || '未知'; prevMap[v] = (prevMap[v] || 0) + 1 })
    return Object.entries(curMap).map(([k, v]) => {
      const pv = prevMap[k] || 0
      const chg = pv > 0 ? ((v - pv) / pv * 100).toFixed(0) : 0
      return { name: k, cur: v, prev: pv, change: parseFloat(chg) }
    }).sort((a, b) => a.change - b.change).filter(x => x.prev >= 3).slice(0, 5)
  }
  const aiDrops = {
    categories: findDrops(o => o.product_category),
    stores: findDrops(o => o.store_name),
    countries: findDrops(o => o.country),
  }

  // 趋势数据（放到组件内）
  const getTrendDayMap = (all, days) => {
    const now = new Date()
    const map = {}
    for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); map[d.toISOString().split('T')[0]] = 0 }
    all.forEach(o => { if (map[o.order_date] !== undefined) map[o.order_date]++ })
    return map
  }
  const trendMap = getTrendDayMap(orders, trendDays)
  const trendLabels = Object.keys(trendMap).map(d => d.slice(5))
  const trendOrders = Object.values(trendMap)

  return (
    <div className="dashboard-view">
      <HolidayBanner />

      {/* 筛选器 */}
      <div className="filter-bar">
        <div className="filter-group"><label>时间</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="filter-input" />
          <span className="filter-sep">—</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="filter-input" />
        </div>
        <div className="filter-group"><label>品类</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="filter-input">
            <option value="">全部</option>{allCats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group"><label>店铺</label>
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="filter-input">
            <option value="">全部</option>{allStores.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group"><label>供应商</label>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="filter-input">
            <option value="">全部</option>{allSups.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {hasFilter && <button className="btn-clear" onClick={clearFilters}>✕ 清除</button>}
        <div className="filter-count">筛选：<strong>{total}</strong> 单</div>
      </div>

      {/* ===== 第一屏：核心 KPI（多期环比） ===== */}
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

      {/* ===== 第二屏：AI 经营洞察 ===== */}
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

      {/* ===== 第三屏：趋势 ===== */}
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

      {/* ===== 第四屏：异常监控 ===== */}
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
        <button className={`tab-pill ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>品类</button>
        <button className={`tab-pill ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>趋势</button>
        <button className={`tab-pill ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')}>热力图</button>
        <button className={`tab-pill ${activeTab === 'store' ? 'active' : ''}`} onClick={() => setActiveTab('store')}>店铺</button>
        <button className={`tab-pill ${activeTab === 'country' ? 'active' : ''}`} onClick={() => setActiveTab('country')}>国家</button>
        <button className={`tab-pill ${activeTab === 'supplier' ? 'active' : ''}`} onClick={() => setActiveTab('supplier')}>供应商</button>
        <button className={`tab-pill ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>明细</button>
        <button className={`tab-pill ${activeTab === 'newproduct' ? 'active' : ''}`} onClick={() => setActiveTab('newproduct')}>新品</button>
        <button className={`tab-pill ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI</button>
      </div>

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
          {/* 环比卡片 */}
          <div className="stats-grid">
            <div className="stat-item"><span className="stat-l">近7天订单</span><span className="stat-v">{period7.curOrders} <span className={`trend-s ${orderChange>=0?'up':'down'}`}>{orderChange>=0?'↑':'↓'}{Math.abs(orderChange)}%</span></span></div>
            <div className="stat-item"><span className="stat-l">近7天出库量</span><span className="stat-v">{period7.curQty} <span className={`trend-s ${qtyChange>=0?'up':'down'}`}>{qtyChange>=0?'↑':'↓'}{Math.abs(qtyChange)}%</span></span></div>
            <div className="stat-item"><span className="stat-l">日均出库</span><span className="stat-v">{(totalQty/Math.max(1,now.getDate())).toFixed(1)}件</span></div>
            <div className="stat-item"><span className="stat-l">完成率</span><span className="stat-v">{(((statusMap['completed']||0) / Math.max(1, total)) * 100).toFixed(0)}%</span></div>
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
            <div className="stat-item"><span className="stat-l">完成率</span><span className="stat-v">{(((statusMap['completed']||0) / Math.max(1, total)) * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      )}

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

      {/* 对比模式弹窗 */}
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

      {activeTab === 'table' && (
        <div className="tab-content">
          <OrderTable orders={filtered} loading={loading} onRefresh={onRefresh} />
        </div>
      )}

      {activeTab === 'newproduct' && (
        <NewProductTracker orders={filtered} allOrders={orders} />
      )}

      {activeTab === 'ai' && (
        <div className="tab-content">
          <AIInsight orders={filtered} />
        </div>
      )}
    </div>
  )
}

/* ========== 新品追踪 ========== */
function NewProductTracker({ orders, allOrders }) {
  const STORAGE_KEY = 'lucky_order_new_products'
  const [newProducts, setNewProducts] = useState([])
  const [name, setName] = useState('')
  const [launchDate, setLaunchDate] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setNewProducts(saved)
    } catch {}
  }, [])

  const save = (items) => {
    setNewProducts(items)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }

  const handleAdd = () => {
    if (!name.trim() || !launchDate) return
    const item = { id: Date.now(), name: name.trim(), launchDate, addedAt: new Date().toISOString() }
    save([...newProducts, item])
    setName('')
    setLaunchDate('')
  }

  const handleDelete = (id) => save(newProducts.filter(p => p.id !== id))

  // 计算每个新品的出库数据
  const getProductData = (prod) => {
    // 从所有订单中匹配产品名包含新品名称的记录
    const matched = allOrders.filter(o => {
      const pn = (o.product_name || '').toLowerCase()
      return pn.includes(prod.name.toLowerCase())
    })
    // 上线后的数据
    const afterLaunch = matched.filter(o => o.order_date >= prod.launchDate)
    // 上线前的数据（如果有的话，说明不是新品）
    const beforeLaunch = matched.filter(o => o.order_date < prod.launchDate)
    const totalQty = afterLaunch.reduce((s, o) => s + o.quantity, 0)
    // 每日趋势
    const dayMap = {}
    afterLaunch.sort((a, b) => a.order_date.localeCompare(b.order_date)).forEach(o => {
      dayMap[o.order_date] = (dayMap[o.order_date] || 0) + o.quantity
    })
    return {
      totalQty,
      orderCount: afterLaunch.length,
      daysOnMarket: Object.keys(dayMap).length,
      dailyAvg: Object.keys(dayMap).length > 0 ? (totalQty / Object.keys(dayMap).length).toFixed(1) : 0,
      trend: Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])),
      hasBeforeData: beforeLaunch.length > 0
    }
  }

  return (
    <div className="tab-content">
      <div className="tracker-header">
        <div>
          <h3 className="tracker-title">✨ 新品追踪</h3>
          <p className="tracker-desc">添加新品并设置上线日期，系统自动跟踪出库表现</p>
        </div>
      </div>

      {/* 添加新品 */}
      <div className="tracker-add">
        <input placeholder="新品名称（如：光敏印章-新款）" value={name} onChange={e => setName(e.target.value)} className="filter-input" style={{flex:2}} />
        <input type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)} className="filter-input" />
        <button className="btn-primary-sm" onClick={handleAdd} disabled={!name.trim() || !launchDate}>➕ 添加新品</button>
      </div>

      {newProducts.length === 0 ? (
        <div className="empty-state">📭 还没有新品，在上方添加并设置上线日期</div>
      ) : (
        <div className="tracker-list">
          {newProducts.map(prod => {
            const data = getProductData(prod)
            return (
              <div key={prod.id} className="tracker-card">
                <div className="tracker-top">
                  <div className="tracker-info">
                    <h4>{prod.name}</h4>
                    <span className="tracker-meta">
                      🚀 上线 {prod.launchDate} · 📅 已上架 {data.daysOnMarket} 天
                      {data.hasBeforeData && <span className="tracker-warn"> ⚠️ 上线前已有数据</span>}
                    </span>
                  </div>
                  <button className="tracker-del" onClick={() => handleDelete(prod.id)} title="移除">✕</button>
                </div>
                <div className="tracker-stats">
                  <div className="ts-item"><span className="ts-num">{data.orderCount}</span><span className="ts-label">订单数</span></div>
                  <div className="ts-item"><span className="ts-num">{data.totalQty}</span><span className="ts-label">出库量</span></div>
                  <div className="ts-item"><span className="ts-num">{data.dailyAvg}</span><span className="ts-label">日均出库</span></div>
                </div>
                {data.trend.length > 0 && (
                  <div className="tracker-chart" style={{height:120}}>
                    <ReactECharts option={{
                      tooltip: { trigger: 'axis' },
                      grid: { left: 30, right: 10, top: 10, bottom: 20 },
                      xAxis: { type: 'category', data: data.trend.map(([d]) => d.slice(5)), axisLabel: { fontSize: 10 } },
                      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
                      series: [{ type: 'line', data: data.trend.map(([, v]) => v), smooth: true, symbol: 'circle', symbolSize: 6,
                        lineStyle: { color: '#8b5cf6', width: 2 },
                        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.3)' }, { offset: 1, color: 'rgba(139,92,246,0.02)' }] } },
                        itemStyle: { color: '#8b5cf6' }
                      }]
                    }} style={{height:'100%'}} opts={{renderer:'svg'}} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ========== 经营驾驶舱辅助组件 ========== */

function KpiCard({ icon, label, value, fmt, yesterday, week, month }) {
  const changes = [
    { label: '昨日', val: yesterday },
    { label: '上周', val: week },
    { label: '上月', val: month },
  ].filter(c => c.val !== undefined)
  return (
    <div className="kpi-card-v2">
      <div className="kpi-v2-top">
        <span className="kpi-v2-icon">{icon}</span>
        <span className="kpi-v2-label">{label}</span>
      </div>
      <div className="kpi-v2-value">{fmt ? fmt(value) : value}</div>
      <div className="kpi-v2-changes">
        {changes.map(c => (
          <span key={c.label} className={`kpi-v2-change ${c.val >= 0 ? 'up' : 'down'}`}>
            {c.label} {c.val >= 0 ? '↑' : '↓'}{Math.abs(c.val)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function MonitorCard({ title, items }) {
  return (
    <div className="monitor-card">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="monitor-empty">✅ 无异常</p> : (
        items.map((item, i) => (
          <div key={i} className="monitor-item">
            <span className="monitor-name">{item.name}</span>
            <span className="monitor-change down">{item.change}%</span>
            <span className="monitor-detail">{item.cur}单 vs {item.prev}单</span>
          </div>
        ))
      )}
    </div>
  )
}

// 辅助计算函数
function getDayComp(orders, days, type) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
  const dayBefore = new Date(now.getTime() - (days + 1) * 86400000).toISOString().split('T')[0]
  const cur = orders.filter(o => o.order_date === yesterday)
  const prev = orders.filter(o => o.order_date === dayBefore)
  const get = (arr, t) => t === 'qty' ? arr.reduce((s, o) => s + o.quantity, 0) : t === 'amount' ? arr.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) : arr.length
  const cv = get(cur, type || 'count'), pv = get(prev, type || 'count')
  return pv > 0 ? Math.round((cv - pv) / pv * 100) : 0
}
function getPeriodComp(orders, days, type) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
  const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString().split('T')[0]
  const cur = orders.filter(o => o.order_date >= start && o.order_date <= end)
  const prev = orders.filter(o => o.order_date >= prevStart && o.order_date < start)
  const get = (arr, t) => t === 'qty' ? arr.reduce((s, o) => s + o.quantity, 0) : t === 'amount' ? arr.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) : arr.length
  const cv = get(cur, type || 'count'), pv = get(prev, type || 'count')
  return pv > 0 ? Math.round((cv - pv) / pv * 100) : 0
}

function renderAIAlerts(items, typeName, icon) {
  const bad = items.filter(x => x.change < -10).slice(0, 3)
  if (bad.length === 0) return null
  return (
    <div className="ai-alert-group">
      {bad.map((item, i) => (
        <div key={i} className="ai-alert-item" style={i === 0 ? {background:'#fef2f2',borderColor:'#fecaca'} : {}}>
          <span className="ai-alert-icon">{icon}</span>
          <span className="ai-alert-text"><strong>{item.name}</strong> 下降 {item.change}%</span>
          <span className="ai-alert-detail">{item.cur}单 → {item.prev}单</span>
        </div>
      ))}
    </div>
  )
}
function renderAIGrowth(items, typeName) {
  const good = items.filter(x => x.change > 20).slice(0, 3)
  if (good.length === 0) return null
  return (
    <div className="ai-growth-group">
      {good.map((item, i) => (
        <div key={i} className="ai-growth-item">
          <span>🔥 <strong>{item.name}</strong> 增长 <span className="growth-pct">{item.change}%</span></span>
        </div>
      ))}
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
            <thead><tr><th>订单号</th><th>品类</th><th>产品</th><th>库存SKU</th><th>数量</th><th>供应商</th><th>店铺</th><th>国家</th><th>日期</th></tr></thead>
            <tbody>{filtered.map(o => (
              <tr key={o.id}>
                <td><span className="orderno">{o.order_no}</span></td>
                <td><span className="cat-tag">{o.product_category}</span></td>
                <td>{o.product_name}</td>
                <td>{o.product_sku || '-'}</td>
                <td>{o.quantity}</td>
                <td>{o.supplier || '-'}</td>
                <td>{o.store_name || '-'}</td>
                <td>{o.country || '-'}</td>
                <td>{o.order_date}</td>
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
function parseMeta(remark, key) {
  if (!remark) return ''
  const m = remark.match(new RegExp(`\\[${key}:([^\\]]+)\\]`))
  return m ? m[1] : ''
}
function findKey(keys, candidates) { for (const c of candidates) { const f = keys.find(k => k.toLowerCase().includes(c.toLowerCase())); if (f) return f } return null }
function formatExcelDate(val) { if (!val) return new Date().toISOString().split('T')[0]; if (typeof val === 'number') { const d = new Date((val - 25569) * 86400 * 1000); return d.toISOString().split('T')[0] }; const d = new Date(val); return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(val) }