import React, { useState } from 'react'
import { Download, Sparkles, Clipboard, CheckCircle2, AlertCircle, HelpCircle, Camera, ExternalLink } from 'lucide-react'

function DownloadPage({ settings }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)

  const handleDownload = async () => {
    if (!url.trim()) {
      setStatus({ type: 'error', message: 'Please enter an Instagram URL' })
      return
    }

    // Validate Instagram URL
    const instagramPattern = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|stories)\/[\w-]+/i
    if (!instagramPattern.test(url)) {
      setStatus({ type: 'error', message: 'Please enter a valid Instagram Reel, Post, or Carousel link' })
      return
    }

    setLoading(true)
    setProgress(0)
    setStatus({ type: 'info', message: 'Fetching video payload...' })
    setResult(null)

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 15
        })
      }, 400)

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
      setStatus({ type: 'success', message: 'Video payload resolved!' })
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
      console.error('Clipboard access denied:', err)
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="download-card main-hero-card">
        <div className="card-badge">
          <Camera size={16} /> Instagram Downloader
        </div>

        <div className="input-group">
          <label><Sparkles size={16} /> Enter Instagram Video URL</label>
          <div className="input-with-paste">
            <input
              type="url"
              className="url-input"
              placeholder="https://www.instagram.com/reel/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <button className="btn-paste" onClick={handlePaste} title="Paste from clipboard">
              <Clipboard size={16} /> Paste
            </button>
          </div>
        </div>

        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="spinner"></span>
          ) : (
            <>
              <Download size={20} /> Export Video Payload
            </>
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
            <p className="progress-text">{progress}% - Downloading payload...</p>
          </div>
        )}

        {status && (
          <div className={`status-message status-${status.type}`}>
            {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {status.message}
          </div>
        )}
      </div>

      {result && (
        <div className="download-card result-card">
          <h3 className="result-title"><CheckCircle2 size={20} className="success-icon" /> Video Export Ready</h3>
          {result.caption && (
            <p className="result-caption">
              📝 {result.caption.substring(0, 150)}{result.caption.length > 150 ? '...' : ''}
            </p>
          )}
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="download-btn btn-save"
          >
            <Download size={18} /> Save MP4 to Device <ExternalLink size={16} />
          </a>
        </div>
      )}

      <div className="download-card help-card">
        <h3><HelpCircle size={18} /> How to Download</h3>
        <ul>
          <li>Open Instagram and copy link to any Reel, Post, or Carousel</li>
          <li>Paste the link into the field above</li>
          <li>Tap "Export Video Payload" to download clean MP4 format</li>
        </ul>
      </div>
    </div>
  )
}

export default DownloadPage
