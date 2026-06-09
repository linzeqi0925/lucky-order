import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { classifyProduct, loadRules, normalizeCategory, saveRules, resetRules } from '../lib/classifier'

export default function RulesModal({ onClose, orders = [], onApplied }) {
  const [rules, setRules] = useState([])
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [matchMode, setMatchMode] = useState('contains')
  const [applying, setApplying] = useState(false)

  useEffect(() => { setRules(loadRules()) }, [])

  const handleAdd = () => {
    if (!newKeyword.trim() || !newCategory.trim()) return
    const updated = [
      { keyword: newKeyword.trim(), category: newCategory.trim(), matchMode, manual: true },
      ...rules,
    ]
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
    if (!confirm('恢复默认智能分类规则？你手动添加的规则会被替换。')) return
    setRules(resetRules())
  }

  const handleApplyExisting = async () => {
    if (!orders.length) return alert('暂无订单数据，请先导入数据')
    if (!confirm('将按当前规则重新分类已有订单，确认继续？')) return
    setApplying(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('登录状态已失效')

      let updated = 0
      for (const order of orders) {
        const nextCategory = classifyProduct([
          order.product_sku,
          order.product_name,
          order.remark,
        ].filter(Boolean).join(' '))
        const normalizedCurrent = normalizeCategory(order.product_category)
        const category = nextCategory === '未分类' ? normalizedCurrent : nextCategory
        if (!category || category === order.product_category) continue

        const { error } = await supabase
          .from('orders')
          .update({ product_category: category })
          .eq('user_id', user.id)
          .eq('order_no', order.order_no)
        if (error) throw error
        updated++
      }

      await onApplied?.()
      alert(`已重新分类 ${updated} 条订单`)
    } catch (err) {
      alert(`应用失败：${err.message}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>🏷️ 人工分类 / 品类归并</h3>
        <p className="modal-desc">人工规则优先于智能判断。适合把材质、颜色、内页等细分款式归并到经营一级品类，例如木头印章归胶垫、内页归笔记本。</p>

        <div className="rules-add">
          <select value={matchMode} onChange={e => setMatchMode(e.target.value)} className="filter-input" style={{width:120}}>
            <option value="contains">关键词包含</option>
            <option value="exact">精确 SKU</option>
          </select>
          <input placeholder="关键词（如：光敏）" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            className="filter-input" style={{flex:1}} />
          <input placeholder="归属品类（如：胶垫、笔记本）" value={newCategory} onChange={e => setNewCategory(e.target.value)}
            className="filter-input" style={{flex:1}} />
          <button className="btn-primary-sm" onClick={handleAdd}>➕ 添加</button>
        </div>

        <div className="rules-list">
          {rules.map((r, i) => (
            <div key={i} className="rule-item">
              <span className={`rule-mode ${r.matchMode === 'exact' ? 'exact' : ''}`}>{r.matchMode === 'exact' ? 'SKU' : '包含'}</span>
              <span className="rule-keyword">{r.keyword}</span>
              <span className="rule-arrow">→</span>
              <span className="rule-cat">{r.category}</span>
              <button className="rule-del" onClick={() => handleDelete(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className="rules-footer">
          <span className="rules-count">共 {rules.length} 条规则</span>
          <div className="rules-actions">
            <button className="btn-outline-sm" onClick={handleApplyExisting} disabled={applying || orders.length === 0}>
              {applying ? '应用中...' : '应用到已有订单'}
            </button>
            <button className="btn-outline-sm" onClick={handleReset}>恢复默认智能规则</button>
          </div>
        </div>
      </div>
    </div>
  )
}
