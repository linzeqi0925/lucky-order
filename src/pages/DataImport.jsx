/**
 * 导入中心 V2
 *
 * 增强功能：
 *   1. 导入统计（原始记录/订单/SKU/新增/重复/国家标准化/空号填充）
 *   2. 数据质量检测（导入前检查 SKU/国家/日期/数量异常）
 *   3. 重复导入提示（新增/重复/跳过 清晰展示）
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { importOrders } from '../lib/database'
import { classifyProduct } from '../lib/classifier'
import { normalizeCountry } from '../lib/countries'
import { findKey, formatExcelDate, getWeekday, getMonth } from '../lib/charts'

export default function DataImport({ onImported }) {
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  // 调试：确认 input 是否真实存在于 DOM
  useEffect(() => {
    setTimeout(() => {
      const el = document.querySelector('input[type=file]')
      console.log('===== DOM 检查 =====')
      console.log('FILE INPUT:', el)
      if (el) {
        console.log('hidden=', el.hidden)
        console.log('disabled=', el.disabled)
      } else {
        console.error('FILE INPUT 不存在于 DOM！')
      }
    }, 2000)
  }, [])

  const handleFile = async (e) => {
    console.log('===== 文件选择触发 =====')
    const file = e.target.files?.[0]
    console.log(file)
    if (!file) {
      console.error('没有读取到文件')
      return
    }
    await parseFile(file)
    // 清空文件输入，允许重复选择同一文件
    e.target.value = ''
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    console.log('===== DROP =====')
    const file = e.dataTransfer.files?.[0]
    console.log(file)
    if (!file) {
      console.error('拖拽文件为空')
      return
    }
    await parseFile(file)
  }

  const parseFile = useCallback(async (file) => {
    console.log('===== parseFile =====')
    console.log('文件名:', file.name)
    console.log('文件大小:', file.size)
    setParsing(true)
    setError('')
    try {
      console.log('STEP1 开始读取文件')
      const buf = await file.arrayBuffer()
      console.log('STEP2 文件读取成功', buf.byteLength)

      console.log('STEP3 开始 import xlsx')
      const XLSX = await import('xlsx')
      console.log('STEP3 XLSX import 成功', typeof XLSX)
      console.log('STEP3 XLSX 是否有 read', typeof XLSX.read)

      console.log('STEP4 开始 XLSX.read')
      const wb = XLSX.read(buf, { type: 'array' })
      console.log('STEP5 XLSX.read 成功')
      console.log('STEP5 SheetNames', wb.SheetNames)

      const sheetName = wb.SheetNames[0]
      console.log('STEP6 sheetName', sheetName)

      const ws = wb.Sheets[sheetName]
      console.log('STEP7 worksheet ok')

      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      console.log('STEP8 rows 数量', rawRows.length)

      if (!rawRows || rawRows.length < 2) throw new Error('表格中没有数据')

      const header = rawRows[0]
      console.log('STEP9 header', header)
      if (!header || header.length === 0) throw new Error('表头为空')
      const dataRows = rawRows.slice(1).filter(r => r.some(c => c !== ''))
      if (dataRows.length === 0) throw new Error('表格中没有数据')

      const isMabang = header.some(h => ['订单编号','SKU','店铺名','订单商品名称','发货时间'].includes(h))

      let orders, cleanInfo, qualityIssues
      if (isMabang) {
        const result = processMabang(header, dataRows)
        orders = result.orders
        cleanInfo = result.cleanInfo
        qualityIssues = result.qualityIssues
      } else {
        const keys = header
        const fieldMap = {
          order_no: findKey(keys, ['订单号','订单编号','order_no','OrderNo']),
          product_category: findKey(keys, ['品类','产品大类','分类','category']),
          product_name: findKey(keys, ['产品名称','商品名称','product_name']),
          quantity: findKey(keys, ['数量','出库量','qty','Qty','quantity']),
          order_date: findKey(keys, ['日期','下单日期','出库日期','date','Date']),
          store_name: findKey(keys, ['店铺名','店铺','store_name']),
          country: findKey(keys, ['国家','country']),
        }

        qualityIssues = { emptySku: 0, emptyCountry: 0, emptyDate: 0, badQty: 0, details: [] }

        orders = dataRows.map((row, i) => {
          const get = (k) => k ? String(row[header.indexOf(k)] ?? '') : ''
          const dateStr = get(fieldMap.order_date)
          const rawCountry = get(fieldMap.country)
          const rawQty = parseInt(get(fieldMap.quantity)) || 0

          if (!get(fieldMap.product_name) && !get(fieldMap.order_no)) qualityIssues.emptySku++
          if (!rawCountry) qualityIssues.emptyCountry++
          if (!dateStr) qualityIssues.emptyDate++
          if (rawQty <= 0) qualityIssues.badQty++

          return {
            order_no: get(fieldMap.order_no) || `IMP-${Date.now()}-${i}`,
            store_name: get(fieldMap.store_name),
            country: normalizeCountry(rawCountry),
            province: '',
            product_name: get(fieldMap.product_name),
            product_sku: '',
            product_category: get(fieldMap.product_category) || '未分类',
            quantity: rawQty || 1,
            order_date: formatExcelDate(dateStr),
            weekday: getWeekday(dateStr),
            month: getMonth(dateStr),
            total_amount: 0,
            items: [],
          }
        })
        cleanInfo = { rawRows: dataRows.length, mergedOrders: orders.length, filledDown: 0, normalizedCountries: 0, itemsCount: 0 }
      }

      setPreview({ orders: orders.slice(0, 20), total: orders.length, allOrders: orders, cleanInfo, isMabang, qualityIssues })
    } catch (err) {
      console.error('PARSE ERROR', err)
      console.error('PARSE ERROR message:', err.message)
      console.error('PARSE ERROR stack:', err.stack)
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }, [])

  const handleImport = async () => {
    if (!preview) return
    setParsing(true)
    setError('')
    try {
      const user = (await supabase.auth.getUser()).data.user
      const result = await importOrders(user.id, preview.allOrders)
      setPreview(null)
      onImported(result)
    } catch (err) {
      setError('导入失败：' + err.message)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="import-page">
      <div className="import-card">
        <div className="import-header">
          <h3>📥 导入出库数据</h3>
          <p>支持马帮ERP原始文件，自动清洗、填充、聚合、去重、标准化</p>
        </div>
        {!preview ? (
          <div className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              console.log('===== 点击 dropzone =====')
              const input = document.querySelector('input[type=file]')
              if (input) { input.click() }
              else { console.error('input[type=file] 不存在') }
            }}>
            <div className="dropzone-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="10" y="6" width="36" height="44" rx="6" stroke="#6366f1" strokeWidth="2" fill="rgba(99,102,241,0.05)"/>
                <path d="M28 20v18M19 29l9 9 9-9" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="dropzone-text">{parsing ? '⏳ 解析中...' : '拖拽 Excel / CSV 到此处'}</p>
            <p className="dropzone-hint">支持 .xlsx .xls .csv 格式</p>
            {!parsing && (
              <label className="btn-ghost" style={{cursor:'pointer',display:'inline-block'}}>
                选择文件
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} hidden />
              </label>
            )}
          </div>
        ) : (
          <div className="preview-area">
            <div className="preview-header">
              <span className="preview-count">
                🚚 {preview.isMabang ? '马帮文件' : 'Excel文件'} · <strong>{preview.total}</strong> 笔订单
                <span className="mabang-badge">已清洗</span>
              </span>
              <div className="preview-actions">
                <button className="btn-ghost" onClick={() => setPreview(null)}>取消</button>
                <button className="btn-primary-sm" onClick={handleImport} disabled={parsing}>
                  {parsing ? '⏳ 导入中...' : '✅ 确认导入'}
                </button>
              </div>
            </div>

            {preview.qualityIssues && (
              <div className="clean-report">
                <div className="clean-stat">
                  <span className="clean-label">SKU 为空</span>
                  <span className="clean-val" style={preview.qualityIssues.emptySku > 0 ? {color:'#dc2626'} : {}}>
                    {preview.qualityIssues.emptySku} 行
                  </span>
                </div>
                <div className="clean-stat">
                  <span className="clean-label">国家为空</span>
                  <span className="clean-val" style={preview.qualityIssues.emptyCountry > 0 ? {color:'#dc2626'} : {}}>
                    {preview.qualityIssues.emptyCountry} 行
                  </span>
                </div>
                <div className="clean-stat">
                  <span className="clean-label">日期为空</span>
                  <span className="clean-val" style={preview.qualityIssues.emptyDate > 0 ? {color:'#dc2626'} : {}}>
                    {preview.qualityIssues.emptyDate} 行
                  </span>
                </div>
                <div className="clean-stat">
                  <span className="clean-label">数量异常</span>
                  <span className="clean-val" style={preview.qualityIssues.badQty > 0 ? {color:'#dc2626'} : {}}>
                    {preview.qualityIssues.badQty} 行
                  </span>
                </div>
              </div>
            )}

            <div className="clean-report">
              <div className="clean-stat"><span className="clean-label">原始记录数</span><span className="clean-val">{preview.cleanInfo.rawRows}</span></div>
              <div className="clean-stat"><span className="clean-label">合并后订单</span><span className="clean-val">{preview.cleanInfo.mergedOrders}</span></div>
              <div className="clean-stat"><span className="clean-label">空号填充</span><span className="clean-val">{preview.cleanInfo.filledDown} 行</span></div>
              <div className="clean-stat"><span className="clean-label">国家标准化</span><span className="clean-val">{preview.cleanInfo.normalizedCountries} 条</span></div>
              <div className="clean-stat"><span className="clean-label">SKU 明细</span><span className="clean-val">{preview.cleanInfo.itemsCount} 条</span></div>
              <div className="clean-stat"><span className="clean-label">存储维度</span><span className="clean-val">双表结构 ✅</span></div>
            </div>

            <div className="field-mapping-bar">
              <span className="mapping-chip"><span className="chip-field">订单编号</span> 去重检测</span>
              <span className="mapping-chip"><span className="chip-field">SKU</span> 自动拆分为明细</span>
              <span className="mapping-chip"><span className="chip-field">国家</span> 标准化（US→美国）</span>
              <span className="mapping-chip"><span className="chip-field">发货时间</span> 提取日/星期/月份</span>
            </div>

            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead><tr><th>订单号</th><th>店铺</th><th>国家</th><th>商品/SKU</th><th>数量</th><th>日期</th><th>星期</th></tr></thead>
                <tbody>{preview.orders.map((o, i) => (
                  <tr key={i}>
                    <td><span className="orderno-sm">{o.order_no}</span></td>
                    <td>{o.store_name}</td>
                    <td>{o.country}</td>
                    <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{o.product_name}</td>
                    <td>{o.quantity}</td>
                    <td>{o.order_date}</td>
                    <td>{o.weekday}</td>
                  </tr>
                ))}</tbody>
              </table>
              {preview.total > 20 && <p className="preview-more">...还有 {preview.total - 20} 笔订单</p>}
            </div>
            {error && <div className="error-msg">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== 马帮处理核心 ========== */
