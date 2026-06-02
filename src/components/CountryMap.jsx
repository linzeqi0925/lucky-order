/**
 * CountryMap — 世界填色地图（Choropleth）
 * 
 * 从散点图升级为**标准填色图**，用国家颜色深浅表示出库量。
 * 所有国家映射统一走 lib/countries.js。
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { getEnglishName, getCountryInfo } from '../lib/countries'

export default function CountryMap({ orders }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(null)
  const chartRef = useRef(null)

  // 加载 GeoJSON 并注册地图
  useEffect(() => {
    fetch('/maps/world.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!data || !data.features) throw new Error('GeoJSON 格式异常')
        echarts.registerMap('world', data)
        setMapLoaded(true)
        console.log(`✅ 世界地图加载完成: ${data.features.length} 个国家/地区`)
      })
      .catch(err => {
        console.warn('⚠️ 地图加载失败:', err.message)
        setMapError(err.message)
        setMapLoaded(true) // 即使失败也让页面显示
      })
  }, [])

  // 统计数据
  const countryStats = useMemo(() => {
    const qtyMap = {}
    const amtMap = {}
    let totalQty = 0
    orders.forEach(o => {
      const c = o.country || '未知'
      qtyMap[c] = (qtyMap[c] || 0) + o.quantity
      amtMap[c] = (amtMap[c] || 0) + parseFloat(o.total_amount || 0)
      totalQty += o.quantity
    })
    return {
      qtyMap,
      amtMap,
      entries: Object.entries(qtyMap).sort((a, b) => b[1] - a[1]),
      totalQty,
    }
  }, [orders])

  // 地图选项 — 填色图
  const mapOption = useMemo(() => {
    if (!mapLoaded || mapError) return {}

    const maxVal = Math.max(...Object.values(countryStats.qtyMap), 1)

    // 构建 choropleth 数据：用英文名匹配地图特征
    const mapData = Object.entries(countryStats.qtyMap).map(([cn, qty]) => {
      const en = getEnglishName(cn)
      if (!en) return null
      return { name: en, cnName: cn, value: qty }
    }).filter(Boolean)

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const cn = params.data?.cnName || params.name || ''
          const val = params.data?.value || params.value || 0
          const amt = countryStats.amtMap[cn] || 0
          const pct = ((val / Math.max(1, countryStats.totalQty)) * 100).toFixed(1)
          return `<strong>${cn}</strong><br/>
            📦 出库量：${val.toLocaleString()} 件<br/>
            💰 销售额：¥${amt.toLocaleString()}<br/>
            📊 占比：${pct}%`
        }
      },
      visualMap: {
        min: 0,
        max: maxVal,
        text: ['高', '低'],
        textStyle: { color: '#64748b', fontSize: 11 },
        inRange: {
          color: ['#e0e7ff', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#3730a3']
        },
        calculable: true,
        left: 16,
        bottom: 16,
        itemWidth: 12,
        itemHeight: 100,
      },
      series: [{
        type: 'map',
        map: 'world',
        roam: true,
        selectedMode: false,
        label: {
          show: true,
          fontSize: 9,
          color: '#334155',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#1e293b',
          },
          itemStyle: {
            areaColor: '#dbeafe',
            shadowBlur: 8,
            shadowColor: 'rgba(99,102,241,0.3)',
          },
        },
        itemStyle: {
          borderColor: '#cbd5e1',
          borderWidth: 0.5,
          areaColor: '#f1f5f9',
        },
        data: mapData,
        // 名字映射：如果 GeoJSON 里的名字和我们的英文名不完全一致，
        // 用 nameMap 做映射
      }],
    }
  }, [mapLoaded, mapError, countryStats])

  const handleMapClick = useCallback((params) => {
    const cn = params.data?.cnName
    if (cn && countryStats.qtyMap[cn]) {
      setSelectedCountry(cn)
    }
  }, [countryStats])

  // 如果没数据
  if (countryStats.entries.length === 0) {
    return (
      <div className="country-map-module">
        <div className="map-header">
          <h4>🌍 全球订单分布</h4>
          <span className="map-subtitle">暂无数据</span>
        </div>
      </div>
    )
  }

  return (
    <div className="country-map-module">
      <div className="map-header">
        <h4>🌍 全球订单分布</h4>
        <span className="map-subtitle">颜色越深 = 出库越多 | 点击国家查看详情</span>
      </div>

      <div className="map-container" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 400 }}>
          {!mapLoaded ? (
            <div className="empty-sm" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⏳ 加载地图中...
            </div>
          ) : mapError ? (
            <div className="empty-sm" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span>⚠️ 地图加载失败</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{mapError}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>请检查 /maps/world.json 文件</span>
            </div>
          ) : (
            <ReactECharts
              ref={chartRef}
              option={mapOption}
              style={{ height: 420 }}
              opts={{ renderer: 'canvas' }}
              onEvents={{ click: handleMapClick }}
            />
          )}
        </div>

        {/* 侧边国家排行 */}
        <div className="map-ranks" style={{ width: 280, flexShrink: 0 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>国家排行 TOP 10</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {countryStats.entries.slice(0, 10).map(([c, qty], i) => {
              const pct = ((qty / Math.max(1, countryStats.totalQty)) * 100).toFixed(1)
              const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6']
              return (
                <div key={c}
                  className={`map-rank-item ${selectedCountry === c ? 'active' : ''}`}
                  onClick={() => setSelectedCountry(c)}
                  style={{ cursor: 'pointer' }}>
                  <span style={{ width: 18, fontWeight: 700, color: '#94a3b8', fontSize: 10, textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ fontSize: 14 }}>🌍</span>
                  <span style={{ width: 70, flexShrink: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{c}</span>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: colors[i % colors.length], minWidth: 4 }} />
                  </div>
                  <span style={{ width: 40, textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 11 }}>{pct}%</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', width: 50, textAlign: 'right' }}>{qty.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 选中国家后弹出详情 */}
      {selectedCountry && (
        <CountryDetailModal
          country={selectedCountry}
          orders={orders}
          qty={countryStats.qtyMap[selectedCountry] || 0}
          amt={countryStats.amtMap[selectedCountry] || 0}
          totalQty={countryStats.totalQty}
          onClose={() => setSelectedCountry(null)}
        />
      )}
    </div>
  )
}

/* ========== 国家详情弹窗 ========== */
function CountryDetailModal({ country, orders, qty, amt, totalQty, onClose }) {
  const countryOrders = orders.filter(o => o.country === country)
  const pct = ((qty / Math.max(1, totalQty)) * 100).toFixed(1)
  const avgPrice = qty > 0 ? (amt / qty).toFixed(0) : 0

  const now = new Date()
  const dayMap = {}
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dayMap[d.toISOString().split('T')[0]] = 0 }
  countryOrders.forEach(o => { if (dayMap[o.order_date] !== undefined) dayMap[o.order_date] += o.quantity })
  const dayEntries = Object.entries(dayMap)

  const last30 = dayEntries.slice(-30).reduce((s, [, v]) => s + v, 0)
  const prev30 = dayEntries.slice(0, 30).reduce((s, [, v]) => s + v, 0)
  const growth = prev30 > 0 ? ((last30 - prev30) / prev30 * 100).toFixed(1) : 0

  const catMap = {}
  countryOrders.forEach(o => {
    const cat = o.product_category || '未分类'
    catMap[cat] = (catMap[cat] || 0) + o.quantity
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])

  const skuMap = {}
  countryOrders.forEach(o => {
    const sku = o.product_sku || o.product_name || '未知'
    skuMap[sku] = (skuMap[sku] || 0) + o.quantity
  })
  const skuSorted = Object.entries(skuMap).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const topCat = catSorted[0]
  const catDropNote = growth < -5 ? `下降主要来自${topCat?.[0] || '部分'}品类。` : ''
  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="country-detail-header">
          <h3>🌍 {country}</h3>
          <div className="cd-stats">
            <div className="cd-stat"><span className="cd-num">{qty.toLocaleString()}</span><span className="cd-label">出库量</span></div>
            <div className="cd-stat"><span className="cd-num">¥{amt.toLocaleString()}</span><span className="cd-label">销售额</span></div>
            <div className="cd-stat"><span className="cd-num">¥{avgPrice}</span><span className="cd-label">客单价</span></div>
            <div className="cd-stat"><span className={`cd-num ${growth >= 0 ? 'up' : 'down'}`}>{growth}%</span><span className="cd-label">增长率</span></div>
          </div>
        </div>

        <div className="cd-section">
          <h4>近30天出库趋势</h4>
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: dayEntries.filter((_, i) => i % 5 === 0).map(([d]) => d.slice(5)), axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
            series: [{
              type: 'line', data: dayEntries.map(([, v]) => v), smooth: true, symbol: 'none',
              lineStyle: { color: '#6366f1', width: 2 },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }] } }
            }]
          }} style={{ height: 200 }} opts={{ renderer: 'svg' }} />
        </div>

        <div className="cd-section">
          <h4>品类分布</h4>
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c}件 ({d}%)' },
            series: [{
              type: 'pie', radius: ['30%', '55%'],
              data: catSorted.map(([c, v], i) => ({ name: c, value: v, itemStyle: { color: COLORS[i % COLORS.length] } })),
              label: { fontSize: 11, formatter: '{b}\n{d}%' },
            }]
          }} style={{ height: 220 }} opts={{ renderer: 'svg' }} />
        </div>

        <div className="cd-section">
          <h4>SKU排行 TOP 10</h4>
          <div className="cd-sku-list">
            {skuSorted.slice(0, 10).map(([s, v], i) => (
              <div key={i} className="cd-sku-item">
                <span className="cd-sku-idx">{i + 1}</span>
                <span className="cd-sku-name">{s}</span>
                <span className="cd-sku-val">{v}件</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cd-ai-section">
          <h4>🧠 AI 分析</h4>
          <p className="cd-ai-text">
            {country}市场占总出库 <strong>{pct}%</strong>。
            近30天增长率为 <strong className={growth >= 0 ? 'up' : 'down'}>{growth}%</strong>。
            {catDropNote}
            {skuSorted[0] && `热销SKU为 ${skuSorted[0][0]}（${skuSorted[0][1]}件）。`}
            {growth < -5 ? '建议检查广告投放状态并评估库存情况。' : `整体表现${growth >= 0 ? '良好，建议保持现有运营策略。' : '平稳，可关注重点品类优化。'}`}
          </p>
        </div>
      </div>
    </div>
  )
}