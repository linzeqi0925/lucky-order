const API_KEY = 'AIzaSyA97v7Vm-HYspX92yuqffw1h7bvt6zMqj0'
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function askGemini(prompt) {
  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI 暂时无法分析，请稍后重试'
  } catch (err) {
    console.error('Gemini error:', err)
    return 'AI 分析出错了：' + err.message
  }
}

export async function analyzeOrders(orders) {
  // 整理数据摘要给 AI
  const total = orders.length
  const totalQty = orders.reduce((s, o) => s + o.quantity, 0)
  const totalAmt = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)

  // 品类统计
  const catMap = {}
  orders.forEach(o => {
    catMap[o.product_category] = (catMap[o.product_category] || 0) + o.quantity
  })
  const catSummary = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}件`)
    .join('、')

  // 近7天趋势
  const dayMap = {}
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    dayMap[d.toISOString().split('T')[0]] = 0
  }
  orders.forEach(o => {
    if (dayMap[o.order_date] !== undefined) dayMap[o.order_date]++
  })
  const trendStr = Object.entries(dayMap).map(([d, v]) => `${d.slice(5)}:${v}单`).join(' → ')

  // 状态统计
  const statusMap = {}
  orders.forEach(o => {
    statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1
  })
  const statusLabel = { pending: '待处理', processing: '生产中', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
  const statusStr = Object.entries(statusMap).map(([k, v]) => `${statusLabel[k]||k} ${v}单`).join('、')

  // 加急分析
  const urgent = orders.filter(o => o.is_urgent).length

  const prompt = `你是跨境电商订单分析助手。请根据以下订单数据生成一份简洁的分析报告，要求：
1. 先说整体情况（总订单数、总件数、总金额）
2. 分析品类分布（占比最高的品类）
3. 分析近7天趋势（环比变化，是上升还是下降）
4. 分析订单状态健康度
5. 给出 1-2 条可执行的建议
注意：语气专业简洁，不要提及供应商信息，控制在200字以内。

数据如下：
- 总订单：${total}单，总件数：${totalQty}件，总金额：¥${totalAmt.toFixed(0)}
- 品类分布：${catSummary || '暂无'}
- 近7天趋势：${trendStr || '暂无'}
- 状态分布：${statusStr || '暂无'}
- 加急单：${urgent}单`

  return askGemini(prompt)
}