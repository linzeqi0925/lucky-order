import { useState } from 'react'

export default function FilterBar({
  orders,
  dateRange, setDateRange,
  filterCategory, setFilterCategory,
  filterSupplier, setFilterSupplier,
  filterStore, setFilterStore,
  total,
  onClear,
}) {
  const allCats = [...new Set(orders.map(o => o.product_category).filter(Boolean))]
  const allSups = [...new Set(orders.map(o => o.supplier).filter(Boolean))]
  const allStores = [...new Set(orders.map(o => o.store_name).filter(Boolean))]
  const hasFilter = filterCategory || filterSupplier || filterStore || dateRange.start || dateRange.end

  return (
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
      {hasFilter && <button className="btn-clear" onClick={onClear}>✕ 清除</button>}
      <div className="filter-count">筛选：<strong>{total}</strong> 单</div>
    </div>
  )
}