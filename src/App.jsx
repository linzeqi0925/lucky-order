import { Component, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="app-loading" style={{ padding: 24, textAlign: 'center' }}>
        <h2>页面加载遇到问题</h2>
        <p style={{ color: '#64748b', marginTop: 8 }}>请刷新页面，或退出后重新登录。</p>
        <p style={{ color: '#dc2626', marginTop: 8, fontSize: 12, maxWidth: 720 }}>
          {this.state.error?.message}
        </p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => location.reload()}>
          刷新页面
        </button>
      </div>
    )
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch(() => {
      setSession(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="app-loading">
      <div className="spinner"></div>
      <p>加载中...</p>
    </div>
  )

  return (
    <AppErrorBoundary>
      {session ? <Dashboard session={session} /> : <LoginPage />}
    </AppErrorBoundary>
  )
}

export default App
