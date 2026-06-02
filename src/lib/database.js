/**
 * 数据库操作封装
 * 
 * 统一管理 orders + order_items 双表的读写操作。
 * 核心能力：
 *   1. 去重导入（检测重复、只插新增）
 *   2. SKU 自动拆分（order → orders + order_items）
 *   3. 批量操作（分批写入 + 事务）
 */

import { supabase } from './supabase'
import { normalizeCountry } from './countries'

const BATCH_SIZE = 100

// ============================================================
// 导入：去重检测 + 批量写入
// ============================================================

/**
 * 导入一批订单（含去重 + SKU 拆分）
 * 
 * @param {string} userId
 * @param {Array} rawRows  马帮解析后的原始行（每行含 sku / order_no）
 * @returns {{ inserted: number, skipped: number, itemsInserted: number, details: string[] }}
 */
export async function importOrders(userId, rawRows) {
  if (!userId || !rawRows?.length) {
    return { inserted: 0, skipped: 0, itemsInserted: 0, details: [] }
  }

  const details = []
  let skipped = 0

  // 检查数据是否已经是聚合好的（processMabang 输出的格式）
  const isPreAggregated = rawRows[0] && Array.isArray(rawRows[0].items)

  // —— 1. 按 order_no 分组 ——
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
        quantity: row.quantity || 1,
        total_amount: row.total_amount || 0,
        order_date: row.order_date || '',
        rawDate: row.rawDate || null,
        items: [],
        totalQty: 0,
      })
    }
    const o = orderMap.get(row.order_no)
    if (isPreAggregated) {
      // 预聚合数据：items 已是最终值，只累加数量
      if (row.items && row.items.length > 0) {
        o.items = row.items
        o.totalQty = row.quantity || row.items.reduce((s, i) => s + (i.quantity || 1), 0)
      } else {
        o.totalQty += row.quantity || 1
      }
      // 覆盖字段
      if (row.store_name) o.store_name = row.store_name
      if (row.country) o.country = row.country
      if (row.order_date) o.order_date = row.order_date
      if (row.product_name) o.product_name = row.product_name
      if (row.product_category) o.product_category = row.product_category
    } else {
      // 原始马帮行：逐行累加
      o.totalQty += row.quantity || 1
      if (row.sku || row.product_name) {
        o.items.push({
          sku: row.sku || '',
          product_name: row.product_name || '',
          quantity: row.quantity || 1,
        })
      }
      if (row.store_name) o.store_name = row.store_name
      if (row.country) o.country = row.country
      if (row.order_date) o.order_date = row.order_date
    }
  }

  const orderNos = [...orderMap.keys()]
  const allOrders = orderMap.values()

  // —— 2. 去重检测：查出已存在的订单号 ——
  const existingSet = await findExistingOrders(userId, orderNos)
  details.push(`已有订单数: ${existingSet.size}`)

  // —— 3. 拆分：新增 vs 跳过 ——
  const newOrders = []
  const orderItemsBatch = []

  for (const order of allOrders) {
    if (existingSet.has(order.order_no)) {
      skipped++
      continue
    }

    const dateStr = formatDate(order.rawDate || order.order_date)
    const orderRecord = {
      user_id: userId,
      order_no: String(order.order_no),
      store_name: order.store_name || '',
      country: normalizeCountry(order.country),
      province: order.province || '',
      product_name: order.product_name || order.items.map(i => i.product_name).filter(Boolean).join('; ') || '',
      product_category: order.product_category || '未分类',
      quantity: order.totalQty,
      total_amount: order.total_amount || 0,
      order_date: dateStr,
      weekday: getWeekday(dateStr),
      month: getMonth(dateStr),
      order_status: 'completed',
    }
    newOrders.push(orderRecord)

    // 准备 order_items
    for (const item of order.items) {
      orderItemsBatch.push({
        user_id: userId,
        order_no: String(order.order_no),
        sku: item.sku,
        product_name: item.product_name,
        quantity: item.quantity,
      })
    }
  }

  details.push(`待新增订单: ${newOrders.length}`)
  details.push(`待跳过重复: ${skipped}`)
  details.push(`待插入 SKU 明细: ${orderItemsBatch.length}`)

  // —— 4. 分批写入 orders ——
  let inserted = 0
  for (let i = 0; i < newOrders.length; i += BATCH_SIZE) {
    const batch = newOrders.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('orders').insert(batch)
    if (error) throw new Error(`订单写入失败: ${error.message}`)
    inserted += batch.length
  }

  // —— 5. 分批写入 order_items ——
  let itemsInserted = 0
  for (let i = 0; i < orderItemsBatch.length; i += BATCH_SIZE) {
    const batch = orderItemsBatch.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('order_items').insert(batch)
    if (error) throw new Error(`SKU明细写入失败: ${error.message}`)
    itemsInserted += batch.length
  }

  details.push(`✅ 完成: 新增订单 ${inserted}，SKU明细 ${itemsInserted}`)

  return { inserted, skipped, itemsInserted, details }
}

// ============================================================
// 查询
// ============================================================

/** 查找已存在的订单号，返回 Set */
export async function findExistingOrders(userId, orderNos) {
  if (!orderNos?.length) return new Set()
  const set = new Set()
  // 分批查询
  for (let i = 0; i < orderNos.length; i += BATCH_SIZE) {
    const batch = orderNos.slice(i, i + BATCH_SIZE)
    const { data } = await supabase
      .from('orders')
      .select('order_no')
      .eq('user_id', userId)
      .in('order_no', batch)
    if (data) data.forEach(r => set.add(r.order_no))
  }
  return set
}

/** 获取用户的所有订单（分页，不受 1000 行限制） */
export async function getOrders(userId) {
  const PAGE = 1000
  const all = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('order_date', { ascending: false })
      .range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/** 获取用户的所有 SKU 明细（分页，不受 1000 行限制） */
export async function getOrderItems(userId) {
  const PAGE = 1000
  const all = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/** 获取带 SKU 明细的完整订单数据（联合查询） */
export async function getOrdersWithItems(userId) {
  const [orders, items] = await Promise.all([
    getOrders(userId),
    getOrderItems(userId),
  ])
  // 按 order_no 分组 items
  const itemsByOrder = {}
  items.forEach(item => {
    if (!itemsByOrder[item.order_no]) itemsByOrder[item.order_no] = []
    itemsByOrder[item.order_no].push(item)
  })
  return orders.map(o => ({
    ...o,
    items: itemsByOrder[o.order_no] || [],
  }))
}

/** 清空用户数据（orders + order_items） */
export async function clearUserData(userId) {
  const { error: err1 } = await supabase
    .from('order_items')
    .delete()
    .eq('user_id', userId)
  if (err1) throw new Error(`清空SKU明细失败: ${err1.message}`)

  const { error: err2 } = await supabase
    .from('orders')
    .delete()
    .eq('user_id', userId)
  if (err2) throw new Error(`清空订单失败: ${err2.message}`)

  return true
}

/** 获取用户总订单数 */
export async function getOrderCount(userId) {
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

// ============================================================
// 工具函数
// ============================================================

function formatDate(val) {
  if (!val) return new Date().toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  const d = new Date(val)
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(val)
}

function getWeekday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

function getMonth(dateStr) {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}年${parseInt(m[2])}月` : ''
}

export default { importOrders, getOrders, getOrderItems, getOrdersWithItems, clearUserData, findExistingOrders, getOrderCount }