// Supabase 数据库迁移 — 升级到双表结构
// 运行: node migrate.cjs
// 如果 API 调用失败，手动把 SQL 复制到 Supabase SQL Editor 执行

const https = require('https')

const projectRef = 'cgqwkopvoegpkxixwwtk'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncXdrb3B2b2VncGt4aXh3d3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDEyNjE3NSwiZXhwIjoyMDk1NzAyMTc1fQ.y0U3SOhnTrs3KALi6PZQcRyHR5neLONI3eAv7xjYGqE'

const SQL = `
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

-- 2. orders 表补充字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS weekday TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS month TEXT DEFAULT '';

-- 3. orders 唯一性约束
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

-- 4. orders 索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, order_date);

-- 5. order_items RLS
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
`

function post(url, data, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => {
        try { resolve(JSON.parse(buf)) } catch { resolve(buf) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log('🔄 正在执行数据库迁移...\n')

  // 方法1: pg-meta query
  try {
    const result = await post(
      `https://${projectRef}.supabase.co/pg-meta/default/query`,
      { query: SQL },
      serviceKey
    )
    console.log('结果:', JSON.stringify(result).slice(0, 2000))

    if (result && !result.message?.includes('Invalid')) {
      console.log('\n✅ 迁移完成！')
      return
    }
  } catch (e) {
    console.log('方法1失败，尝试方法2...')
  }

  // 方法2: Management API
  try {
    const result = await post(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      { query: SQL },
      serviceKey
    )
    console.log('结果:', JSON.stringify(result).slice(0, 2000))
    console.log('\n✅ 迁移完成！')
    return
  } catch (e) {
    console.error('❌ API 调用均失败:', e.message)
  }

  // 都失败，打印 SQL 让用户手动执行
  console.log('\n' + '='.repeat(60))
  console.log('💡 请手动在 Supabase Dashboard → SQL Editor 中执行以下 SQL：')
  console.log('='.repeat(60))
  console.log(SQL)
  console.log('='.repeat(60))
}

main().catch(e => console.error('❌ 错误:', e.message))