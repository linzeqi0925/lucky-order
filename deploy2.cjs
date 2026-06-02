const Surge = require('surge')
const path = require('path')

const dist = path.resolve(__dirname, 'dist')

const surge = Surge({ isTTY: false })

surge.login({
  email: 'luckyorder@luckyck.cn',
  password: 'LuckyOrder2026!'
}, (err, token) => {
  if (err) {
    console.error('登录失败:', err.message || err)
    return
  }
  console.log('✅ 登录成功, token:', token?.token ? '已获取' : '无')
  
  surge.publish({
    project: dist,
    domain: 'luckyck26.surge.sh',
    endpoint: 'surge.surge.sh',
  }, (err2, result) => {
    if (err2) {
      console.error('❌ 部署失败:', err2.message || err2)
      return
    }
    console.log(`\n✅ 部署成功！`)
    console.log(`   访问地址: https://${result}`)
  })
})