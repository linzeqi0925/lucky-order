import { useState, useMemo, useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { getCoords } from '../lib/worldmap'

const COLORS = ['#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#10b981','#06b6d4','#3b82f6']

// 中文→英文国家名映射（供 ECharts world.json 使用）
const CN_TO_EN = {
  '美国':'United States','英国':'United Kingdom','加拿大':'Canada','德国':'Germany',
  '法国':'France','澳大利亚':'Australia','日本':'Japan','韩国':'South Korea',
  '意大利':'Italy','西班牙':'Spain','荷兰':'Netherlands','巴西':'Brazil',
  '墨西哥':'Mexico','新加坡':'Singapore','印度':'India','新西兰':'New Zealand',
  '瑞典':'Sweden','瑞士':'Switzerland','挪威':'Norway','丹麦':'Denmark',
  '波兰':'Poland','俄罗斯':'Russia','泰国':'Thailand','越南':'Vietnam',
  '马来西亚':'Malaysia','菲律宾':'Philippines','印度尼西亚':'Indonesia',
  '土耳其':'Turkey','沙特阿拉伯':'Saudi Arabia','阿联酋':'United Arab Emirates',
  '爱尔兰':'Ireland','奥地利':'Austria','比利时':'Belgium','葡萄牙':'Portugal',
  '捷克':'Czech Rep.','希腊':'Greece','匈牙利':'Hungary','芬兰':'Finland',
  '罗马尼亚':'Romania','乌克兰':'Ukraine','以色列':'Israel','南非':'South Africa',
  '阿根廷':'Argentina','哥伦比亚':'Colombia','埃及':'Egypt','中国':'China',
  '台湾':'Taiwan','香港':'Hong Kong',
}

export default function CountryMap({ orders }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const chartRef = useRef(null)

  // 加载 ECharts 官方世界地图
  useEffect(() => {
    fetch('https://unpkg.com/echarts@5.5.0/map/json/world.json')
      .then(r => r.json())
      .then(data => {
        echarts.registerMap('world', data)
        setMapLoaded(true)
      })
      .catch(() => {
        // 如果网络不行，用备用 CDN
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
          .then(r => r.json())
          .then(topojson => {
            const { features } = topojson.objects.countries
            echarts.registerMap('world', { features, type: 'FeatureCollection' })
            setMapLoaded(true)
          })
          .catch(() => setMapLoaded(true))
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
    return { qtyMap, amtMap, entries: Object.entries(qtyMap).sort((a, b) => b[1] - a[1]), totalQty }
  }, [orders])

  // 地图选项
  const mapOption = useMemo(() => {
    if (!mapLoaded) return {}
    const maxVal = Math.max(...Object.values(countryStats.qtyMap), 1)
    // 散点数据：用英文名匹配地图特征
    const scatterData = Object.entries(countryStats.qtyMap).map(([cn, qty]) => {
      const en = CN_TO_EN[cn] || cn
      const coords = getCoords(cn)
      if (!coords) return null
      return { name: en, cnName: cn, value: [...coords, qty], amount: countryStats.amtMap[cn] || 0 }
    }).filter(Boolean)

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const d = params.data || params
          const name = d.cnName || d.name || ''
          const val = d.value?.[2] || 0
          const amt = d.amount || 0
          const pct = ((val / Math.max(1, countryStats.totalQty)) * 100).toFixed(1)
          return `<strong>${name}</strong><br/>
            📦 订单量：${val.toLocaleString()} 件<br/>
            💰 销售额：¥${amt.toLocaleString()}<br/>
            📊 占比：${pct}%`
        }
      },
      visualMap: {
        min: 0, max: maxVal,
        text: ['多','少'], textStyle: { color: '#64748b', fontSize: 11 },
        inRange: { color: ['#e0e7ff','#818cf8','#4f46e5','#3730a3'] },
        calculable: true, left: 20, bottom: 20,
      },
      geo: {
        map: 'world', roam: true,
        label: { show: false },
        itemStyle: {
          areaColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: { areaColor: '#dbeafe' },
          label: { show: true, fontSize: 11, color: '#0f172a' },
        },
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        data: scatterData,
        symbolSize: (val) => Math.max(8, Math.sqrt(val[2] / Math.max(1, maxVal)) * 40),
        encode: { value: 2 },
        label: {
          show: true,
          formatter: (p) => p.data.cnName,
          fontSize: 11, color: '#0f172a', fontWeight: 600,
          position: 'right',
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#4f46e5' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(99,102,241,0.5)', borderColor: '#fff', borderWidth: 2 },
        },
        itemStyle: { color: '#6366f1', shadowBlur: 6, shadowColor: 'rgba(99,102,241,0.3)' },
      }],
    }
  }, [mapLoaded, countryStats])

  const handleMapClick = (params) => {
    if (params.data?.cnName) {
      const name = params.data.cnName
      setSelectedCountry({
        name,
        qty: countryStats.qtyMap[name] || 0,
        amt: countryStats.amtMap[name] || 0,
      })
    }
  }

  return (
    <div className="country-map-module">
      <div className="map-header">
        <h4>🌍 全球订单分布</h4>
        <span className="map-subtitle">气泡越大 = 订单越多 | 点击国家查看详情</span>
      </div>

      <div className="map-container">
        {!mapLoaded ? (
          <div className="empty-sm" style={{height:400,display:'flex',alignItems:'center',justifyContent:'center'}}>⏳ 加载地图中...</div>
        ) : (
          <ReactECharts ref={chartRef} option={mapOption} style={{height:440}}
            opts={{renderer:'canvas'}}
            onEvents={{ click: handleMapClick }} />
        )}
      </div>

      {/* 国家排行 */}
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
                <span className="mr-qty">{qty.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {selectedCountry && (
        <CountryDetailModal
          country={selectedCountry.name} orders={orders}
          qty={selectedCountry.qty} amt={selectedCountry.amt}
          totalQty={countryStats.totalQty}
          onClose={() => setSelectedCountry(null)} />
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

        <div className="cd-section">
          <h4>品类分布</h4>
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c}件 ({d}%)' },
            series: [{ type: 'pie', radius: ['30%', '55%'],
              data: catSorted.map(([c, v], i) => ({ name: c, value: v, itemStyle: { color: COLORS[i % COLORS.length] } })),
              label: { fontSize: 11, formatter: '{b}\n{d}%' },
            }]
          }} style={{ height: 220 }} opts={{ renderer: 'svg' }} />
        </div>

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