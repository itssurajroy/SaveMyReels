import React, { useState, useEffect } from 'react'
import { History, Film, ExternalLink, Clock, Sparkles } from 'lucide-react'

function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
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
        <p style={{ marginTop: 16 }}>Loading export history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon">
          <History size={48} />
        </div>
        <h3 className="empty-state-title">No download history</h3>
        <p className="empty-state-text">
          Your Instagram download log will appear here.
          <br />
          Paste a reel link to start your first download!
        </p>
      </div>
    )
  }

  return (
    <div className="history-list animate-fade-in">
      <div className="section-title-badge">
        <Sparkles size={16} /> Exported Payload Log
      </div>
      {history.map((item, index) => (
        <div key={index} className="history-item">
          <div className="history-icon">
            <Film size={20} />
          </div>
          <div className="history-info">
            <div className="history-title">{item.title || 'Instagram Reel'}</div>
            <div className="history-meta">
              <Clock size={12} /> {formatDate(item.downloaded_at || item.created_at)} • Instagram
            </div>
          </div>
          <button
            className="history-action"
            onClick={() => window.open(item.url, '_blank')}
          >
            Link <ExternalLink size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default HistoryPage