function processMabang(header, dataRows) {
  const idx = (name) => header.indexOf(name)

  const orderNoIdx = idx('订单编号')
  const storeIdx = idx('店铺名')
  const skuTotalIdx = idx('SKU总数量')
  const countryIdx = idx('国家')
  const provinceIdx = idx('所属地区（省/州）')
  const skuIdx = idx('SKU')
  const productNameIdx = idx('订单商品名称')
  const dateIdx = idx('发货时间')

  let lastOrderNo = ''
  let filledDown = 0
  let normalizedCountries = 0
  let emptySku = 0
  let emptyCountry = 0
  let emptyDate = 0
  let badQty = 0

  const filled = dataRows.map(row => {
    const rawNo = row[orderNoIdx]
    if (rawNo && rawNo.toString().trim()) lastOrderNo = rawNo.toString().trim()
    else filledDown++
    const rawCountry = row[countryIdx]
    const normCountry = normalizeCountry(rawCountry)
    if (normCountry !== (rawCountry || '').toString().trim() && rawCountry) normalizedCountries++
    const rawSku = String(row[skuIdx] || '')
    const rawQty = parseInt(row[skuTotalIdx]) || 0
    const rawDate = row[dateIdx]

    if (!rawSku) emptySku++
    if (!rawCountry) emptyCountry++
    if (!rawDate) emptyDate++
    if (rawQty <= 0) badQty++

    return {
      order_no: lastOrderNo,
      store_name: String(row[storeIdx] || ''),
      country: normCountry,
      province: String(row[provinceIdx] || ''),
      sku: rawSku,
      product_name: String(row[productNameIdx] || ''),
      quantity: rawQty || 1,
      rawDate,
      product_category: '',
    }
  })

  const orderMap = {}
  let itemsCount = 0
  filled.forEach(row => {
    if (!row.order_no) return
    if (!orderMap[row.order_no]) {
      orderMap[row.order_no] = {
        order_no: row.order_no, store_name: row.store_name, country: row.country,
        province: row.province, totalQty: 0, items: [], productNames: [], rawDate: row.rawDate, product_category: '',
      }
    }
    const o = orderMap[row.order_no]
    o.totalQty += row.quantity
    if (row.sku || row.product_name) {
      o.items.push({ sku: row.sku, product_name: row.product_name, quantity: row.quantity })
      itemsCount++
    }
    if (row.product_name && !o.productNames.includes(row.product_name)) o.productNames.push(row.product_name)
    if (row.store_name) o.store_name = row.store_name
    if (row.country) o.country = row.country
    if (row.rawDate && !o.rawDate) o.rawDate = row.rawDate
    if (row.product_category && !o.product_category) o.product_category = row.product_category
  })

  const orders = Object.values(orderMap).map(o => {
    const dateStr = formatExcelDate(o.rawDate)
    return {
      order_no: o.order_no, store_name: o.store_name, country: o.country, province: o.province,
      product_name: o.productNames.join('; ') || o.items.map(i => i.product_name).filter(Boolean).join(', '),
      product_sku: o.items.map(i => i.sku).filter(Boolean).join(';'),
      product_category: o.product_category || classifyProduct(o.productNames[0] || o.items[0]?.sku || ''),
      quantity: o.totalQty, order_date: dateStr, total_amount: 0, items: o.items,
    }
  })

  return {
    orders,
    cleanInfo: { rawRows: dataRows.length, mergedOrders: orders.length, filledDown, normalizedCountries, itemsCount },
    qualityIssues: { emptySku, emptyCountry, emptyDate, badQty },
  }
}