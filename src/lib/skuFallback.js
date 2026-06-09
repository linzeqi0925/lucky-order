export function getEffectiveOrderItems(orders = [], orderItems = []) {
  if (orderItems?.length) return normalizeItems(orderItems)

  const fallback = []
  orders.forEach(order => {
    const skus = splitSkuField(order.product_sku).filter(sku => isValidSkuCandidate(sku, order.order_no))
    if (skus.length > 0) {
      const names = splitSkuField(order.product_name)
      const qtyEach = Math.max(1, Math.floor((order.quantity || skus.length) / skus.length))
      skus.forEach((sku, index) => {
        fallback.push({
          user_id: order.user_id,
          order_no: order.order_no,
          sku,
          product_name: names[index] || order.product_name || '',
          quantity: qtyEach,
          _source: 'orders.product_sku',
        })
      })
      return
    }

    const productNames = splitSkuField(order.product_name)
      .filter(name => isValidSkuCandidate(name, order.order_no))
    if (productNames.length === 0) return

    const qtyEach = Math.max(1, Math.floor((order.quantity || productNames.length) / productNames.length))
    productNames.forEach(name => {
      fallback.push({
        user_id: order.user_id,
        order_no: order.order_no,
        sku: name,
        product_name: name,
        quantity: qtyEach,
        _source: 'orders.product_name',
      })
    })
  })

  return fallback
}

export function isValidSkuCandidate(value, orderNo = '') {
  const sku = String(value || '').trim()
  const order = String(orderNo || '').trim()
  if (!sku) return false
  if (order && sku === order) return false
  if (/^IMP-\d+/i.test(sku)) return false
  if (/^\d{7,}$/.test(sku)) return false
  if (/^\d{7,}[-_]\d+$/.test(sku)) return false
  return true
}

function normalizeItems(items) {
  const normalized = []

  items.forEach(item => {
    const skus = splitSkuField(item.sku).filter(sku => isValidSkuCandidate(sku, item.order_no))
    if (skus.length === 0) return
    if (skus.length <= 1) {
      normalized.push({ ...item, sku: skus[0] })
      return
    }

    const names = splitSkuField(item.product_name)
    const qtyEach = Math.max(1, Math.floor((item.quantity || skus.length) / skus.length))
    skus.forEach((sku, index) => {
      normalized.push({
        ...item,
        sku,
        product_name: names[index] || item.product_name || '',
        quantity: qtyEach,
        _source: item._source || 'split_order_items',
      })
    })
  })

  return normalized
}

function splitSkuField(value) {
  if (!value) return []
  return String(value)
    .split(/[;,，]/)
    .map(s => s.trim())
    .filter(Boolean)
}
