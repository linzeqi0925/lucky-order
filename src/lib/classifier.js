/**
 * 智能分类规则
 * 用户定义关键词→品类映射，导入时自动匹配。
 */

const STORAGE_KEY = 'lucky_order_category_rules'

const DEFAULT_RULES = [
  { keyword: '光敏衣服印章', category: '光敏印章' },
  { keyword: '光敏', category: '光敏印章' },
  { keyword: '原子', category: '光敏印章' },
  { keyword: 'fh stanp', category: '光敏印章' },
  { keyword: 'gm-black', category: '光敏印章' },

  { keyword: '回墨', category: '胶垫' },
  { keyword: '卓达', category: '胶垫' },
  { keyword: 'self', category: '胶垫' },
  { keyword: 'trodat', category: '胶垫' },
  { keyword: 'gy-zd', category: '胶垫' },
  { keyword: 'gy-fzd', category: '金属钢印' },
  { keyword: '方形钢印', category: '金属钢印' },

  { keyword: '金属钢印', category: '金属钢印' },
  { keyword: '钢印', category: '金属钢印' },
  { keyword: '金属', category: '金属钢印' },
  { keyword: 'ml stanp', category: '金属钢印' },
  { keyword: 'metal', category: '金属钢印' },

  { keyword: '胶垫', category: '胶垫' },
  { keyword: 'rr stanp', category: '胶垫' },

  { keyword: 'wood', category: '胶垫' },
  { keyword: '木头', category: '胶垫' },
  { keyword: '木柄', category: '胶垫' },
  { keyword: 'logo-wood', category: '胶垫' },

  { keyword: '亚克力', category: '亚克力/切割器' },
  { keyword: '水晶', category: '亚克力/切割器' },
  { keyword: '切割器', category: '亚克力/切割器' },
  { keyword: 'bg-', category: '亚克力/切割器' },

  { keyword: '贴纸', category: '贴纸耗材' },
  { keyword: 'stk-', category: '贴纸耗材' },
  { keyword: 'stickers', category: '贴纸耗材' },

  { keyword: '印台', category: '印台/墨水' },
  { keyword: '墨水', category: '印台/墨水' },
  { keyword: 'pad-', category: '印台/墨水' },
  { keyword: 'ink', category: '印台/墨水' },

  { keyword: '笔记本', category: '笔记本' },
  { keyword: '内页', category: '笔记本' },
  { keyword: '本芯', category: '笔记本' },
  { keyword: '活页', category: '笔记本' },
  { keyword: 'notebook', category: '笔记本' },
  { keyword: 'nb book', category: '笔记本' },
  { keyword: 'nb02', category: '笔记本' },

  { keyword: '钱包', category: '钱包/皮具' },
  { keyword: 'wallet', category: '钱包/皮具' },
  { keyword: 'wl-', category: '钱包/皮具' },
  { keyword: '皮革', category: '钱包/皮具' },
  { keyword: '皮套', category: '钱包/皮具' },

  { keyword: '签字笔', category: '签字笔' },
  { keyword: '激光', category: '激光定制' },
  { keyword: '刻', category: '激光定制' },
]

const CATEGORY_ALIASES = {
  回墨印章: '胶垫',
  回墨: '胶垫',
  卓达印章: '胶垫',
  木柄印章: '胶垫',
  木头印章: '胶垫',
  木头: '胶垫',
  胶垫印章: '胶垫',
  胶垫类: '胶垫',
  方形钢印: '金属钢印',
  金属印章: '金属钢印',
  笔记本内页: '笔记本',
  内页: '笔记本',
  本芯: '笔记本',
  活页纸: '笔记本',
}

export function loadRules() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const merged = mergeDefaultRules(parsed)
      if (merged.length !== parsed.length) saveRules(merged)
      return merged
    }
  } catch {}

  saveRules(DEFAULT_RULES)
  return DEFAULT_RULES
}

export function saveRules(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

function mergeDefaultRules(savedRules) {
  const existing = new Set(savedRules.map(r => `${r.keyword}=>${r.category}`.toLowerCase()))
  const missing = DEFAULT_RULES.filter(r => !existing.has(`${r.keyword}=>${r.category}`.toLowerCase()))
  return [...savedRules, ...missing]
}

export function resetRules() {
  saveRules(DEFAULT_RULES)
  return DEFAULT_RULES
}

export function classifyProduct(productName) {
  if (!productName) return '未分类'
  const rules = loadRules()
  const name = productName.toLowerCase()
  const tokens = name.split(/[\s;,，/|]+/).filter(Boolean)
  const sorted = [...rules].sort((a, b) => {
    const manualDiff = Number(Boolean(b.manual)) - Number(Boolean(a.manual))
    if (manualDiff !== 0) return manualDiff
    return b.keyword.length - a.keyword.length
  })

  for (const rule of sorted) {
    const keyword = rule.keyword.toLowerCase()
    const matched = rule.matchMode === 'exact'
      ? tokens.includes(keyword)
      : name.includes(keyword)
    if (matched) {
      return normalizeCategory(rule.category)
    }
  }

  return normalizeCategory(inferBySkuPattern(name))
}

export function normalizeCategory(category) {
  const value = String(category || '').trim()
  return CATEGORY_ALIASES[value] || value || '未分类'
}

function inferBySkuPattern(name) {
  if (/^(gy-)?zd/.test(name)) return '胶垫'
  if (/^(gy-)?fzd/.test(name)) return '金属钢印'
  if (/^(ml|eb|gyf)[-\s]/.test(name)) return '金属钢印'
  if (/^(wood|logo-wood)/.test(name)) return '胶垫'
  if (/^(stk|tz)-/.test(name)) return '贴纸耗材'
  if (/^(nb|tn)/.test(name)) return '笔记本'
  if (/^(pad|ink)/.test(name)) return '印台/墨水'
  if (/^(wl|wp)-/.test(name)) return '钱包/皮具'
  if (/^(bg|acrylic)/.test(name)) return '亚克力/切割器'
  return '未分类'
}

export function classifyBulk(products) {
  return products.map(p => ({
    ...p,
    product_category: classifyProduct([p.product_name, p.productName, p.product_sku, p.sku].filter(Boolean).join(' '))
  }))
}
