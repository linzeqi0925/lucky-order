// 加数据库字段脚本
// 通过 Supabase management API 执行
const https = require('https')

const projectRef = 'cgqwkopvoegpkxixwwtk'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncXdrb3B2b2VncGt4aXh3d3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjYxNzUsImV4cCI6MjA5NTcwMjE3NX0.90NOiaxDjwD8i5haUwQl7xRC8mRiWM2fyDqcOuXbKCk'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncXdrb3B2b2VncGt4aXh3d3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDEyNjE3NSwiZXhwIjoyMDk1NzAyMTc1fQ.y0U3SOhnTrs3KALi6PZQcRyHR5neLONI3eAv7xjYGqE'

const sql = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_sku TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
`

function post(url, data, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
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
  console.log('正在执行 SQL...')
  // Try via pg-meta query endpoint
  const result = await post(
    `https://${projectRef}.supabase.co/rest/v1/rpc/`,
    { sql },
    serviceKey
  )
  console.log('结果:', JSON.stringify(result).slice(0, 200))
}

main().catch(e => console.error('错误:', e.message))