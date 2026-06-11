import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const authHeader = req.headers.get('Authorization') || ''

    if (!deepseekKey || !supabaseUrl || !supabaseAnonKey) {
      return json({ ok: false, error: 'AI 后端还没有配置完成' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return json({ ok: false, error: '请先登录后再使用 AI 问数' }, 401)
    }

    const { question, summary } = await req.json()
    if (!question || String(question).trim().length < 2) {
      return json({ ok: false, error: '请输入要分析的问题' }, 400)
    }

    const safeSummary = limitSummary(summary)
    const payload = {
      model: 'deepseek-v4-flash',
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content: [
            '你是 Lucky Order 跨境电商履约数据分析助手。',
            '只基于用户提供的聚合数据回答，不要编造不存在的数据。',
            '回答中文，结构为：结论、依据、建议。',
            '重点分析出库、SKU、品类、店铺、国家地区、物流渠道、新品、异常风险。',
            '不要输出买家隐私、地址、邮编、货运单号等敏感信息。',
          ].join(''),
        },
        {
          role: 'user',
          content: `问题：${String(question).slice(0, 500)}\n\n数据摘要：${JSON.stringify(safeSummary).slice(0, 18000)}`,
        },
      ],
    }

    const aiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify(payload),
    })

    const text = await aiRes.text()
    if (!aiRes.ok) {
      return json({ ok: false, error: `DeepSeek 调用失败：${text.slice(0, 300)}` }, 502)
    }

    const data = JSON.parse(text)
    return json({
      ok: true,
      answer: data?.choices?.[0]?.message?.content || 'AI 没有返回内容',
      usage: data?.usage || null,
    })
  } catch (error) {
    return json({ ok: false, error: error.message || 'AI 分析失败' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function limitSummary(summary: Record<string, unknown> = {}) {
  return {
    scope: summary.scope,
    kpis: summary.kpis,
    trend: takeArray(summary.trend, 120),
    topSkus: takeArray(summary.topSkus, 30),
    topCategories: takeArray(summary.topCategories, 20),
    topStores: takeArray(summary.topStores, 20),
    topCountries: takeArray(summary.topCountries, 20),
    topProvinces: takeArray(summary.topProvinces, 20),
    logisticsChannels: takeArray(summary.logisticsChannels, 20),
    newProducts: takeArray(summary.newProducts, 20),
    risks: takeArray(summary.risks, 20),
  }
}

function takeArray(value: unknown, limit: number) {
  return Array.isArray(value) ? value.slice(0, limit) : []
}
