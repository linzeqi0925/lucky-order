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

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrders, useOrderItems, useFilters } from '../hooks/useOrders'
import OverviewDashboard from './OverviewDashboard'
import SkuCenter from './SkuCenter'
import CountryCenter from './CountryCenter'
import StoreCenter from './StoreCenter'
import AiInsightCenter from './AiInsightCenter'
import DataCenter from './DataCenter'
import DataImport from './DataImport'
import RulesModal from '../components/RulesModal'

const NAV_ITEMS = [
  { key: 'overview',    label: '经营驾驶舱', icon: '📊' },
  { key: 'sku',         label: 'SKU中心',     icon: '📦' },
  { key: 'country',     label: '国家中心',    icon: '🌍' },
  { key: 'store',       label: '店铺中心',    icon: '🏪' },
  { key: 'ai',          label: 'AI洞察',      icon: '🧠' },
  { key: 'import',      label: '数据导入',    icon: '📥' },
  { key: 'data',        label: '数据中心',    icon: '💾' },
]

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const { orders, loading, loadOrders } = useOrders(user)
  const { items: orderItems, loading: itemsLoading, loadItems } = useOrderItems(user)
  const [activeNav, setActiveNav] = useState('overview')
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  // 共享组件同时需要加载数据
  const handleImported = (result) => {
    loadOrders()
    loadItems()
    if (result) {
      const msg = `✅ 导入完成\n新增订单: ${result.inserted}\n跳过重复: ${result.skipped}`
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

  if (!user) return null

  return (
    <div className="dashboard">
      {/* 顶部导航 */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-box">LO</div>
          <div>
            <h2>Lucky Order 3.0</h2>
            <span className="badge">跨境电商运营分析</span>
          </div>
        </div>
        <div className="topbar-center">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => setActiveNav(item.key)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="topbar-right">
          <button className="btn-outline-sm" onClick={() => setShowRules(true)} title="智能分类规则">🏷️ 规则</button>
          <button className="btn-outline-sm" onClick={handleExportCSV} disabled={orders.length === 0}>
            📥 导出明细
          </button>
          <div className="user-avatar">{user.email?.charAt(0).toUpperCase()}</div>
          <span className="user-email">{user.email?.split('@')[0]}</span>
          <button className="btn-outline-sm" onClick={handleLogout}>退出</button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="dashboard-body">
        {activeNav === 'overview' && (
          <OverviewDashboard
            orders={orders}
            orderItems={orderItems}
            loading={loading}
            onRefresh={loadOrders}
          />
        )}
        {activeNav === 'sku' && (
          <SkuCenter orders={orders} orderItems={orderItems} />
        )}
        {activeNav === 'country' && (
          <CountryCenter orders={orders} orderItems={orderItems} />
        )}
        {activeNav === 'store' && (
          <StoreCenter orders={orders} orderItems={orderItems} />
        )}
        {activeNav === 'ai' && (
          <AiInsightCenter orders={orders} orderItems={orderItems} />
        )}
        {activeNav === 'import' && (
          <DataImport onImported={handleImported} />
        )}
        {activeNav === 'data' && (
          <DataCenter user={user} orders={orders} onRefresh={() => { loadOrders(); loadItems() }} />
        )}
      </div>

      {/* 弹窗 */}
      {showRules && (
        <RulesModal onClose={() => setShowRules(false)} />
      )}
    </div>
  )
}
