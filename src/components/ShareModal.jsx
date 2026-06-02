import { useState } from 'react'

export default function ShareModal({ orders, user, onClose }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}?shared=${user.id}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>🔗 分享数据给同事</h3>
        <p className="modal-desc">把链接发给同事，对方打开就能看到你的数据</p>
        <div className="share-url-box">
          <input readOnly value={shareUrl} className="share-input" onClick={e => e.target.select()} />
          <button className="btn-primary-sm" onClick={handleCopy}>{copied ? '✅ 已复制' : '📋 复制链接'}</button>
        </div>
        <div className="share-info">
          <span>📊 共 {orders.length} 条订单数据</span>
          <span>👤 分享者：{user.email}</span>
        </div>
      </div>
    </div>
  )
}