import React, { useState, useEffect } from 'react'
import { Clock, Loader2, CheckCircle2, AlertCircle, Sparkles, Layers } from 'lucide-react'

function QueuePage({ settings }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchQueue = async () => {
    try {
      const tg = window.Telegram?.WebApp
      const userId = tg?.initDataUnsafe?.user?.id

      if (!userId) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/queue/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setQueue(data.queue || [])
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <Loader2 size={16} className="animate-spin" />
      case 'completed': return <CheckCircle2 size={16} />
      case 'failed': return <AlertCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p style={{ marginTop: 16 }}>Loading processing queue...</p>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon">
          <Layers size={48} />
        </div>
        <h3 className="empty-state-title">Processing queue empty</h3>
        <p className="empty-state-text">
          Active background exports will show up here.
          <br />
          Items are processed automatically in real time!
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="section-title-badge">
        <Sparkles size={16} /> Active Export Jobs ({queue.length})
      </div>
      {queue.map((item, index) => (
        <div key={index} className="queue-item">
          <div className="queue-item-header">
            <span className={`queue-item-status status-${item.status}`}>
              {getStatusIcon(item.status)} {item.status.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {item.position && `Position #${item.position}`}
            </span>
          </div>
          <div className="queue-item-url">{item.url}</div>
          {item.status === 'processing' && (
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div
                className="progress-fill"
                style={{ width: `${item.progress || 0}%` }}
              ></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default QueuePage
