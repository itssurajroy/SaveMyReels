import React, { useState, useEffect } from 'react'

function QueuePage({ settings }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueue()
    // Poll for updates every 5 seconds
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-pending'
      case 'processing': return 'status-processing'
      case 'completed': return 'status-completed'
      case 'failed': return 'status-failed'
      default: return 'status-pending'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '⏳ Pending'
      case 'processing': return '⚡ Processing'
      case 'completed': return '✅ Done'
      case 'failed': return '❌ Failed'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p style={{ marginTop: 16 }}>Loading queue...</p>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3 className="empty-state-title">Queue is empty</h3>
        <p className="empty-state-text">
          Downloads will appear here when you start multiple downloads.
          <br />
          They'll be processed one by one.
        </p>
      </div>
    )
  }

  return (
    <div>
      {queue.map((item, index) => (
        <div key={index} className="queue-item">
          <div className="queue-item-header">
            <span className={`queue-item-status ${getStatusColor(item.status)}`}>
              {getStatusText(item.status)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {item.position && `#${item.position}`}
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
