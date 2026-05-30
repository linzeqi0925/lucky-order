/**
 * 智能分类规则
 * 用户定义关键词→品类映射，导入时自动匹配
 * 规则存在 localStorage，每个用户独立
 */

const STORAGE_KEY = 'lucky_order_category_rules'

// 默认规则（印章行业常用）
const DEFAULT_RULES = [
  { keyword: '光敏', category: '光敏' },
  { keyword: '原子', category: '光敏' },
  { keyword: '回墨', category: '光敏' },
  { keyword: '胶垫', category: '胶垫' },
  { keyword: '铜章', category: '金属' },
  { keyword: '钢印', category: '金属' },
  { keyword: '金属', category: '金属' },
  { keyword: '亚克力', category: '亚克力' },
  { keyword: '水晶', category: '亚克力' },
  { keyword: '皮革', category: '皮革' },
  { keyword: '皮套', category: '皮革' },
  { keyword: '笔', category: '签字笔' },
  { keyword: '签字笔', category: '签字笔' },
  { keyword: '刻', category: '激光雕刻' },
  { keyword: '激光', category: '激光雕刻' },
  { keyword: '切割', category: '激光切割' },
]

export function loadRules() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  // 首次使用，保存默认规则
  saveRules(DEFAULT_RULES)
  return DEFAULT_RULES
}

export function saveRules(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

// 根据产品名称自动匹配品类
export function classifyProduct(productName) {
  if (!productName) return '未分类'
  const rules = loadRules()
  const name = productName.toLowerCase()
  // 按规则顺序匹配，优先匹配更具体的
  // 先排长度长的在前面（更精确）
  const sorted = [...rules].sort((a, b) => b.keyword.length - a.keyword.length)
  for (const rule of sorted) {
    if (name.includes(rule.keyword.toLowerCase())) {
      return rule.category
    }
  }
  return '未分类'
}

// 批量分类
export function classifyBulk(products) {
  return products.map(p => ({
    ...p,
    product_category: classifyProduct(p.product_name || p.productName || '')
  }))
}