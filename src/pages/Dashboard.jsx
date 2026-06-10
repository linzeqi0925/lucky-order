/**
 * Lucky Order 3.0 — 经营驾驶舱
 * 
 * 核心导航框架，所有功能模块已拆分为独立页面：
 *   - OverviewDashboard: 经营驾驶舱（KPI + 趋势 + 异常 + 地图）
 *   - SkuCenter:        SKU 分析
 *   - CountryCenter:    国家分析
 *   - StoreCenter:      店铺分析
 *   - AiInsightCenter:  AI 洞察
 *   - DataCenter:       数据管理
 *   - DataImport:       数据导入
 */

import { Component, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrders, useOrderItems } from '../hooks/useOrders'
import OverviewDashboard from './OverviewDashboard'
import SegmentAnalysis from './SegmentAnalysis'
import SkuCenter from './SkuCenter'
import CategoryCenter from './CategoryCenter'
import NewProductCenter from './NewProductCenter'
import AiInsightCenter from './AiInsightCenter'
import DataManagement from './DataManagement'
import RulesModal from '../components/RulesModal'
import { getEffectiveOrderItems } from '../lib/skuFallback'

const NAV_ITEMS = [
  { key: 'overview', label: '经营总览', icon: '📊', desc: '订单、SKU、店铺和国家表现总览' },
  { key: 'orders', label: '订单分析', icon: '📋', desc: '订单趋势、明细、店铺和国家维度' },
  { key: 'sku', label: 'SKU 分析', icon: '📦', desc: 'SKU 排行、趋势、爆款和滞销预警' },
  { key: 'category', label: '品类分析', icon: '🏷️', desc: '经营一级品类、店铺结构和出库占比' },
  { key: 'new', label: '新品观察', icon: '🆕', desc: '按品类观察新品起量和覆盖 SKU' },
  { key: 'risk', label: '异常监控', icon: '🚨', desc: '下降、滞销、集中度和经营建议' },
  { key: 'data', label: '数据管理', icon: '💾', desc: '导入、清空、导出和分类规则' },
]

class ContentErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="dashboard-view">
        <div className="chart-card wide">
          <div className="chart-title">当前栏目加载失败</div>
          <p className="modal-desc">你可以先切换到“数据导入”或“数据中心”。错误信息：</p>
          <div className="error-msg">{this.state.error.message}</div>
        </div>
      </div>
    )
  }
}

export default function Dashboard({ session }) {
  const [user, setUser] = useState(session?.user || null)
  const { orders, loading, loadOrders } = useOrders(user)
  const { items: orderItems, loading: itemsLoading, loadItems } = useOrderItems(user)
  const effectiveOrderItems = getEffectiveOrderItems(orders, orderItems)
  const [activeNav, setActiveNav] = useState('overview')
  const [showRules, setShowRules] = useState(false)
  const activeItem = NAV_ITEMS.find(item => item.key === activeNav) || NAV_ITEMS[0]
  const latestDate = orders.map(o => o.order_date).filter(Boolean).sort().at(-1) || '-'

  useEffect(() => {
    if (session?.user) {
      setUser(session.user)
      return
    }

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error || !data.user) {
          supabase.auth.signOut()
          return
        }
        setUser(data.user)
      })
      .catch(() => supabase.auth.signOut())
  }, [session])

  // 共享组件同时需要加载数据
  const handleImported = (result) => {
    loadOrders()
    loadItems()
    if (result) {
      const msg = `✅ 导入完成\n新增订单: ${result.inserted}\n刷新已有: ${result.updated || 0}\n跳过重复: ${result.skipped}\nSKU 明细: ${result.insertedItems || 0}`
      alert(msg)
    }
    setActiveNav('overview')
  }

  const handleExportCSV = async () => {
    const user = (await supabase.auth.getUser()).data.user
    if (!user || orders.length === 0) return

    const headers = ['订单编号','店铺','国家','商品','品类','数量','日期','星期','状态']
    const rows = orders.map(o => [
      o.order_no, o.store_name, o.country, o.product_name,
      o.product_category, o.quantity, o.order_date, o.weekday||'', o.order_status||''
    ])

    let csv = '\uFEFF' + headers.join(',') + '\n'
    rows.forEach(r => {
      csv += r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `订单明细_${new Date().toISOString().slice(0,10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (!user) return (
    <div className="app-loading">
      <div className="spinner"></div>
      <p>正在进入工作台...</p>
    </div>
  )

  return (
    <div className="dashboard">
      {/* 侧边导航 */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-box">LO</div>
          <div>
            <h2>Lucky Order</h2>
            <span>跨境履约经营工具</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => setActiveNav(item.key)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>数据更新</span>
          <strong>{latestDate}</strong>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="page-header">
          <div>
            <h1>{activeItem.label}</h1>
            <p>{activeItem.desc}</p>
          </div>
          <div className="page-actions">
            <button className="btn-outline-sm" onClick={() => setShowRules(true)} title="人工分类 / 品类归并">🏷️ 规则</button>
            <button className="btn-outline-sm" onClick={handleExportCSV} disabled={orders.length === 0}>
              📥 导出明细
            </button>
            <div className="user-chip">
              <div className="user-avatar">{user.email?.charAt(0).toUpperCase()}</div>
              <span className="user-email">{user.email?.split('@')[0]}</span>
            </div>
            <button className="btn-outline-sm" onClick={handleLogout}>退出</button>
          </div>
        </header>

        {/* 主内容区 */}
        <div className="dashboard-body">
          <ContentErrorBoundary resetKey={activeNav}>
            {activeNav === 'overview' && (
              <OverviewDashboard
                orders={orders}
                orderItems={effectiveOrderItems}
                loading={loading}
                onRefresh={loadOrders}
                summaryOnly
              />
            )}
            {activeNav === 'orders' && (
              <SegmentAnalysis orders={orders} orderItems={effectiveOrderItems} />
            )}
            {activeNav === 'sku' && (
              <SkuCenter orders={orders} orderItems={effectiveOrderItems} />
            )}
            {activeNav === 'category' && (
              <CategoryCenter orders={orders} orderItems={effectiveOrderItems} />
            )}
            {activeNav === 'new' && (
              <NewProductCenter orders={orders} orderItems={effectiveOrderItems} />
            )}
            {activeNav === 'risk' && (
              <AiInsightCenter orders={orders} orderItems={effectiveOrderItems} />
            )}
            {activeNav === 'data' && (
              <DataManagement
                user={user}
                orders={orders}
                onImported={handleImported}
                onRefresh={() => { loadOrders(); loadItems() }}
                onOpenRules={() => setShowRules(true)}
              />
            )}
          </ContentErrorBoundary>
        </div>
      </main>

      {/* 弹窗 */}
      {showRules && (
        <RulesModal
          orders={orders}
          onApplied={loadOrders}
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  )
}
