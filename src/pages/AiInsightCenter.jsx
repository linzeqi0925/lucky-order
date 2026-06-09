/**
 * AI 经营洞察 V2
 *
 * 纯规则引擎，不调用外部 AI。
 * 模块：
 *   1. 增长最快/下降最快国家
 *   2. 增长最快/下降最快店铺
 *   3. 增长最快/下降最快 SKU
 *   4. 新品机会
 *   5. 滞销风险
 *   6. 经营周报（一键生成）
 */

import { useState, useMemo } from 'react'

export default function AiInsightCenter({ orders, orderItems }) {
  const [activeView, setActiveView] = useState('dashboard')

  const orderDateMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_no] = o.order_date })
    return map
  }, [orders])

  const itemsWithDate = useMemo(() => {
    if (!orderItems?.length) return []
    return orderItems.map(item => ({ ...item, order_date: orderDateMap[item.order_no] || '' }))
  }, [orderItems, orderDateMap])

  // 工具：获取两个时间段的数据
  const getPeriodData = () => {
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const s30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const s60 = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0]
    return { end, s30, s60 }
  }

  // ============================
  // 国家分析
  // ============================
  const countryAnalysis = useMemo(() => {
    const { end, s30, s60 } = getPeriodData()
    const cur = orders.filter(o => o.order_date >= s30 && o.order_date <= end)
    const prev = orders.filter(o => o.order_date >= s60 && o.order_date < s30)
    const curMap = {}, prevMap = {}
    cur.forEach(o => { const c = o.country || '未知'; curMap[c] = (curMap[c] || 0) + o.quantity })
    prev.forEach(o => { const c = o.country || '未知'; prevMap[c] = (prevMap[c] || 0) + o.quantity })
    const all = new Set([...Object.keys(curMap), ...Object.keys(prevMap)])
    const result = []
    all.forEach(c => {
      const cv = curMap[c] || 0, pv = prevMap[c] || 0
      if (pv > 0) result.push({ name: c, cur: cv, prev: pv, change: ((cv - pv) / pv * 100).toFixed(1) })
    })
    return {
      growth: result.filter(r => r.change > 15).sort((a, b) => b.change - a.change),
      decline: result.filter(r => r.change < -10).sort((a, b) => a.change - b.change),
    }
  }, [orders])

  // ============================
  // 店铺分析
  // ============================
  const storeAnalysis = useMemo(() => {
    const { end, s30, s60 } = getPeriodData()
    const cur = orders.filter(o => o.order_date >= s30 && o.order_date <= end)
    const prev = orders.filter(o => o.order_date >= s60 && o.order_date < s30)
    const curMap = {}, prevMap = {}
    cur.forEach(o => { const s = o.store_name || '未知'; curMap[s] = (curMap[s] || 0) + o.quantity })
    prev.forEach(o => { const s = o.store_name || '未知'; prevMap[s] = (prevMap[s] || 0) + o.quantity })
    const all = new Set([...Object.keys(curMap), ...Object.keys(prevMap)])
    const result = []
    all.forEach(s => {
      const cv = curMap[s] || 0, pv = prevMap[s] || 0
      if (pv > 0) result.push({ name: s, cur: cv, prev: pv, change: ((cv - pv) / pv * 100).toFixed(1) })
    })
    return {
      growth: result.filter(r => r.change > 20).sort((a, b) => b.change - a.change),
      decline: result.filter(r => r.change < -15).sort((a, b) => a.change - b.change),
    }
  }, [orders])

  // ============================
  // SKU 分析
  // ============================
  const skuAnalysis = useMemo(() => {
    const { end, s30, s60 } = getPeriodData()
    const cur = itemsWithDate.filter(i => i.order_date >= s30 && i.order_date <= end)
    const prev = itemsWithDate.filter(i => i.order_date >= s60 && i.order_date < s30)
    const curMap = {}, prevMap = {}
    cur.forEach(i => { curMap[i.sku] = (curMap[i.sku] || 0) + i.quantity })
    prev.forEach(i => { prevMap[i.sku] = (prevMap[i.sku] || 0) + i.quantity })
    const all = new Set([...Object.keys(curMap), ...Object.keys(prevMap)])
    const result = []
    all.forEach(sku => {
      const cv = curMap[sku] || 0, pv = prevMap[sku] || 0
      const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
      if (pv > 0) result.push({ name: sku, productName: pName, cur: cv, prev: pv, change: ((cv - pv) / pv * 100).toFixed(1) })
    })
    return {
      growth: result.filter(r => r.change > 30).sort((a, b) => b.change - a.change).slice(0, 20),
      decline: result.filter(r => r.change < -30 && r.prev > 2).sort((a, b) => a.change - b.change).slice(0, 20),
    }
  }, [itemsWithDate])

  // ============================
  // 新品机会
  // ============================
  const newProductOpps = useMemo(() => {
    const { end, s30 } = getPeriodData()
    const firstAppear = {}
    itemsWithDate.forEach(i => {
      if (!i.order_date) return
      if (!firstAppear[i.sku] || i.order_date < firstAppear[i.sku]) firstAppear[i.sku] = i.order_date
    })
    return Object.entries(firstAppear)
      .filter(([, d]) => d >= s30)
      .map(([sku, firstDate]) => {
        const totalQty = itemsWithDate.filter(i => i.sku === sku).reduce((s, i) => s + i.quantity, 0)
        const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
        return { sku, productName: pName, firstDate, totalQty }
      })
      .sort((a, b) => b.totalQty - a.totalQty)
  }, [itemsWithDate])

  // ============================
  // 滞销风险
  // ============================
  const stagnationRisk = useMemo(() => {
    const { end, s30, s60 } = getPeriodData()
    const prev = itemsWithDate.filter(i => i.order_date >= s60 && i.order_date < s30)
    const cur = itemsWithDate.filter(i => i.order_date >= s30 && i.order_date <= end)
    const prevMap = {}, curMap = {}
    prev.forEach(i => { prevMap[i.sku] = (prevMap[i.sku] || 0) + i.quantity })
    cur.forEach(i => { curMap[i.sku] = (curMap[i.sku] || 0) + i.quantity })

    const result = []
    Object.entries(prevMap).forEach(([sku, pv]) => {
      const cv = curMap[sku] || 0
      if (pv > 2 && cv < pv * 0.3) {
        const pName = itemsWithDate.find(i => i.sku === sku)?.product_name || ''
        result.push({ sku, productName: pName, prev: pv, cur: cv, decline: ((pv - cv) / pv * 100).toFixed(1) })
      }
    })
    return result.sort((a, b) => b.decline - a.decline)
  }, [itemsWithDate])

  // ============================
  // 经营周报
  // ============================
  const weeklyReport = useMemo(() => {
    const rank = (list, keyFn, qtyFn = x => x.quantity || 0) => {
      const map = {}
      list.forEach(item => {
        const key = keyFn(item) || '未知'
        map[key] = (map[key] || 0) + qtyFn(item)
      })
      return Object.entries(map).sort((a, b) => b[1] - a[1])
    }

    const lines = []
    const now = new Date()
    const days = ['日','一','二','三','四','五','六']
    const today = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}（周${days[now.getDay()]}）`
    lines.push(`📊 Lucky Order 经营简报 — ${today}`)
    lines.push('')

    const totalOrders = orders.length
    const totalQty = orders.reduce((s, o) => s + o.quantity, 0)
    const countries = new Set(orders.map(o => o.country).filter(Boolean)).size
    const stores = new Set(orders.map(o => o.store_name).filter(Boolean)).size
    const skuCount = new Set(itemsWithDate.map(i => i.sku).filter(Boolean)).size
    lines.push(`📦 数据概览：${totalOrders}单 | ${totalQty}件 | ${countries}国 | ${stores}店 | ${skuCount}个SKU`)
    lines.push('')

    const countryRank = rank(orders, o => o.country)
    const storeRank = rank(orders, o => o.store_name)
    const categoryRank = rank(orders, o => o.product_category || '未分类')
    const skuRank = rank(itemsWithDate, i => i.sku, i => i.quantity || 0)
    const unclassifiedQty = categoryRank.find(([name]) => name === '未分类')?.[1] || 0
    const topSkuShare = skuRank[0] ? (skuRank[0][1] / Math.max(1, totalQty)) * 100 : 0
    const topCountryShare = countryRank[0] ? (countryRank[0][1] / Math.max(1, totalQty)) * 100 : 0

    lines.push('✅ 核心结论：')
    if (countryRank[0]) lines.push(`  · 主力市场：${countryRank[0][0]}，贡献 ${countryRank[0][1]} 件，占 ${topCountryShare.toFixed(1)}%。`)
    if (storeRank[0]) lines.push(`  · 主力店铺：${storeRank[0][0]}，贡献 ${storeRank[0][1]} 件。`)
    if (skuRank[0]) lines.push(`  · 主力SKU：${skuRank[0][0]}，贡献 ${skuRank[0][1]} 件，占 ${topSkuShare.toFixed(1)}%。`)
    if (categoryRank[0]) lines.push(`  · 主力品类：${categoryRank[0][0]}，贡献 ${categoryRank[0][1]} 件。`)
    lines.push('')

    lines.push('⚠️ 风险提醒：')
    let riskCount = 0
    if (topSkuShare > 35) {
      lines.push(`  · SKU集中度偏高：${skuRank[0][0]} 占 ${topSkuShare.toFixed(1)}%，需要关注断货和单品波动。`)
      riskCount++
    }
    if (topCountryShare > 75) {
      lines.push(`  · 市场集中度偏高：${countryRank[0][0]} 占 ${topCountryShare.toFixed(1)}%，建议观察其他国家是否有增长空间。`)
      riskCount++
    }
    if (unclassifiedQty > 0) {
      lines.push(`  · 未分类出库 ${unclassifiedQty} 件，会影响品类判断，建议先恢复默认智能规则并重新导入。`)
      riskCount++
    }
    if (skuAnalysis.decline.length > 0) {
      skuAnalysis.decline.slice(0, 3).forEach(s => lines.push(`  · ${s.name} 下降 ${Math.abs(Number(s.change)).toFixed(1)}%，建议检查库存、广告或Listing状态。`))
      riskCount += Math.min(3, skuAnalysis.decline.length)
    }
    if (riskCount === 0) lines.push('  · 暂无明显结构性风险，建议继续观察趋势变化。')
    lines.push('')

    lines.push('🎯 建议动作：')
    if (skuRank[0]) lines.push(`  · 给 ${skuRank[0][0]} 做单独跟踪：看库存是否充足、是否能扩展颜色/尺寸/套装。`)
    if (countryRank[0] && storeRank[0]) lines.push(`  · 单独复盘「${storeRank[0][0]} × ${countryRank[0][0]}」组合，看它的TOP SKU和品类结构。`)
    if (categoryRank[0] && categoryRank[0][0] !== '未分类') lines.push(`  · 对 ${categoryRank[0][0]} 品类做二级拆分，找出是单品拉动还是多个SKU共同拉动。`)
    if (newProductOpps.length > 0) lines.push(`  · 新品中优先看 ${newProductOpps[0].sku}，累计 ${newProductOpps[0].totalQty} 件，可进入新品分析页看日均表现。`)
    lines.push('  · 对重点店铺/国家使用“局部分析”页，不要只看全局汇总。')
    lines.push('')

    lines.push('📌 下周关注：')
    skuRank.slice(0, 5).forEach(([sku, qty]) => lines.push(`  · ${sku}：当前 ${qty} 件，关注是否持续出库。`))
    if (skuRank.length === 0) lines.push('  · 暂无SKU数据，请先重新导入马帮订单文件。')

    return lines.join('\n')
  }, [orders, itemsWithDate, countryAnalysis, storeAnalysis, skuAnalysis, newProductOpps, stagnationRisk])

  const currentInsights = useMemo(() => {
    const rank = (list, keyFn, qtyFn = x => x.quantity || 0) => {
      const map = {}
      list.forEach(item => {
        const key = keyFn(item) || '未知'
        map[key] = (map[key] || 0) + qtyFn(item)
      })
      return Object.entries(map).sort((a, b) => b[1] - a[1])
    }

    const countries = rank(orders, o => o.country)
    const stores = rank(orders, o => o.store_name)
    const categories = rank(orders, o => o.product_category || '未分类')
    const skus = rank(itemsWithDate, i => i.sku, i => i.quantity || 0)
    const totalQty = orders.reduce((s, o) => s + (o.quantity || 0), 0)
    const notes = []

    if (countries[0]) notes.push(`最大市场是 ${countries[0][0]}，占出库量 ${((countries[0][1] / Math.max(1, totalQty)) * 100).toFixed(1)}%`)
    if (stores[0]) notes.push(`最大店铺是 ${stores[0][0]}，贡献 ${stores[0][1]} 件出库`)
    if (skus[0]) notes.push(`当前 TOP SKU 是 ${skus[0][0]}，出库 ${skus[0][1]} 件`)
    if (categories[0]) notes.push(`主力品类是 ${categories[0][0]}，出库 ${categories[0][1]} 件`)
    if (categories.find(([name]) => name === '未分类')) notes.push('仍有未分类数据，建议在规则里恢复默认智能规则后重新导入')
    if (!itemsWithDate.length) notes.push('SKU 明细为空，系统会临时从订单字段解析；建议确认 Supabase 是否已创建 order_items 表')

    return { countries, stores, categories, skus, notes }
  }, [orders, itemsWithDate])

  // ============================
  // 视图：概览仪表板
  // ============================
  const renderDashboard = () => (
    <>
      {/* 数据概览 */}
      <div className="v2-kpi-section">
        <div className="v2-kpi-header"><span className="section-badge">🧠 AI 经营洞察</span></div>
        <div className="v2-kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📦</span><span className="kpi-v2-label">总单数</span></div><div className="kpi-v2-value">{orders.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">📊</span><span className="kpi-v2-label">总出库</span></div><div className="kpi-v2-value">{orders.reduce((s, o) => s + o.quantity, 0).toLocaleString()}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🔥</span><span className="kpi-v2-label">爆款SKU</span></div><div className="kpi-v2-value" style={{color:'#16a34a'}}>{skuAnalysis.growth.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">⚠️</span><span className="kpi-v2-label">滞销SKU</span></div><div className="kpi-v2-value" style={{color:'#dc2626'}}>{skuAnalysis.decline.length}</div></div>
          <div className="kpi-card-v2"><div className="kpi-v2-top"><span className="kpi-v2-icon">🆕</span><span className="kpi-v2-label">新品机会</span></div><div className="kpi-v2-value">{newProductOpps.length}</div></div>
        </div>
      </div>

      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">✅ 当前数据洞察</span></div>
        <div className="v2-ai-grid">
          <div className="v2-ai-alerts">
            <h4>运营结论</h4>
            {currentInsights.notes.map((note, i) => (
              <div key={i} className="ai-alert-item">
                <span className="ai-alert-icon">•</span>
                <span className="ai-alert-text">{note}</span>
              </div>
            ))}
          </div>
          <div className="v2-ai-growth">
            <h4>当前 TOP</h4>
            {[
              ['国家', currentInsights.countries[0]],
              ['店铺', currentInsights.stores[0]],
              ['品类', currentInsights.categories[0]],
              ['SKU', currentInsights.skus[0]],
            ].map(([label, item]) => item && (
              <div key={label} className="ai-growth-item">
                <span><strong>{label}</strong>：{item[0]} <span className="growth-pct">{item[1]}件</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 国家洞察 */}
      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">🌍 国家洞察</span></div>
        <div className="v2-ai-content">
          <div className="v2-ai-grid">
            <div className="v2-ai-alerts">
              <h4>🔥 增长最快国家</h4>
              {countryAnalysis.growth.length === 0 ? <p className="ai-good">✅ 暂无显著增长</p> : (
                countryAnalysis.growth.slice(0, 5).map((c, i) => (
                  <div key={i} className="ai-alert-item">
                    <span className="ai-alert-icon">📈</span>
                    <span className="ai-alert-text"><strong>{c.name}</strong> 增长 <span style={{color:'#16a34a',fontWeight:700}}>+{c.change}%</span></span>
                    <span className="ai-alert-detail">{c.cur}件/{c.prev}件</span>
                  </div>
                ))
              )}
            </div>
            <div className="v2-ai-growth">
              <h4>📉 下降最快国家</h4>
              {countryAnalysis.decline.length === 0 ? <p className="ai-good">✅ 无异常下降</p> : (
                countryAnalysis.decline.slice(0, 5).map((c, i) => (
                  <div key={i} className="ai-alert-item" style={{background:'#fef2f2',borderColor:'#fecaca'}}>
                    <span className="ai-alert-icon">📉</span>
                    <span className="ai-alert-text"><strong>{c.name}</strong> 下降 <span style={{color:'#dc2626',fontWeight:700}}>{c.change}%</span></span>
                    <span className="ai-alert-detail">{c.cur}件/{c.prev}件</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 店铺洞察 */}
      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">🏪 店铺洞察</span></div>
        <div className="v2-ai-content">
          <div className="v2-ai-grid">
            <div className="v2-ai-alerts">
              <h4>🔥 增长最快店铺</h4>
              {storeAnalysis.growth.length === 0 ? <p className="ai-good">✅ 暂无显著增长</p> : (
                storeAnalysis.growth.slice(0, 5).map((s, i) => (
                  <div key={i} className="ai-alert-item">
                    <span className="ai-alert-icon">📈</span>
                    <span className="ai-alert-text"><strong>{s.name}</strong> +{s.change}%</span>
                    <span className="ai-alert-detail">{s.cur}件/{s.prev}件</span>
                  </div>
                ))
              )}
            </div>
            <div className="v2-ai-growth">
              <h4>📉 下降最快店铺</h4>
              {storeAnalysis.decline.length === 0 ? <p className="ai-good">✅ 无异常下降</p> : (
                storeAnalysis.decline.slice(0, 5).map((s, i) => (
                  <div key={i} className="ai-alert-item" style={{background:'#fef2f2',borderColor:'#fecaca'}}>
                    <span className="ai-alert-icon">📉</span>
                    <span className="ai-alert-text"><strong>{s.name}</strong> {s.change}%</span>
                    <span className="ai-alert-detail">{s.cur}件/{s.prev}件</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SKU 洞察 */}
      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">📦 SKU 洞察</span></div>
        <div className="v2-ai-content">
          <div className="v2-ai-grid">
            <div className="v2-ai-alerts">
              <h4>🔥 增长最快 SKU TOP 10</h4>
              {skuAnalysis.growth.length === 0 ? <p className="ai-good">✅ 暂无显著增长</p> : (
                skuAnalysis.growth.slice(0, 10).map((s, i) => (
                  <div key={i} className="ai-alert-item">
                    <span className="ai-alert-icon">📈</span>
                    <span className="ai-alert-text"><strong>{s.name}</strong> <span style={{fontSize:11,color:'#94a3b8'}}>{s.productName}</span></span>
                    <span className="ai-alert-detail" style={{color:'#16a34a',fontWeight:700}}>+{s.change}%</span>
                  </div>
                ))
              )}
            </div>
            <div className="v2-ai-growth">
              <h4>📉 下降最快 SKU TOP 10</h4>
              {skuAnalysis.decline.length === 0 ? <p className="ai-good">✅ 无异常下降</p> : (
                skuAnalysis.decline.slice(0, 10).map((s, i) => (
                  <div key={i} className="ai-alert-item" style={{background:'#fef2f2',borderColor:'#fecaca'}}>
                    <span className="ai-alert-icon">📉</span>
                    <span className="ai-alert-text"><strong>{s.name}</strong> <span style={{fontSize:11,color:'#94a3b8'}}>{s.productName}</span></span>
                    <span className="ai-alert-detail" style={{color:'#dc2626',fontWeight:700}}>{s.change}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 新品 + 滞销 */}
      <div className="v2-ai-section">
        <div className="v2-ai-header"><span className="section-badge">🆕 新品机会 & ⚠️ 滞销风险</span></div>
        <div className="v2-ai-content">
          <div className="v2-ai-grid">
            <div className="v2-ai-alerts">
              <h4>🆕 新品上线（近30天）</h4>
              {newProductOpps.length === 0 ? <p className="ai-good">✅ 暂无新品</p> : (
                newProductOpps.slice(0, 10).map((s, i) => (
                  <div key={i} className="ai-alert-item" style={{background:'#fffbeb',borderColor:'#fde68a'}}>
                    <span className="ai-alert-icon">🆕</span>
                    <span className="ai-alert-text"><strong>{s.sku}</strong> {s.totalQty}件</span>
                    <span className="ai-alert-detail">{s.firstDate}</span>
                  </div>
                ))
              )}
            </div>
            <div className="v2-ai-growth">
              <h4>⚠️ 滞销风险</h4>
              {stagnationRisk.length === 0 ? <p className="ai-good">✅ 无滞销风险</p> : (
                stagnationRisk.slice(0, 10).map((s, i) => (
                  <div key={i} className="ai-alert-item" style={{background:'#fef2f2',borderColor:'#fecaca'}}>
                    <span className="ai-alert-icon">⚠️</span>
                    <span className="ai-alert-text"><strong>{s.sku}</strong> 下降 {s.decline}%</span>
                    <span className="ai-alert-detail">{s.prev}→{s.cur}件</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 经营周报 */}
      <div className="ai-card">
        <div className="ai-header">
          <div className="ai-title">
            <span className="ai-icon">📊</span>
            <div><h4>经营周报</h4><p className="ai-desc">基于近60天数据对比生成的经营简报，支持一键复制</p></div>
          </div>
          <button className="btn-ai" onClick={() => { navigator.clipboard.writeText(weeklyReport); alert('已复制到剪贴板') }}>
            📋 复制周报
          </button>
        </div>
        <div className="ai-report">
          <pre className="ai-text" style={{fontSize:13,lineHeight:1.8}}>{weeklyReport}</pre>
        </div>
      </div>
    </>
  )

  // 空状态
  if (orders.length === 0) {
    return (
      <div className="dashboard-view">
        <div className="v2-kpi-section">
          <div className="v2-kpi-header"><span className="section-badge">🧠 AI 经营洞察</span></div>
        </div>
        <div className="empty-state">📭 暂无数据，请先导入订单</div>
      </div>
    )
  }

  return renderDashboard()
}
