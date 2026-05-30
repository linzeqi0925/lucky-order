const path = require('path')
const Surge = require('surge')

const dist = path.resolve(__dirname, 'dist')

const surge = Surge()

// Configure with credentials
surge.email = 'luckyorder@luckyck.cn'  

surge.publish({
  project: dist,
  domain: 'luckyck26.surge.sh',
  endpoint: 'surge.surge.sh',
  email: 'luckyorder@luckyck.cn',
  password: 'LuckyOrder2026!'
}, (err, result) => {
  if (err) {
    console.error('❌ 部署失败:', err.message || err)
    return
  }
  console.log(`\n✅ 部署成功！`)
  console.log(`   访问地址: https://${result.domain}`)
})