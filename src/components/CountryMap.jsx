import { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { getMapData } from '../lib/worldmap'

const COLORS = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981','#06b6d4','#3b82f6']

export default function CountryMap({ orders }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // 加载世界地图 GeoJSON
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(data => {
        // Convert topojson to geojson
        const { features } = data.objects.countries
        echarts.registerMap('world', { features, type: 'FeatureCollection' })
        setMapLoaded(true)
      })
      .catch(() => {
        // Fallback: 空地图
        setMapLoaded(true)
      })
  }, [])

  // 国家统计数据
  const countryStats = useMemo(() => {
    const qtyMap = {}
    const amtMap = {}
    let totalQty = 0
    let totalAmt = 0
    orders.forEach(o => {
      const c = o.country || '未知'
      qtyMap[c] = (qtyMap[c] || 0) + o.quantity
      amtMap[c] = (amtMap[c] || 0) + parseFloat(o.total_amount || 0)
      totalQty += o.quantity
      totalAmt += parseFloat(o.total_amount || 0)
    })
    const entries = Object.entries(qtyMap).sort((a, b) => b[1] - a[1])
    return { qtyMap, amtMap, entries, totalQty, totalAmt }
  }, [orders])

  // 地图散点图配置
  const mapOption = useMemo(() => {
    const data = getMapData(countryStats.qtyMap, countryStats.amtMap)
    const maxVal = Math.max(...data.map(d => d.value[2]), 1)
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const d = params.data
          if (!d) return ''
          const pct = ((d.value[2] / Math.max(1, countryStats.totalQty)) * 100).toFixed(1)
          return `<strong>${d.name}</strong><br/>
            📦 订单量：${d.value[2].toLocaleString()} 件<br/>
            💰 销售额：¥${(d.amount || 0).toLocaleString()}<br/>
            📊 占比：${pct}%`
        }
      },
      visualMap: {
        min: 0,
        max: maxVal,
        text: ['多', '少'],
        textStyle: { color: '#64748b' },
        inRange: { color: ['#e0e7ff', '#818cf8', '#4f46e5', '#3730a3'] },
        calculable: true,
        left: 20,
        bottom: 20,
      },
      geo: {
        map: 'world',
        roam: true,
        label: { show: false },
        itemStyle: {
          areaColor: '#f1f5f9',
          borderColor: '#e2e8f0',
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: { areaColor: '#cbd5e1' },
          label: { show: true, fontSize: 11, color: '#0f172a' },
        },
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        data: data,
        symbolSize: (val) => Math.max(6, Math.sqrt(val[2] / Math.max(1, maxVal)) * 40),
        encode: { value: 2 },
        label: {
          show: true,
          formatter: (params) => params.data.name,
          fontSize: 10,
          color: '#0f172a',
          position: 'right',
        },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#4f46e5' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(99,102,241,0.4)' },
        },
        itemStyle: {
          color: '#6366f1',
          shadowBlur: 4,
          shadowColor: 'rgba(99,102,241,0.2)',
        },
      }],
    }
  }, [countryStats])

  return (
    <div className="country-map-module">
      <div className="map-header">
        <h4>🌍 全球订单分布</h4>
        <span className="map-subtitle">气泡越大 = 订单越多 | 点击国家查看详情</span>
      </div>

      <div className="map-container">
        <ReactECharts
          option={mapOption}
          style={{ height: 420 }}
          opts={{ renderer: 'svg' }}
          onEvents={{
            click: (params) => {
              if (params.data?.name) {
                const name = params.data.name
                const qty = countryStats.qtyMap[name] || 0
                const amt = countryStats.amtMap[name] || 0
                setSelectedCountry({ name, qty, amt })
              }
            }
          }}
        />
      </div>

      {/* 国家排行侧栏 */}
      <div className="map-ranks">
        <h4>国家排行 TOP 10</h4>
        <div className="map-rank-list">
          {countryStats.entries.slice(0, 10).map(([c, qty], i) => {
            const amt = countryStats.amtMap[c] || 0
            const pct = ((qty / Math.max(1, countryStats.totalQty)) * 100).toFixed(1)
            return (
              <div key={c} className={`map-rank-item ${selectedCountry?.name === c ? 'active' : ''}`}
                onClick={() => setSelectedCountry({ name: c, qty, amt })}>
                <span className="mr-idx">{i + 1}</span>
                <span className="mr-flag">🌍</span>
                <span className="mr-name">{c}</span>
                <div className="mr-bar-track">
                  <div className="mr-bar" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="mr-pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 国家详情弹窗 */}
      {selectedCountry && (
        <CountryDetailModal
          country={selectedCountry.name}
          orders={orders}
          qty={selectedCountry.qty}
          amt={selectedCountry.amt}
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

  // 近30天趋势
  const now = new Date()
  const dayMap = {}
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dayMap[d.toISOString().split('T')[0]] = 0 }
  countryOrders.forEach(o => { if (dayMap[o.order_date] !== undefined) dayMap[o.order_date] += o.quantity })
  const dayEntries = Object.entries(dayMap)

  // 前30天对比
  const last30 = dayEntries.slice(-30).reduce((s, [, v]) => s + v, 0)
  const prev30 = dayEntries.slice(0, 30).reduce((s, [, v]) => s + v, 0)
  const growth = prev30 > 0 ? ((last30 - prev30) / prev30 * 100).toFixed(1) : 0

  // 品类分布
  const catMap = {}
  countryOrders.forEach(o => {
    const cat = o.product_category || '未分类'
    catMap[cat] = (catMap[cat] || 0) + o.quantity
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])

  // SKU排行
  const skuMap = {}
  countryOrders.forEach(o => {
    const sku = o.product_sku || o.product_name || '未知'
    skuMap[sku] = (skuMap[sku] || 0) + o.quantity
  })
  const skuSorted = Object.entries(skuMap).sort((a, b) => b[1] - a[1]).slice(0, 20)

  // AI分析文本
  const topCat = catSorted[0]
  const catDropNote = growth < -5 ? `下降主要来自${topCat?.[0] || '部分'}品类` : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="country-detail-header">
          <h3>🌍 {country}</h3>
          <div className="cd-stats">
            <div className="cd-stat"><span className="cd-num">{qty.toLocaleString()}</span><span className="cd-label">订单量</span></div>
            <div className="cd-stat"><span className="cd-num">¥{amt.toLocaleString()}</span><span className="cd-label">销售额</span></div>
            <div className="cd-stat"><span className="cd-num">¥{avgPrice}</span><span className="cd-label">客单价</span></div>
            <div className="cd-stat"><span className={`cd-num ${growth >= 0 ? 'up' : 'down'}`}>{growth}%</span><span className="cd-label">增长率</span></div>
          </div>
        </div>

        {/* 近30天趋势 */}
        <div className="cd-section">
          <h4>近30天订单趋势</h4>
          <ReactECharts option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 40, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: dayEntries.filter((_, i) => i % 5 === 0).map(([d]) => d.slice(5)), axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } } },
            series: [{ type: 'line', data: dayEntries.map(([, v]) => v), smooth: true, symbol: 'none',
              lineStyle: { color: '#6366f1', width: 2 },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }] } }
            }]
          }} style={{ height: 200 }} opts={{ renderer: 'svg' }} />
        </div>

        {/* 品类分布 */}
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

        {/* SKU排行 */}
        <div className="cd-section">
          <h4>SKU排行 TOP 20</h4>
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

        {/* AI分析 */}
        <div className="cd-ai-section">
          <h4>🧠 AI 分析</h4>
          <p className="cd-ai-text">
            {country}市场占总订单 <strong>{pct}%</strong>。
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