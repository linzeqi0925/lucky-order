/**
 * 统一国家映射中心
 * 
 * 所有关于国家的数据集中在这里：
 *   - 导入标准化（US → 美国）
 *   - ECharts 地图（中文 → 英文）
 *   - 坐标（散点图/热力图）
 *   - ISO 代码
 * 
 * 不要再在其他文件里定义 COUNTRY_MAP / CN_TO_EN / EN_TO_CN / WORLD_COORDS。
 */

// ============================================================
// 完整国家注册表
// ============================================================
const COUNTRIES = {
  '美国':       { en: 'United States',        enShort: 'USA',      iso2: 'US', iso3: 'USA', coords: [-95.7129, 37.0902] },
  '英国':       { en: 'United Kingdom',       enShort: 'UK',       iso2: 'GB', iso3: 'GBR', coords: [-3.4359, 55.3781] },
  '加拿大':     { en: 'Canada',               enShort: 'Canada',   iso2: 'CA', iso3: 'CAN', coords: [-106.3468, 56.1304] },
  '德国':       { en: 'Germany',              enShort: 'Germany',  iso2: 'DE', iso3: 'DEU', coords: [10.4515, 51.1657] },
  '法国':       { en: 'France',               enShort: 'France',   iso2: 'FR', iso3: 'FRA', coords: [2.2137, 46.2276] },
  '澳大利亚':   { en: 'Australia',            enShort: 'Australia',iso2: 'AU', iso3: 'AUS', coords: [133.7751, -25.2744] },
  '日本':       { en: 'Japan',                enShort: 'Japan',    iso2: 'JP', iso3: 'JPN', coords: [138.2529, 36.2048] },
  '韩国':       { en: 'South Korea',          enShort: 'S. Korea', iso2: 'KR', iso3: 'KOR', coords: [127.7669, 35.9078] },
  '意大利':     { en: 'Italy',                enShort: 'Italy',    iso2: 'IT', iso3: 'ITA', coords: [12.5674, 41.8719] },
  '西班牙':     { en: 'Spain',                enShort: 'Spain',    iso2: 'ES', iso3: 'ESP', coords: [-3.7492, 40.4637] },
  '荷兰':       { en: 'Netherlands',          enShort: 'Netherlands', iso2: 'NL', iso3: 'NLD', coords: [5.2913, 52.1326] },
  '巴西':       { en: 'Brazil',               enShort: 'Brazil',   iso2: 'BR', iso3: 'BRA', coords: [-51.9253, -14.2350] },
  '墨西哥':     { en: 'Mexico',               enShort: 'Mexico',   iso2: 'MX', iso3: 'MEX', coords: [-102.5528, 23.6345] },
  '新加坡':     { en: 'Singapore',            enShort: 'Singapore',iso2: 'SG', iso3: 'SGP', coords: [103.8198, 1.3521] },
  '印度':       { en: 'India',                enShort: 'India',    iso2: 'IN', iso3: 'IND', coords: [78.9629, 20.5937] },
  '新西兰':     { en: 'New Zealand',          enShort: 'N. Zealand',iso2: 'NZ', iso3: 'NZL', coords: [174.8860, -40.9006] },
  '瑞典':       { en: 'Sweden',               enShort: 'Sweden',   iso2: 'SE', iso3: 'SWE', coords: [18.6435, 60.1282] },
  '瑞士':       { en: 'Switzerland',          enShort: 'Switzerland',iso2:'CH', iso3: 'CHE', coords: [8.2275, 46.8182] },
  '挪威':       { en: 'Norway',               enShort: 'Norway',   iso2: 'NO', iso3: 'NOR', coords: [8.4689, 60.4720] },
  '丹麦':       { en: 'Denmark',              enShort: 'Denmark',  iso2: 'DK', iso3: 'DNK', coords: [9.5018, 56.2639] },
  '波兰':       { en: 'Poland',               enShort: 'Poland',   iso2: 'PL', iso3: 'POL', coords: [19.1451, 51.9194] },
  '俄罗斯':     { en: 'Russia',               enShort: 'Russia',   iso2: 'RU', iso3: 'RUS', coords: [105.3188, 61.5240] },
  '泰国':       { en: 'Thailand',             enShort: 'Thailand', iso2: 'TH', iso3: 'THA', coords: [100.9925, 15.8700] },
  '越南':       { en: 'Vietnam',              enShort: 'Vietnam',  iso2: 'VN', iso3: 'VNM', coords: [108.2772, 14.0583] },
  '马来西亚':   { en: 'Malaysia',             enShort: 'Malaysia', iso2: 'MY', iso3: 'MYS', coords: [101.9758, 4.2105] },
  '菲律宾':     { en: 'Philippines',          enShort: 'Philippines', iso2:'PH', iso3: 'PHL', coords: [121.7740, 12.8797] },
  '印度尼西亚': { en: 'Indonesia',            enShort: 'Indonesia',iso2: 'ID', iso3: 'IDN', coords: [113.9213, -0.7893] },
  '土耳其':     { en: 'Turkey',               enShort: 'Turkey',   iso2: 'TR', iso3: 'TUR', coords: [35.2433, 38.9637] },
  '沙特阿拉伯': { en: 'Saudi Arabia',         enShort: 'Saudi Arabia', iso2:'SA', iso3: 'SAU', coords: [45.0792, 23.8859] },
  '阿联酋':     { en: 'United Arab Emirates', enShort: 'UAE',      iso2: 'AE', iso3: 'ARE', coords: [53.8478, 23.4241] },
  '爱尔兰':     { en: 'Ireland',              enShort: 'Ireland',  iso2: 'IE', iso3: 'IRL', coords: [-8.2439, 53.4129] },
  '奥地利':     { en: 'Austria',              enShort: 'Austria',  iso2: 'AT', iso3: 'AUT', coords: [14.5501, 47.5162] },
  '比利时':     { en: 'Belgium',              enShort: 'Belgium',  iso2: 'BE', iso3: 'BEL', coords: [4.4699, 50.5039] },
  '葡萄牙':     { en: 'Portugal',             enShort: 'Portugal', iso2: 'PT', iso3: 'PRT', coords: [-8.2245, 39.3999] },
  '捷克':       { en: 'Czech Rep.',           enShort: 'Czech Rep.',iso2:'CZ', iso3: 'CZE', coords: [15.4730, 49.8175] },
  '希腊':       { en: 'Greece',               enShort: 'Greece',   iso2: 'GR', iso3: 'GRC', coords: [21.8243, 39.0742] },
  '匈牙利':     { en: 'Hungary',              enShort: 'Hungary',  iso2: 'HU', iso3: 'HUN', coords: [19.5033, 47.1625] },
  '芬兰':       { en: 'Finland',              enShort: 'Finland',  iso2: 'FI', iso3: 'FIN', coords: [25.7482, 61.9241] },
  '罗马尼亚':   { en: 'Romania',              enShort: 'Romania',  iso2: 'RO', iso3: 'ROU', coords: [24.9668, 45.9432] },
  '乌克兰':     { en: 'Ukraine',              enShort: 'Ukraine',  iso2: 'UA', iso3: 'UKR', coords: [31.1656, 48.3794] },
  '以色列':     { en: 'Israel',               enShort: 'Israel',   iso2: 'IL', iso3: 'ISR', coords: [34.8516, 31.0461] },
  '南非':       { en: 'South Africa',         enShort: 'S. Africa', iso2:'ZA', iso3: 'ZAF', coords: [22.9375, -30.5595] },
  '阿根廷':     { en: 'Argentina',            enShort: 'Argentina',iso2: 'AR', iso3: 'ARG', coords: [-63.6167, -38.4161] },
  '哥伦比亚':   { en: 'Colombia',             enShort: 'Colombia', iso2: 'CO', iso3: 'COL', coords: [-74.2973, 4.5709] },
  '智利':       { en: 'Chile',                enShort: 'Chile',    iso2: 'CL', iso3: 'CHL', coords: [-71.5430, -35.6751] },
  '秘鲁':       { en: 'Peru',                 enShort: 'Peru',     iso2: 'PE', iso3: 'PER', coords: [-75.0152, -9.1900] },
  '埃及':       { en: 'Egypt',                enShort: 'Egypt',    iso2: 'EG', iso3: 'EGY', coords: [30.8025, 26.8206] },
  '尼日利亚':   { en: 'Nigeria',              enShort: 'Nigeria',  iso2: 'NG', iso3: 'NGA', coords: [8.6753, 9.0820] },
  '肯尼亚':     { en: 'Kenya',                enShort: 'Kenya',    iso2: 'KE', iso3: 'KEN', coords: [37.9062, -0.0236] },
  '中国':       { en: 'China',                enShort: 'China',    iso2: 'CN', iso3: 'CHN', coords: [104.1954, 35.8617] },
  '台湾':       { en: 'Taiwan',               enShort: 'Taiwan',   iso2: 'TW', iso3: 'TWN', coords: [120.9605, 23.6978] },
  '香港':       { en: 'Hong Kong',            enShort: 'Hong Kong',iso2: 'HK', iso3: 'HKG', coords: [114.1694, 22.3193] },
  '澳门':       { en: 'Macao',                enShort: 'Macao',    iso2: 'MO', iso3: 'MAC', coords: [113.5491, 22.1987] },
}

