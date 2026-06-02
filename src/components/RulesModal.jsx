import { useState, useEffect } from 'react'
import { loadRules, saveRules } from '../lib/classifier'

export default function RulesModal({ onClose }) {
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
        </div>
      </div>
    </div>
  )
}