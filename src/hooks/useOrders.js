import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 1000

/**
 * 加载某张表的全部数据（通过分页绕过 max_rows 限制）
 */
async function loadAllFrom(table, userId, orderBy) {
  const all = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PAGE_SIZE - 1)

    if (orderBy) query.order(orderBy, { ascending: false })

    const { data, error } = await query
    if (error) throw error

    if (data && data.length > 0) {
      all.push(...data)
      from += PAGE_SIZE
      if (data.length < PAGE_SIZE) hasMore = false
    } else {
      hasMore = false
    }
  }

  return all
}

/**
 * Hook: 加载用户订单数据（支持超过 1000 行）
 */
export function useOrders(user) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await loadAllFrom('orders', user.id, 'order_date')
      setOrders(data)
    } catch (e) {
      console.error('加载订单失败:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return { orders, loading, loadOrders, setOrders }
}

/**
 * Hook: 加载 order_items 数据（支持超过 1000 行）
 */
export function useOrderItems(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await loadAllFrom('order_items', user.id)
      setItems(data)
    } catch (e) {
      console.error('加载 SKU 明细失败:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  return { items, loading, loadItems }
}

/**
 * Hook: 筛选状态管理
 */
export function useFilters() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStore, setFilterStore] = useState('')

  const filteredOrders = useCallback((orders) => {
    return orders.filter(o => {
      if (filterCategory && o.product_category !== filterCategory) return false
      if (filterSupplier && o.supplier !== filterSupplier) return false
      if (filterStore && o.store_name !== filterStore) return false
      if (dateRange.start && o.order_date < dateRange.start) return false
      if (dateRange.end && o.order_date > dateRange.end) return false
      return true
    })
  }, [dateRange, filterCategory, filterSupplier, filterStore])

  const hasFilter = filterCategory || filterSupplier || filterStore || dateRange.start || dateRange.end

  const clearFilters = () => {
    setDateRange({ start: '', end: '' })
    setFilterCategory('')
    setFilterSupplier('')
    setFilterStore('')
  }

  return {
    dateRange, setDateRange,
    filterCategory, setFilterCategory,
    filterSupplier, setFilterSupplier,
    filterStore, setFilterStore,
    filteredOrders, hasFilter, clearFilters,
  }
}