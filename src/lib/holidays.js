// 2026年跨境电商海外营销日历
// 全部已精确到具体日期（MM-DD格式）

const holidays = [
  {
    month: 1,
    events: [
      { date: '01-01', name: '元旦 New Year\'s Day', type: 'holiday', region: '全球', note: '新年假期，物流可能延迟' },
      { date: '01-19', name: '马丁·路德·金纪念日 MLK Day', type: 'holiday', region: '美国', note: '长周末，部分物流停运' },
      { date: '01-26', name: '澳大利亚日 Australia Day', type: 'holiday', region: '澳洲', note: '澳洲国庆日' },
    ]
  },
  {
    month: 2,
    events: [
      { date: '02-17', name: '🧧 春节 Chinese New Year', type: 'festival', region: '中国/东南亚', note: '正月初一，工厂放假，提前备货！' },
      { date: '02-08', name: '🏈 超级碗 Super Bowl', type: 'event', region: '美国', note: '体育周边产品热销' },
      { date: '02-14', name: '💕 情人节 Valentine\'s Day', type: 'festival', region: '全球', note: '礼品/定制产品需求高峰' },
      { date: '02-16', name: '总统日 President\'s Day', type: 'holiday', region: '美国', note: '促销季，电商大促' },
    ]
  },
  {
    month: 3,
    events: [
      { date: '03-08', name: '👩 妇女节 Women\'s Day', type: 'festival', region: '全球', note: '女性相关产品推广时机' },
      { date: '03-14', name: '白色情人节 White Day', type: 'festival', region: '日本/韩国', note: '回礼消费' },
      { date: '03-15', name: '母亲节(英) Mothering Sunday', type: 'festival', region: '英国', note: '英国母亲节' },
      { date: '03-17', name: '🍀 圣帕特里克节 St.Patrick\'s Day', type: 'festival', region: '爱尔兰/美国', note: '绿色主题产品' },
    ]
  },
  {
    month: 4,
    events: [
      { date: '04-01', name: '愚人节 April Fools\' Day', type: 'festival', region: '全球', note: '趣味产品营销' },
      { date: '04-05', name: '清明节 Qingming', type: 'festival', region: '中国', note: '国内假期' },
      { date: '04-12', name: '🐣 复活节 Easter', type: 'festival', region: '欧美', note: '彩蛋/兔子主题产品热销' },
      { date: '04-22', name: '🌍 地球日 Earth Day', type: 'event', region: '全球', note: '环保/可持续产品推广' },
    ]
  },
  {
    month: 5,
    events: [
      { date: '05-01', name: '劳动节 Labour Day', type: 'holiday', region: '全球', note: '多国放假' },
      { date: '05-04', name: '🇯🇵 日本黄金周 Golden Week', type: 'festival', region: '日本', note: '日本最长假期' },
      { date: '05-10', name: '💐 母亲节 Mother\'s Day', type: 'festival', region: '美国/加拿大', note: '礼品消费高峰！' },
      { date: '05-25', name: '🇺🇸 阵亡将士纪念日 Memorial Day', type: 'holiday', region: '美国', note: '夏季促销开始，户外产品起量' },
    ]
  },
  {
    month: 6,
    events: [
      { date: '06-01', name: '🧒 儿童节 Children\'s Day', type: 'festival', region: '中国', note: '礼品类需求' },
      { date: '06-14', name: '👨 父亲节 Father\'s Day', type: 'festival', region: '美国/英国', note: '男士礼品/定制礼品高峰' },
      { date: '06-19', name: '六月节 Juneteenth', type: 'holiday', region: '美国', note: '新增联邦假日' },
      { date: '06-23~26', name: '🔥 亚马逊Prime Day', type: 'sales', region: '全球', note: '⚠️ 年中最大促销！提前1-2个月备货！' },
      { date: '06-15起', name: '🇺🇸 返校季 Back to School', type: 'sales', region: '美国/加拿大', note: '⚠️ 文具/印章/标签等产品高峰！持续至9月' },
    ]
  },
  {
    month: 7,
    events: [
      { date: '07-01', name: '🇨🇦 加拿大日 Canada Day', type: 'holiday', region: '加拿大', note: '国庆日' },
      { date: '07-04', name: '🇺🇸 美国独立日 Independence Day', type: 'holiday', region: '美国', note: '国庆促销，红蓝主题产品' },
      { date: '07-14', name: '🇫🇷 法国国庆日 Bastille Day', type: 'holiday', region: '法国', note: '法国国庆' },
    ]
  },
  {
    month: 8,
    events: [
      { date: '08-03', name: '公民日 Civic Holiday', type: 'holiday', region: '加拿大', note: '长周末' },
      { date: '08-09', name: '🇸🇬 新加坡国庆日 National Day', type: 'holiday', region: '新加坡', note: '东南亚市场' },
    ]
  },
  {
    month: 9,
    events: [
      { date: '09-07', name: '劳动节 Labour Day', type: 'holiday', region: '美国/加拿大', note: '夏季促销收尾' },
      { date: '09-15起', name: '🇦🇪 中东返校季', type: 'sales', region: '中东', note: '阿联酋/沙特开学采购' },
      { date: '09-26', name: '欧洲遗产日 Heritage Days', type: 'event', region: '欧洲', note: '文化消费' },
    ]
  },
  {
    month: 10,
    events: [
      { date: '10-01', name: '🇨🇳 中国国庆节 National Day', type: 'holiday', region: '中国', note: '国庆黄金周' },
      { date: '10-09', name: '🇰🇷 韩文日 Hangeul Day', type: 'holiday', region: '韩国', note: '韩国假期' },
      { date: '10-12', name: '哥伦布日/原住民日', type: 'holiday', region: '美国', note: '联邦假日' },
      { date: '10-31', name: '🎃 万圣节 Halloween', type: 'festival', region: '欧美', note: '主题装饰/派对产品热销' },
    ]
  },
  {
    month: 11,
    events: [
      { date: '11-11', name: '双11 Singles\' Day / 老兵节', type: 'sales', region: '中国/美国', note: '中国大促 + 美国老兵节' },
      { date: '11-26', name: '🦃 感恩节 Thanksgiving', type: 'holiday', region: '美国', note: '家庭聚会，餐具/装饰品需求' },
      { date: '11-29', name: '🔥 黑色星期五 Black Friday', type: 'sales', region: '全球', note: '⚠️ 全年最大促销日！' },
    ]
  },
  {
    month: 12,
    events: [
      { date: '12-02', name: '网络星期一 Cyber Monday', type: 'sales', region: '全球', note: '线上购物高峰' },
      { date: '12-25', name: '🎄 圣诞节 Christmas', type: 'holiday', region: '全球', note: '圣诞礼品热销，物流高峰' },
      { date: '12-26', name: '节礼日 Boxing Day', type: 'sales', region: '英联邦', note: '打折季开始' },
      { date: '12-31', name: '🎆 跨年夜 New Year\'s Eve', type: 'festival', region: '全球', note: '派对用品需求' },
    ]
  }
]

// 获取即将到来的节假日
export function getUpcomingHolidays() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const thisMonth = holidays.find(h => h.month === currentMonth)
  const next = holidays.find(h => h.month === nextMonth)

  // 返回当前月和下个月，以及"即将到来"的标记
  return { current: thisMonth || null, next: next || null }
}

// 格式化日期显示：MM-DD → M月D日
export function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.includes('~')) {
    // 范围日期如 06-23~26
    const [start, end] = dateStr.split('~')
    const [m, d] = start.split('-')
    return `${parseInt(m)}月${parseInt(d)}日~${end.replace(/^\d+-/, '')}日`
  }
  const [m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

// 判断是否为重要促销节点
export function isImportant(event) {
  return event.type === 'sales' ||
         event.name.includes('返校') ||
         event.name.includes('Prime') ||
         event.name.includes('黑五') ||
         event.name.includes('圣诞') ||
         event.name.includes('春节') ||
         event.name.includes('母亲节') ||
         event.name.includes('情人节') ||
         event.name.includes('万圣节')
}

export function getAllHolidays() {
  return holidays
}

export default holidays