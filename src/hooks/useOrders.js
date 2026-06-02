import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook: 加载用户订单数据
 */
export function useOrders(user) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('order_date', { ascending: false })
      .limit(100000)
    if (data) setOrders(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return { orders, loading, loadOrders, setOrders }
}

/**
 * Hook: 加载 order_items 数据
 */
export function useOrderItems(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('user_id', user.id)
    if (data) setItems(data)
    setLoading(false)
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