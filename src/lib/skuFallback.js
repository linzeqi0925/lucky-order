export function getEffectiveOrderItems(orders = [], orderItems = []) {
  if (orderItems?.length) return orderItems

  const fallback = []
  orders.forEach(order => {
    const skus = splitSkuField(order.product_sku)
    if (skus.length > 0) {
      const qtyEach = Math.max(1, Math.floor((order.quantity || skus.length) / skus.length))
      skus.forEach(sku => {
        fallback.push({
          user_id: order.user_id,
          order_no: order.order_no,
          sku,
          product_name: order.product_name || '',
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

function splitSkuField(value) {
  if (!value) return []
  return String(value)
    .split(/[;,，]/)
    .map(s => s.trim())
    .filter(Boolean)
}
