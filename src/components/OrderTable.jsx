import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function OrderTable({ orders, loading, onRefresh }) {
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