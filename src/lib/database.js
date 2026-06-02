import { supabase } from './supabase'

const BATCH_SIZE = 100

/** 导入订单（去重+分批写入，只写 orders 表） */
export async function importOrders(userId, rawRows) {
  if (!userId || !rawRows?.length) {
    return { inserted: 0, skipped: 0, details: [] }
  }

  const details = []
  let skipped = 0

  // 按 order_no 分组
  const orderMap = new Map()
  for (const row of rawRows) {
    if (!row.order_no) continue
    if (!orderMap.has(row.order_no)) {
      orderMap.set(row.order_no, {
        order_no: row.order_no,
        store_name: row.store_name || '',
        country: row.country || '',
        province: row.province || '',
        product_name: row.product_name || '',
        product_category: row.product_category || '未分类',
        total_amount: row.total_amount || 0,
        order_date: row.order_date || '',
        totalQty: 0,
      })
    }
    const o = orderMap.get(row.order_no)
    o.totalQty += row.quantity || 1
    if (row.store_name) o.store_name = row.store_name
    if (row.country) o.country = row.country
    if (row.order_date) o.order_date = row.order_date
    if (row.product_name) o.product_name = row.product_name
    if (row.product_category) o.product_category = row.product_category
  }

  const orderNos = [...orderMap.keys()]

  // 去重检测
  const { data: existing } = await supabase
    .from('orders')
    .select('order_no')
    .eq('user_id', userId)
    .in('order_no', orderNos)
  const existingSet = new Set((existing || []).map(r => r.order_no))
  details.push(`已有订单: ${existingSet.size}`)

  // 新增 vs 跳过
  const newOrders = []
  for (const order of orderMap.values()) {
    if (existingSet.has(order.order_no)) { skipped++; continue }
    newOrders.push({
      user_id: userId,
      order_no: String(order.order_no),
      store_name: order.store_name || '',
      country: order.country || '',
      province: order.province || '',
      product_name: order.product_name || '',
      product_category: order.product_category || '未分类',
      quantity: order.totalQty,
      total_amount: order.total_amount || 0,
      order_date: order.order_date || new Date().toISOString().split('T')[0],
      order_status: 'completed',
    })
  }

  details.push(`待新增: ${newOrders.length}，跳过重复: ${skipped}`)

  // 分批写入
  let inserted = 0
  for (let i = 0; i < newOrders.length; i += BATCH_SIZE) {
    const batch = newOrders.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('orders').insert(batch)
    if (error) throw new Error(`导入失败: ${error.message}`)
    inserted += batch.length
  }

  details.push(`✅ 成功导入 ${inserted} 条`)
  return { inserted, skipped, details }
}

/** 查询已存在订单号 */
export async function findExistingOrders(userId, orderNos) {
  if (!orderNos?.length) return new Set()
  const set = new Set()
  for (let i = 0; i < orderNos.length; i += BATCH_SIZE) {
    const batch = orderNos.slice(i, i + BATCH_SIZE)
    const { data } = await supabase.from('orders').select('order_no').eq('user_id', userId).in('order_no', batch)
    if (data) data.forEach(r => set.add(r.order_no))
  }
  return set
}

/** 获取全部订单 */
export async function getOrders(userId) {
  const PAGE = 1000; const all = []; let from = 0
  while (true) {
    const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('order_date', { ascending: false }).range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/** 清空用户数据 */
export async function clearUserData(userId) {
  const { error } = await supabase.from('orders').delete().eq('user_id', userId)
  if (error) throw new Error(`清空失败: ${error.message}`)
  return true
}

/** 获取订单总数 */
export async function getOrderCount(userId) {
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  return count || 0
}

export default { importOrders, getOrders, clearUserData, findExistingOrders, getOrderCount }