// ============================================================
// 别名表（用于导入标准化）
// 小写 key 映射到标准中文名
// ============================================================
const ALIASES = {
  'united states': '美国', 'us': '美国', 'usa': '美国', 'america': '美国',
  'united kingdom': '英国', 'uk': '英国', 'england': '英国', 'great britain': '英国',
  'canada': '加拿大', 'ca': '加拿大',
  'australia': '澳大利亚', 'au': '澳大利亚',
  'germany': '德国', 'de': '德国', 'deutschland': '德国',
  'france': '法国', 'fr': '法国',
  'japan': '日本', 'jp': '日本',
  'south korea': '韩国', 'korea': '韩国', 'kr': '韩国',
  'italy': '意大利', 'it': '意大利',
  'spain': '西班牙', 'es': '西班牙',
  'netherlands': '荷兰', 'nl': '荷兰', 'holland': '荷兰',
  'brazil': '巴西', 'br': '巴西',
  'mexico': '墨西哥', 'mx': '墨西哥',
  'singapore': '新加坡', 'sg': '新加坡',
  'india': '印度', 'in': '印度',
  'new zealand': '新西兰', 'nz': '新西兰',
  'sweden': '瑞典', 'se': '瑞典',
  'switzerland': '瑞士', 'ch': '瑞士',
  'norway': '挪威', 'no': '挪威',
  'denmark': '丹麦', 'dk': '丹麦',
  'poland': '波兰', 'pl': '波兰',
  'russia': '俄罗斯', 'ru': '俄罗斯',
  'thailand': '泰国', 'th': '泰国',
  'vietnam': '越南', 'vn': '越南',
  'malaysia': '马来西亚', 'my': '马来西亚',
  'philippines': '菲律宾', 'ph': '菲律宾',
  'indonesia': '印度尼西亚', 'id': '印度尼西亚',
  'turkey': '土耳其', 'tr': '土耳其',
  'saudi arabia': '沙特阿拉伯', 'sa': '沙特阿拉伯',
  'uae': '阿联酋', 'united arab emirates': '阿联酋',
  'ireland': '爱尔兰', 'ie': '爱尔兰',
  'austria': '奥地利', 'at': '奥地利',
  'belgium': '比利时', 'be': '比利时',
  'portugal': '葡萄牙', 'pt': '葡萄牙',
  'czech': '捷克', 'czech republic': '捷克',
  'greece': '希腊', 'gr': '希腊',
  'hungary': '匈牙利', 'hu': '匈牙利',
  'finland': '芬兰', 'fi': '芬兰',
  'romania': '罗马尼亚', 'ro': '罗马尼亚',
  'ukraine': '乌克兰', 'ua': '乌克兰',
  'israel': '以色列', 'il': '以色列',
  'south africa': '南非', 'za': '南非',
  'argentina': '阿根廷', 'ar': '阿根廷',
  'colombia': '哥伦比亚', 'co': '哥伦比亚',
  'chile': '智利', 'cl': '智利',
  'peru': '秘鲁', 'pe': '秘鲁',
  'egypt': '埃及', 'eg': '埃及',
  'nigeria': '尼日利亚', 'ng': '尼日利亚',
  'kenya': '肯尼亚', 'ke': '肯尼亚',
  'china': '中国', 'cn': '中国',
  'taiwan': '台湾', 'tw': '台湾',
  'hong kong': '香港', 'hk': '香港',
  'macao': '澳门', 'macau': '澳门', 'mo': '澳门',
}

