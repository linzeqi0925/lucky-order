/**
 * 本地 AI 分析引擎
 * 完全免费，不限次数，无需 API Key
 * 基于订单数据做统计计算 + 智能文本生成
 */

export function analyzeOrders(orders) {
  if (!orders || orders.length === 0) {
    return '暂无订单数据，请先导入数据后再进行分析。'
  }

  const total = orders.length
  const totalQty = orders.reduce((s, o) => s + o.quantity, 0)
  const totalAmt = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
  const urgentCount = orders.filter(o => o.is_urgent).length

  // === 品类分析 ===
  const catMap = {}
  orders.forEach(o => {
    const cat = o.product_category || '未分类'
    if (!catMap[cat]) catMap[cat] = { count: 0, amount: 0, qty: 0 }
    catMap[cat].count++
    catMap[cat].qty += o.quantity
    catMap[cat].amount += parseFloat(o.total_amount || 0)
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1].qty - a[1].qty)
  const topCat = catSorted[0]
  const topCatPct = total > 0 ? ((topCat[1].qty / totalQty) * 100).toFixed(1) : 0

  // === 趋势分析 ===
  const dayMap = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    dayMap[d.toISOString().split('T')[0]] = 0
  }
  orders.forEach(o => {
    if (dayMap[o.order_date] !== undefined) dayMap[o.order_date]++
  })
  const dayEntries = Object.entries(dayMap)
  const firstHalf = dayEntries.slice(0, 3).reduce((s, [, v]) => s + v, 0)
  const secondHalf = dayEntries.slice(3).reduce((s, [, v]) => s + v, 0)
  let trend = '平稳'
  let trendIcon = '➡️'
  if (secondHalf > firstHalf * 1.2) { trend = '上升趋势'; trendIcon = '📈' }
  else if (secondHalf < firstHalf * 0.8) { trend = '下降趋势'; trendIcon = '📉' }
  const maxDay = Math.max(...Object.values(dayMap), 1)
  const peakDay = Object.entries(dayMap).find(([, v]) => v === maxDay)?.[0]

  // === 状态分析 ===
  const statusMap = {}
  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  orders.forEach(o => {
    statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1
  })
  const pendingCount = statusMap['pending'] || 0
  const processingCount = statusMap['processing'] || 0
  const completedCount = statusMap['completed'] || 0

  // === 供应商分析 ===
  const supMap = {}
  orders.forEach(o => {
    if (!o.supplier) return
    supMap[o.supplier] = (supMap[o.supplier] || 0) + o.quantity
  })
  const supSorted = Object.entries(supMap).sort((a, b) => b[1] - a[1])
  const topSupplier = supSorted[0]?.[0] || '未记录'

  // === 生成报告 ===
  const lines = []

  lines.push(`📊 整体概况：共 ${total} 笔订单，${totalQty.toLocaleString()} 件商品，总金额 ¥${totalAmt.toFixed(0)}，其中加急单 ${urgentCount} 笔（${total > 0 ? ((urgentCount / total) * 100).toFixed(1) : 0}%）。`)

  lines.push('')
  lines.push(`📦 品类分析：${topCat[0]} 为最大品类，出库 ${topCat[1].qty.toLocaleString()} 件，占总量 ${topCatPct}%。`)
  if (catSorted.length > 1) {
    const others = catSorted.slice(1, 4).map(([c]) => c).join('、')
    lines.push(`其他主要品类：${others}。`)
  }

  lines.push('')
  const peakDayStr = peakDay ? peakDay.slice(5) : '—'
  lines.push(`📈 近7天趋势：${trendIcon} ${trend}，峰值出现在 ${peakDayStr}（${maxDay} 单）。`)
  lines.push(`前半段(${dayEntries[0][0].slice(5)}-${dayEntries[2][0].slice(5)}) ${firstHalf} 单 → 后半段(${dayEntries[3][0].slice(5)}-${dayEntries[6][0].slice(5)}) ${secondHalf} 单${secondHalf > firstHalf ? '，环比增长' + ((secondHalf - firstHalf) / Math.max(1, firstHalf) * 100).toFixed(0) + '%' : ''}。`)

  lines.push('')
  lines.push(`🔔 订单健康度：待处理 ${pendingCount} 单，生产中 ${processingCount} 单，已完成 ${completedCount} 单。`)
  if (pendingCount > 0) {
    lines.push(`⚠️ 有 ${pendingCount} 笔待处理订单，建议及时跟进。`)
  }

  lines.push('')
  if (supSorted.length > 0) {
    lines.push(`🏭 供应商：${topSupplier} 承接最多（${supSorted[0][1].toLocaleString()} 件）。`)
  }

  lines.push('')
  const totalDays = Math.max(1, (new Date() - new Date(orders[orders.length - 1]?.order_date || Date.now())) / 86400000)
  const dailyAvg = (totalQty / totalDays).toFixed(1)
  lines.push(`💡 运营建议：日均出库 ${dailyAvg} 件${urgentCount > 0 ? '，加急单占比偏高建议排查产能瓶颈' : '，整体运行平稳'}。`)

  return lines.join('\n')
}

export { analyzeOrders as default }