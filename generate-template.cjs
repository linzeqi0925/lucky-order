// 生成 Lucky Order 订单上传模板
// 运行: node generate-template.cjs
// 输出: 订单上传模板.xlsx
const XLSX = require('xlsx')

const headers = [
  '订单编号', '店铺名', '国家', 'SKU', '订单商品名称', 'SKU总数量', '发货时间', '总金额',
]

const sampleData = [
  ['ORD-20260601-001', 'Shopify US', '美国', 'GY-001', '光敏印章-圆形40mm', 2, '2026-06-01', 25.80],
  ['ORD-20260601-001', 'Shopify US', '美国', 'GY-002', '光敏印章-圆形50mm', 1, '2026-06-01', 18.50],
  ['ORD-20260601-002', 'Etsy EU', '英国', 'JD-001', '胶垫印章-方形60mm', 3, '2026-06-01', 36.00],
  ['ORD-20260601-003', 'Amazon US', '加拿大', 'GY-003', '光敏印章-衣服印章', 5, '2026-06-02', 62.50],
  ['ORD-20260601-003', 'Amazon US', '加拿大', 'JS-001', '金属钢印-小号', 2, '2026-06-02', 45.00],
  ['ORD-20260601-004', 'Shopify UK', '英国', 'GY-001', '光敏印章-圆形40mm', 1, '2026-06-02', 12.90],
  ['ORD-20260601-005', 'Etsy AU', '澳大利亚', 'YL-001', '亚克力印章-套装', 1, '2026-06-03', 38.00],
  ['ORD-20260601-005', 'Etsy AU', '澳大利亚', 'YL-002', '亚克力印章-单枚', 3, '2026-06-03', 45.00],
  ['ORD-20260601-006', 'Amazon DE', '德国', 'PG-001', '皮革印章-姓名定制', 2, '2026-06-03', 56.00],
  ['ORD-20260601-007', 'Shopify US', '美国', 'QB-001', '签字笔-金属款', 10, '2026-06-04', 120.00],
  ['ORD-20260601-008', 'Etsy FR', '法国', 'JD-002', '胶垫印章-圆形50mm', 2, '2026-06-04', 22.00],
]

// 建两个 sheet
const wb = XLSX.utils.book_new()

// Sheet 1: 使用说明
const readme = [
  ['📦 Lucky Order 订单上传模板 — 使用说明'],
  [''],
  ['1. 支持从马帮ERP导出的原始Excel文件直接导入（推荐）'],
  ['2. 如果使用本模板填写，请保持表头名称不变'],
  ['3. 同一个订单有多个SKU时，分行填写（订单编号相同）'],
  ['4. 国家自动识别常见写法：US/USA → 美国, UK → 英国'],
  ['5. SKU总数量 = 该行商品的数量（不是该订单的总数）'],
  [''],
  ['====== 必填字段说明 ======'],
  ['订单编号  → 唯一标识一笔订单（重复导入会自动跳过）'],
  ['店铺名    → 必填，如 Shopify US / Amazon US / Etsy EU'],
  ['国家      → 必填，支持中文/英文/缩写'],
  ['SKU       → 商品库存编码（建议填写，用于SKU分析）'],
  ['SKU总数量  → 该SKU在本订单中的数量'],
  ['发货时间  → 格式：YYYY-MM-DD'],
  [''],
  ['====== 可选字段 ======'],
  ['订单商品名称 → 产品名称描述'],
  ['总金额    → 订单总金额（非必填，不在核心分析指标中）'],
  [''],
  ['====== 表头说明（无需修改） ======'],
]

const readmeSheet = XLSX.utils.aoa_to_sheet(readme)
XLSX.utils.book_append_sheet(wb, readmeSheet, '使用说明')

// Sheet 2: 数据模板
const data = [headers, ...sampleData]
const dataSheet = XLSX.utils.aoa_to_sheet(data)

// 列宽
dataSheet['!cols'] = headers.map((h, i) => {
  const widths = [20, 16, 14, 12, 28, 12, 14, 12]
  return { wch: widths[i] || 14 }
})

XLSX.utils.book_append_sheet(wb, dataSheet, '订单数据')

// 写文件
const filePath = '订单上传模板.xlsx'
XLSX.writeFile(wb, filePath)
console.log(`✅ 模板已生成: ${filePath}`)
console.log(`   - 使用说明 sheet: 操作指引`)
console.log(`   - 订单数据 sheet: ${sampleData.length} 行示例数据`)
console.log(`   - 支持同一订单多SKU分行填写`)
console.log(`   - 国家自动识别标准化`)