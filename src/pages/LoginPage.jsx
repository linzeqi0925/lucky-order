import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('注册成功！请重新登录。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🖊️</div>
          <h1>Lucky Order</h1>
          <p>出库数据分析看板</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱地址"
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少6位）"
              required
              minLength={6}
            />
          </div>

          {/* 注册提示 */}
          {isRegister && (
            <div className="register-notice">
              ⚠️ 可随意填写注册邮箱，<strong>不需要验证码</strong>，不需要真实邮箱。<br />
              邮箱仅用于创建数据库用，<strong>请保管好注册邮箱及密码！</strong>
            </div>
          )}

          {error && <div className="msg msg-error">{error}</div>}
          {success && <div className="msg msg-success">{success}</div>}

          {isRegister ? (
            <button type="submit" className="btn btn-register" disabled={loading}>
              {loading ? '注册中...' : '注册新账号'}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          )}
        </form>

        <p className="login-toggle" onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}>
          {isRegister ? '已有账号？去登录 →' : '没有账号？去注册 →'}
        </p>
      </div>
    </div>
  )
}