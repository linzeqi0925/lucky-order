import { parseMeta } from './charts'

export function buildAiDataSummary(orders = [], orderItems = []) {
  const orderDateList = orders.map(o => o.order_date).filter(Boolean).sort()
  const orderByNo = Object.fromEntries(orders.map(order => [order.order_no, order]))
  const itemsWithDate = orderItems.map(item => ({
    ...item,
    order_date: orderByNo[item.order_no]?.order_date || '',
    country: orderByNo[item.order_no]?.country || '',
    store_name: orderByNo[item.order_no]?.store_name || '',
    category: orderByNo[item.order_no]?.product_category || '未分类',
  }))

  const totalQty = orders.reduce((sum, order) => sum + (order.quantity || 0), 0)
  const trend = rankByDate(orders)
  const topSkus = rank(itemsWithDate, item => item.sku, item => item.quantity || 0, item => item.product_name)
  const topCategories = rank(orders, order => order.product_category || '未分类', order => order.quantity || 0)
  const topStores = rank(orders, order => order.store_name, order => order.quantity || 0)
  const topCountries = rank(orders, order => order.country, order => order.quantity || 0)
  const topProvinces = rank(orders, order => order.province, order => order.quantity || 0)
  const logisticsChannels = rank(orders, order => parseMeta(order.remark, '物流渠道'), order => order.quantity || 0)
  const firstSkuDate = getFirstDateMap(itemsWithDate, item => item.sku)
  const latestDate = orderDateList.at(-1) || ''
  const newProducts = Object.entries(firstSkuDate)
    .map(([sku, firstDate]) => ({
      sku,
      firstDate,
      qty: itemsWithDate.filter(item => item.sku === sku).reduce((sum, item) => sum + (item.quantity || 0), 0),
      productName: itemsWithDate.find(item => item.sku === sku)?.product_name || '',
    }))
    .filter(item => item.firstDate && latestDate && diffDays(item.firstDate, latestDate) <= 30)
    .sort((a, b) => b.qty - a.qty)

  return {
    scope: {
      orderCount: orders.length,
      itemCount: orderItems.length,
      startDate: orderDateList[0] || '',
      endDate: latestDate,
    },
    kpis: {
      totalQty,
      skuCount: new Set(orderItems.map(item => item.sku).filter(Boolean)).size,
      categoryCount: new Set(orders.map(order => order.product_category).filter(Boolean)).size,
      storeCount: new Set(orders.map(order => order.store_name).filter(Boolean)).size,
      countryCount: new Set(orders.map(order => order.country).filter(Boolean)).size,
      avgQtyPerOrder: orders.length ? Number((totalQty / orders.length).toFixed(2)) : 0,
    },
    trend,
    topSkus,
    topCategories,
    topStores,
    topCountries,
    topProvinces,
    logisticsChannels,
    newProducts,
    risks: buildRisks({ topSkus, topCountries, totalQty, orders }),
  }
}

function rank(list, keyFn, valueFn, extraFn) {
  const map = {}
  list.forEach(item => {
    const key = keyFn(item)
    if (!key) return
    if (!map[key]) map[key] = { name: key, value: 0, extra: '' }
    map[key].value += valueFn(item)
    if (extraFn && !map[key].extra) map[key].extra = extraFn(item) || ''
  })
  return Object.values(map).sort((a, b) => b.value - a.value)
}

function rankByDate(orders) {
  const map = {}
  orders.forEach(order => {
    if (!order.order_date) return
    if (!map[order.order_date]) map[order.order_date] = { date: order.order_date, orders: 0, quantity: 0 }
    map[order.order_date].orders += 1
    map[order.order_date].quantity += order.quantity || 0
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

function getFirstDateMap(list, keyFn) {
  const map = {}
  list.forEach(item => {
    const key = keyFn(item)
    if (!key || !item.order_date) return
    if (!map[key] || item.order_date < map[key]) map[key] = item.order_date
  })
  return map
}

function buildRisks({ topSkus, topCountries, totalQty, orders }) {
  const risks = []
  if (topSkus[0] && topSkus[0].value / Math.max(1, totalQty) > 0.35) {
    risks.push({ type: 'sku_concentration', text: `TOP SKU ${topSkus[0].name} 占出库量 ${(topSkus[0].value / totalQty * 100).toFixed(1)}%` })
  }
  if (topCountries[0] && topCountries[0].value / Math.max(1, totalQty) > 0.55) {
    risks.push({ type: 'country_concentration', text: `主力国家 ${topCountries[0].name} 占出库量 ${(topCountries[0].value / totalQty * 100).toFixed(1)}%` })
  }
  const unclassifiedQty = orders
    .filter(order => (order.product_category || '未分类') === '未分类')
    .reduce((sum, order) => sum + (order.quantity || 0), 0)
  if (unclassifiedQty > 0) {
    risks.push({ type: 'unclassified', text: `未分类出库量 ${unclassifiedQty} 件` })
  }
  return risks
}

function diffDays(start, end) {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  return Math.round((e - s) / 86400000)
}
