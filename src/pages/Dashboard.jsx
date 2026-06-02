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

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useOrders, useOrderItems } from '../hooks/useOrders'
import OverviewDashboard from './OverviewDashboard'
import SkuCenter from './SkuCenter'
import CountryCenter from './CountryCenter'
import StoreCenter from './StoreCenter'
import AiInsightCenter from './AiInsightCenter'
import DataCenter from './DataCenter'
import DataImport from './DataImport'
import ShareModal from '../components/ShareModal'
import RulesModal from '../components/RulesModal'
import html2canvas from 'html2canvas'

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
  const { orders, loading, loadOrders, setOrders } = useOrders(user)
  const { items: orderItems, loading: itemsLoading, loadItems } = useOrderItems(user)
  const [activeNav, setActiveNav] = useState('overview')
  const [showShare, setShowShare] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dashboardRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  // 共享组件同时需要加载数据
  const handleImported = (result) => {
    loadOrders()
    loadItems()
    if (result) {
      const msg = `✅ 导入完成\n新增订单: ${result.inserted}\n跳过重复: ${result.skipped}\nSKU明细: ${result.itemsInserted}`
      alert(msg)
    }
    setActiveNav('overview')
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
          <button className="btn-outline-sm" onClick={() => setShowShare(true)} title="分享给同事" disabled={orders.length === 0}>🔗 分享</button>
          <button className="btn-outline-sm" onClick={handleExport} disabled={exporting || orders.length === 0}>
            {exporting ? '⏳' : '📷'} 导出
          </button>
          <div className="user-avatar">{user.email?.charAt(0).toUpperCase()}</div>
          <span className="user-email">{user.email?.split('@')[0]}</span>
          <button className="btn-outline-sm" onClick={handleLogout}>退出</button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="dashboard-body" ref={dashboardRef}>
        {activeNav === 'overview' && (
          <OverviewDashboard
            orders={orders}
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
      {showShare && (
        <ShareModal orders={orders} user={user} onClose={() => setShowShare(false)} />
      )}
      {showRules && (
        <RulesModal onClose={() => setShowRules(false)} />
      )}
    </div>
  )
}