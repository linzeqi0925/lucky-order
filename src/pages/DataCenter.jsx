import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearUserData } from '../lib/database'

/**
 * 数据中心
 * 导入记录、数据清洗记录、导入日志
 */
export default function DataCenter({ user, orders, onRefresh }) {
  const [showClear, setShowClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  // 基础统计
  const stats = {
    total: orders.length,
    totalQty: orders.reduce((s, o) => s + o.quantity, 0),
    stores: new Set(orders.map(o => o.store_name).filter(Boolean)).size,
    countries: new Set(orders.map(o => o.country).filter(Boolean)).size,
    firstDate: orders.length > 0 ? orders[orders.length - 1]?.order_date : '-',
    lastDate: orders.length > 0 ? orders[0]?.order_date : '-',
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await clearUserData(user.id)
      setShowClear(false)
      onRefresh()
    } catch (err) {
      alert('清空失败：' + err.message)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="dashboard-view">
      {/* 数据概览 */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">💾 数据中心</span></div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">总订单数</span></div><div className="kpi-v2-value">{stats.total}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">总出库量</span></div><div className="kpi-v2-value">{stats.totalQty.toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🏪</span><span className="kpi-v2-label">店铺</span></div><div className="kpi-v2-value">{stats.stores}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🌍</span><span className="kpi-v2-label">国家</span></div><div className="kpi-v2-value">{stats.countries}</div></div>
        </div>
      </div>

      {/* 数据时间范围 */}
      <div className="chart-card wide">
        <div className="chart-title">📅 数据时间范围</div>
        <div className="stats-grid">
          <div className="stat-item"><span className="stat-l">最早订单</span><span className="stat-v">{stats.firstDate}</span></div>
          <div className="stat-item"><span className="stat-l">最近订单</span><span className="stat-v">{stats.lastDate}</span></div>
          <div className="stat-item"><span className="stat-l">用户ID</span><span className="stat-v" style={{fontSize:12}}>{user?.id?.slice(0, 12)}...</span></div>
          <div className="stat-item"><span className="stat-l">邮箱</span><span className="stat-v" style={{fontSize:12}}>{user?.email}</span></div>
        </div>
      </div>

      {/* 数据操作 */}
      <div className="chart-card wide">
        <div className="chart-title">⚙️ 数据管理</div>
        <div style={{display:'flex',gap:12,marginTop:12}}>
          <button className="btn-outline-sm" onClick={() => setShowClear(true)}
            style={{color:'#dc2626',borderColor:'#fecaca'}} disabled={orders.length === 0}>
            🗑️ 清空全部数据
          </button>
        </div>
        <p className="modal-desc" style={{marginTop:12,fontSize:12}}>
          数据存储于 Supabase 云端。建议定期从马帮导出备份。
        </p>
      </div>

      {/* 清空确认弹窗 */}
      {showClear && (
        <div className="modal-overlay" onClick={() => setShowClear(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
            <button className="modal-close" onClick={() => setShowClear(false)}>✕</button>
            <h3 style={{color:'#dc2626'}}>⚠️ 清空数据确认</h3>
            <p className="modal-desc" style={{marginTop:8}}>
              此操作将<strong style={{color:'#dc2626'}}>永久删除</strong>你账号下的全部订单和 SKU 明细数据（共 {stats.total} 条订单），无法恢复！
            </p>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn-ghost" onClick={() => setShowClear(false)} style={{flex:1}}>取消</button>
              <button className="btn-primary-sm" onClick={handleClear} disabled={clearing}
                style={{flex:1,background:'#dc2626'}}>
                {clearing ? '⏳ 清空中...' : '✅ 确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}