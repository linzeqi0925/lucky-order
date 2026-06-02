# 数据库迁移

请打开 Supabase Dashboard → SQL Editor，按顺序执行以下 SQL。

## 1. 建 order_items 表 + 索引

```sql
-- ============================================
-- Lucky Order 3.0 数据库迁移
-- 1. 创建 order_items 表
-- 2. 添加 orders 唯一性约束
-- 3. 补齐索引和 RLS
-- ============================================

-- 1. 创建 SKU 明细表
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- order_items 索引
CREATE INDEX IF NOT EXISTS idx_order_items_user_id ON order_items(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_no ON order_items(order_no);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
CREATE INDEX IF NOT EXISTS idx_order_items_user_sku ON order_items(user_id, sku);
```

## 2. orders 表补充字段

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS weekday TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS month TEXT DEFAULT '';
```

## 3. 添加唯一性约束（去重）

```sql
-- 先清理重复数据，保留最早那条
DELETE FROM orders a USING (
  SELECT MIN(id) as id, user_id, order_no
  FROM orders
  GROUP BY user_id, order_no
  HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id
  AND a.order_no = b.order_no
  AND a.id <> b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_order_no_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_user_id_order_no_key UNIQUE (user_id, order_no);
  END IF;
END $$;
```

## 4. 补充索引

```sql
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, order_date);
```

## 5. 开启 order_items 行级安全

```sql
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can delete their own order items" ON order_items;

CREATE POLICY "Users can view their own order items"
  ON order_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own order items"
  ON order_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order items"
  ON order_items FOR DELETE USING (auth.uid() = user_id);
```

全部执行完后，在 SQL Editor 里运行以下命令验证：

```sql
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items');

SELECT conname, conrelid::regclass as table_name 
FROM pg_constraint WHERE conname = 'orders_user_id_order_no_key';
```

预期看到：
- orders 和 order_items 都存在
- 唯一约束 `orders_user_id_order_no_key` 存在

> ⚠️ **注意**：执行第 3 步的清重 SQL 会删除重复订单数据，只保留最早那条。如果你的数据里有同一订单号的重复记录，确认后再跑。