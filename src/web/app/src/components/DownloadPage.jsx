import React, { useState } from 'react'

function DownloadPage({ settings }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)

  const handleDownload = async () => {
    if (!url.trim()) {
      setStatus({ type: 'error', message: 'Please enter a URL' })
      return
    }

    // Validate Instagram URL
    const instagramPattern = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|stories)\/[\w-]+/i
    if (!instagramPattern.test(url)) {
      setStatus({ type: 'error', message: 'Please enter a valid Instagram URL' })
      return
    }

    setLoading(true)
    setProgress(0)
    setStatus({ type: 'info', message: 'Starting download...' })
    setResult(null)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      // Call the bot API
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, quality: settings.quality }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const data = await response.json()
      setProgress(100)
      setStatus({ type: 'success', message: 'Download complete!' })
      setResult(data)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Download failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch (err) {
      // Clipboard access might be denied
      console.error('Failed to read clipboard:', err)
    }
  }

  return (
    <div>
      <div className="download-card">
        <div className="input-group">
          <label>Instagram URL</label>
          <input
            type="url"
            className="url-input"
            placeholder="https://www.instagram.com/reel/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>
          ) : (
            '📥 Download Now'
          )}
        </button>

        {loading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-text">{progress}% - Processing...</p>
          </div>
        )}

        {status && (
          <div className={`status-message status-${status.type}`}>
            {status.message}
          </div>
        )}
      </div>

      {result && (
        <div className="download-card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>✅ Download Ready</h3>
          {result.caption && (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              📝 {result.caption.substring(0, 150)}{result.caption.length > 150 ? '...' : ''}
            </p>
          )}
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="download-btn"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            ⬇️ Save to Device
          </a>
        </div>
      )}

      <div className="download-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>💡 How to use</h3>
        <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Copy an Instagram Reel, Post, or Carousel link</li>
          <li>Paste it in the input field above</li>
          <li>Tap "Download Now"</li>
          <li>Save the video to your device</li>
        </ul>
      </div>
    </div>
  )
}

export default DownloadPage
