import React, { useState, useEffect } from 'react'
import DownloadPage from './components/DownloadPage'
import HistoryPage from './components/HistoryPage'
import SettingsPage from './components/SettingsPage'
import QueuePage from './components/QueuePage'
import WizardPage from './components/WizardPage'
import { Download, Wand2, History, Layers, Settings, Sparkles } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('download')
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({
    quality: 'hd',
    captionStyle: 'full',
    notifyMode: 'instant'
  })

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      
      // Get user data from Telegram
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        setUser(tg.initDataUnsafe.user)
      }
      
      // Apply Telegram theme
      document.body.style.backgroundColor = tg.themeParams?.bg_color || '#0b0f19'
    }
  }, [])

  const renderPage = () => {
    switch (activeTab) {
      case 'download':
        return <DownloadPage settings={settings} />
      case 'wizard':
        return <WizardPage settings={settings} setSettings={setSettings} />
      case 'history':
        return <HistoryPage />
      case 'queue':
        return <QueuePage settings={settings} />
      case 'settings':
        return <SettingsPage settings={settings} setSettings={setSettings} />
      default:
        return <DownloadPage settings={settings} />
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="app-banner-wrap">
          <img src="/banner.png" alt="Instagram Downloader Banner" className="app-banner-img" />
        </div>
        <h1 className="header-title"><Sparkles className="header-sparkle" size={24} /> SaveMyReels</h1>
        <p className="header-subtitle">SaaS Instagram Video Downloader</p>
      </header>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'download' ? 'active' : ''}`}
          onClick={() => setActiveTab('download')}
        >
          <Download size={16} /> Download
        </button>

        <button
          className={`nav-tab ${activeTab === 'wizard' ? 'active' : ''}`}
          onClick={() => setActiveTab('wizard')}
        >
          <Wand2 size={16} /> Wizard
        </button>

        <button
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> History
        </button>

        <button
          className={`nav-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Layers size={16} /> Queue
        </button>

        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} /> Settings
        </button>
      </nav>

      <main>{renderPage()}</main>
    </div>
  )
}

export default App