// ============================================================
// 导出函数
// ============================================================

/** 导入时标准化国家名：'us' / 'USA' / 'united states' → '美国' */
export function normalizeCountry(raw) {
  if (!raw) return ''
  const key = raw.toString().trim().toLowerCase()
  return ALIASES[key] || raw.toString().trim()
}

/** 获取国家的英文名（用于 ECharts 世界地图匹配） */
export function getEnglishName(cnName) {
  return COUNTRIES[cnName]?.en || cnName
}

/** 获取 world.json 中用于地图匹配的国家名 */
export function getMapName(cnName) {
  const en = getEnglishName(cnName)
  const overrides = {
    'United States': 'United States of America',
    'USA': 'United States of America',
    'South Korea': 'Korea',
    'Czech Rep.': 'Czechia',
  }
  return overrides[en] || en
}

/** 获取国家坐标（用于散点/热力图） */
export function getCoords(cnName) {
  return COUNTRIES[cnName]?.coords || null
}

/** 判断国家是否在注册表中 */
export function isValidCountry(name) {
  return !!COUNTRIES[name]
}

/** 获取所有已知国家的中文名列表 */
export function getCountryList() {
  return Object.keys(COUNTRIES)
}

/** 获取国家详情 */
export function getCountryInfo(cnName) {
  return COUNTRIES[cnName] || null
}

