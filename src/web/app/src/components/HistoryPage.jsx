import React, { useState, useEffect } from 'react'

function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      // Get user ID from Telegram WebApp
      const tg = window.Telegram?.WebApp
      const userId = tg?.initDataUnsafe?.user?.id

      if (!userId) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/downloads/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p style={{ marginTop: 16 }}>Loading history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <h3 className="empty-state-title">No downloads yet</h3>
        <p className="empty-state-text">
          Your download history will appear here.
          <br />
          Start by downloading an Instagram video!
        </p>
      </div>
    )
  }

  return (
    <div className="history-list">
      {history.map((item, index) => (
        <div key={index} className="history-item">
          <div className="history-icon">
            {item.platform === 'instagram' ? '📸' : '🎥'}
          </div>
          <div className="history-info">
            <div className="history-title">{item.title || 'Instagram Video'}</div>
            <div className="history-meta">
              {formatDate(item.created_at)} • {item.platform}
            </div>
          </div>
          <button
            className="history-action"
            onClick={() => window.open(item.url, '_blank')}
          >
            View
          </button>
        </div>
      ))}
    </div>
  )
}

export default HistoryPage
