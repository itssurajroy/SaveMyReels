import React from 'react'
import { Settings, Sliders, Info, ExternalLink, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react'

function SettingsPage({ settings, setSettings }) {
  const handleQualityChange = (quality) => {
    setSettings(prev => ({ ...prev, quality }))
    localStorage.setItem('saveMyReelsSettings', JSON.stringify({ ...settings, quality }))
    
    const tg = window.Telegram?.WebApp
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success')
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="settings-section">
        <h3 className="settings-title"><Sliders size={18} /> Resolution Preference</h3>
        <div className="quality-toggle">
          <button
            className={`quality-btn ${settings.quality === 'hd' ? 'active' : ''}`}
            onClick={() => handleQualityChange('hd')}
          >
            💎 HD (1080p Best Quality)
          </button>
          <button
            className={`quality-btn ${settings.quality === 'sd' ? 'active' : ''}`}
            onClick={() => handleQualityChange('sd')}
          >
            ⚡ SD (480p Data Saver)
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><Info size={18} /> Application Details</h3>
        <div className="setting-item">
          <span className="setting-label">Version</span>
          <span className="setting-value badge-purple">v2.1.0 SaaS</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Supported Engine</span>
          <span className="setting-value">📸 Instagram Reels, Posts, Carousels</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Icon Suite</span>
          <span className="setting-value">Lucide React v0.400+</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><ExternalLink size={18} /> Official Links</h3>
        <div className="setting-item">
          <span className="setting-label">Telegram Bot</span>
          <a
            href="https://t.me/savemyreeelsbot"
            target="_blank"
            rel="noopener noreferrer"
            className="setting-value link-blue"
          >
            @savemyreeelsbot <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><ShieldCheck size={18} /> Security & Quota</h3>
        <div className="setting-item">
          <span className="setting-label">Account Tier</span>
          <span className="setting-value badge-green">Free Tier (5/day)</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">SSL Connection</span>
          <span className="setting-value text-green">Encrypted</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
