import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildAiDataSummary } from '../lib/aiSummary'

const QUICK_QUESTIONS = [
  '最近出库有没有明显下降？主要受哪些 SKU 或品类影响？',
  '帮我生成一份本周履约经营周报。',
  '哪些 SKU 需要重点关注库存或滞销风险？',
  '新品里哪些已经开始起量，哪些还需要观察？',
  '国家和城市分布有什么值得注意的地方？',
  '店铺之间的表现差异在哪里？',
]

export default function AiAskCenter({ orders, orderItems }) {
  const [question, setQuestion] = useState(QUICK_QUESTIONS[0])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const summary = useMemo(() => buildAiDataSummary(orders, orderItems), [orders, orderItems])

  const ask = async (prompt = question) => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setAnswer('')
    try {
      const { data, error } = await supabase.functions.invoke('ask-ai', {
        body: { question: prompt, summary },
      })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'AI 分析失败')
      setAnswer(data.answer || '')
    } catch (err) {
      setError(err.message || 'AI 问数暂时不可用')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-view">
      <div className="v2-kpi-section">
        <div className="v2-kpi-header">
          <span className="section-badge">🧠 AI 问数</span>
          <span className="mapping-note">只发送聚合摘要，不发送地址和货运单号</span>
        </div>
        <div className="ai-ask-layout">
          <div className="ai-ask-main">
            <textarea
              className="ai-question-input"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="例如：最近 7 天哪些 SKU 下降明显？"
            />
            <div className="ai-ask-actions">
              <button className="btn-primary-sm" onClick={() => ask()} disabled={loading || orders.length === 0}>
                {loading ? '分析中...' : '开始问数'}
              </button>
              <button className="btn-outline-sm" onClick={() => setQuestion('帮我生成一份本周履约经营周报。')}>
                周报
              </button>
            </div>
          </div>
          <div className="ai-scope-card">
            <strong>当前数据范围</strong>
            <span>{summary.scope.orderCount.toLocaleString()} 单 / {summary.kpis.totalQty.toLocaleString()} 件</span>
            <span>{summary.scope.startDate || '-'} 至 {summary.scope.endDate || '-'}</span>
            <span>{summary.kpis.skuCount} 个 SKU / {summary.kpis.countryCount} 个国家</span>
          </div>
        </div>
      </div>

      <div className="selector-grid">
        {QUICK_QUESTIONS.map(item => (
          <button
            key={item}
            className={`selector-chip ${question === item ? 'active' : ''}`}
            onClick={() => { setQuestion(item); ask(item) }}
            disabled={loading}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <div className="chart-card wide">
          <div className="chart-title">AI 问数暂未连通</div>
          <p className="modal-desc">{error}</p>
          <p className="modal-desc">如果这是第一次使用，需要先部署 Supabase Edge Function 并设置 DeepSeek 密钥。</p>
        </div>
      )}

      {answer && (
        <div className="ai-report-card">
          <div className="chart-title">AI 分析结果</div>
          <pre className="ai-answer-text">{answer}</pre>
        </div>
      )}

      {!answer && !error && (
        <div className="chart-row">
          <div className="chart-card">
            <div className="chart-title">可提问方向</div>
            <div className="ai-alert-group">
              <div className="ai-alert-item"><span className="ai-alert-icon">1</span><span className="ai-alert-text">问趋势：最近是否下降、哪天异常、周/月变化。</span></div>
              <div className="ai-alert-item"><span className="ai-alert-icon">2</span><span className="ai-alert-text">问 SKU：增长、滞销、新品、集中度风险。</span></div>
              <div className="ai-alert-item"><span className="ai-alert-icon">3</span><span className="ai-alert-text">问履约：国家、城市、物流渠道、店铺组合。</span></div>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-title">数据摘要</div>
            <div className="ops-summary-list">
              <div className="ops-summary-item"><strong>{summary.topSkus[0]?.name || '-'}</strong><span>TOP SKU</span></div>
              <div className="ops-summary-item"><strong>{summary.topCategories[0]?.name || '-'}</strong><span>TOP 品类</span></div>
              <div className="ops-summary-item"><strong>{summary.topCountries[0]?.name || '-'}</strong><span>TOP 国家</span></div>
              <div className="ops-summary-item"><strong>{summary.logisticsChannels[0]?.name || '-'}</strong><span>TOP 物流渠道</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
