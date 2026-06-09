export function getEffectiveOrderItems(orders = [], orderItems = []) {
  if (orderItems?.length) return normalizeItems(orderItems)

  const fallback = []
  orders.forEach(order => {
    const skus = splitSkuField(order.product_sku)
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

    fallback.push({
      user_id: order.user_id,
      order_no: order.order_no,
      sku: order.product_name || order.order_no || '未知 SKU',
      product_name: order.product_name || '',
      quantity: order.quantity || 1,
      _source: 'orders.product_name',
    })
  })

  return fallback
}

function normalizeItems(items) {
  const normalized = []

  items.forEach(item => {
    const skus = splitSkuField(item.sku)
    if (skus.length <= 1) {
      normalized.push(item)
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
