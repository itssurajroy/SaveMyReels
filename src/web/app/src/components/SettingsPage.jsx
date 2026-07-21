import React from 'react'

function SettingsPage({ settings, setSettings }) {
  const handleQualityChange = (quality) => {
    setSettings(prev => ({ ...prev, quality }))
    
    // Save to localStorage
    localStorage.setItem('saveMyReelsSettings', JSON.stringify({ ...settings, quality }))
    
    // Notify Telegram WebApp
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.HapticFeedback.notificationOccurred('success')
    }
  }

  return (
    <div>
      <div className="settings-section">
        <h3 className="settings-title">🎥 Download Quality</h3>
        <div className="quality-toggle">
          <button
            className={`quality-btn ${settings.quality === 'hd' ? 'active' : ''}`}
            onClick={() => handleQualityChange('hd')}
          >
            HD (Best Quality)
          </button>
          <button
            className={`quality-btn ${settings.quality === 'sd' ? 'active' : ''}`}
            onClick={() => handleQualityChange('sd')}
          >
            SD (Smaller Files)
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">ℹ️ About</h3>
        <div className="setting-item">
          <span className="setting-label">Version</span>
          <span className="setting-value">2.0.0</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Supported Platforms</span>
          <span className="setting-value">📸 Instagram</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Features</span>
          <span className="setting-value">Reels, Posts, Carousels</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">🔗 Links</h3>
        <div className="setting-item">
          <span className="setting-label">Telegram Bot</span>
          <a
            href="https://t.me/SaveMyReelsBot"
            target="_blank"
            rel="noopener noreferrer"
            className="setting-value"
            style={{ color: 'var(--telegram-blue)', textDecoration: 'none' }}
          >
            Open Bot →
          </a>
        </div>
        <div className="setting-item">
          <span className="setting-label">Support</span>
          <a
            href="https://t.me/SaveMyReelsSupport"
            target="_blank"
            rel="noopener noreferrer"
            className="setting-value"
            style={{ color: 'var(--telegram-blue)', textDecoration: 'none' }}
          >
            Get Help →
          </a>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">📊 Your Stats</h3>
        <div className="setting-item">
          <span className="setting-label">Today's Downloads</span>
          <span className="setting-value">--</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Account Type</span>
          <span className="setting-value">Free Tier</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