/** 获取国家 ISO2 代码 */
export function getCountryISO2(cnName) {
  return COUNTRIES[cnName]?.iso2 || null
}

/** 根据 ECharts world.json 中的英文名反向查找中文名 */
export function cnFromEnglish(enName) {
  if (!enName) return ''
  const entry = Object.entries(COUNTRIES).find(([, v]) =>
    v.en.toLowerCase() === enName.toLowerCase() ||
    v.enShort?.toLowerCase() === enName.toLowerCase()
  )
  return entry ? entry[0] : enName
}

/** 
 * 构建 ECharts 地图数据（支持 choropleth / scatter）
 * @param {Object} cnValueMap  { 中文名: 数值 }
 * @param {'choropleth'|'scatter'} mode
 */
export function buildMapData(cnValueMap, mode = 'scatter') {
  if (!cnValueMap) return []
  const entries = Object.entries(cnValueMap)
  if (mode === 'choropleth') {
    return entries.map(([cn, val]) => ({
      name: getEnglishName(cn),
      cnName: cn,
      value: val,
    }))
  }
  // scatter
  return entries.map(([cn, val]) => {
    const coords = getCoords(cn)
    if (!coords) return null
    return { name: getEnglishName(cn), cnName: cn, value: [...coords, val] }
  }).filter(Boolean)
}

export default COUNTRIES
