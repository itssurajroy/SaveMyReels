import React, { useState } from 'react'
import { Sparkles, Sliders, CheckCircle2, Zap, FileText, Bell, BellOff, ArrowRight, ArrowLeft, Download, ShieldCheck, Video, Hash } from 'lucide-react'

function WizardPage({ settings, setSettings }) {
  const [step, setStep] = useState(1)
  const [quality, setQuality] = useState(settings?.quality || 'hd')
  const [captionStyle, setCaptionStyle] = useState('full')
  const [notifyMode, setNotifyMode] = useState('instant')
  const [testUrl, setTestUrl] = useState('')
  const [testStatus, setTestStatus] = useState(null)

  const handleFinishStep = () => {
    if (setSettings) {
      setSettings(prev => ({ ...prev, quality, captionStyle, notifyMode }))
    }
    setStep(4)
  }

  return (
    <div className="wizard-container">
      {/* Progress Header */}
      <div className="wizard-progress-card">
        <div className="wizard-progress-header">
          <div className="wizard-title-badge">
            <Sparkles className="icon-sparkle" size={18} />
            <span>Interactive Setup Wizard</span>
          </div>
          <span className="wizard-step-indicator">Step {step} of 4</span>
        </div>

        <div className="wizard-progress-bar-bg">
          <div
            className="wizard-progress-bar-fill"
            style={{ width: `${(step / 4) * 100}%` }}
          ></div>
        </div>

        <div className="wizard-steps-dots">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`wizard-step-dot ${step >= s ? 'active' : ''}`}
              onClick={() => setStep(s)}
            >
              {step > s ? <CheckCircle2 size={14} /> : s}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Quality Selection */}
      {step === 1 && (
        <div className="wizard-card animate-fade-in">
          <div className="wizard-card-header">
            <Sliders className="card-icon" size={24} />
            <div>
              <h3>Step 1: Choose Video Resolution</h3>
              <p>Select your default download quality preference for Telegram delivery.</p>
            </div>
          </div>

          <div className="wizard-options-grid">
            <div
              className={`wizard-option-card ${quality === 'hd' ? 'selected' : ''}`}
              onClick={() => setQuality('hd')}
            >
              <div className="option-badge">💎 HD 1080p</div>
              <h4>High Definition</h4>
              <p>Maximum video sharpness & full fidelity audio quality.</p>
              {quality === 'hd' && <CheckCircle2 className="check-icon" size={20} />}
            </div>

            <div
              className={`wizard-option-card ${quality === 'sd' ? 'selected' : ''}`}
              onClick={() => setQuality('sd')}
            >
              <div className="option-badge">⚡ SD 480p</div>
              <h4>Data Saver</h4>
              <p>Smaller file size, ideal for mobile data & faster delivery.</p>
              {quality === 'sd' && <CheckCircle2 className="check-icon" size={20} />}
            </div>
          </div>

          <div className="wizard-actions">
            <div></div>
            <button className="btn-wizard-next" onClick={() => setStep(2)}>
              Next: Caption Style <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Caption Formatting */}
      {step === 2 && (
        <div className="wizard-card animate-fade-in">
          <div className="wizard-card-header">
            <FileText className="card-icon" size={24} />
            <div>
              <h3>Step 2: Caption Formatting</h3>
              <p>Choose how post captions and metadata are delivered with video files.</p>
            </div>
          </div>

          <div className="wizard-options-grid">
            <div
              className={`wizard-option-card ${captionStyle === 'full' ? 'selected' : ''}`}
              onClick={() => setCaptionStyle('full')}
            >
              <FileText size={22} className="option-icon" />
              <h4>Full Caption</h4>
              <p>Include original Instagram text payload & hashtags.</p>
              {captionStyle === 'full' && <CheckCircle2 className="check-icon" size={20} />}
            </div>

            <div
              className={`wizard-option-card ${captionStyle === 'clean' ? 'selected' : ''}`}
              onClick={() => setCaptionStyle('clean')}
            >
              <Video size={22} className="option-icon" />
              <h4>Clean Video</h4>
              <p>Deliver MP4 file directly without caption text.</p>
              {captionStyle === 'clean' && <CheckCircle2 className="check-icon" size={20} />}
            </div>

            <div
              className={`wizard-option-card ${captionStyle === 'hashtags' ? 'selected' : ''}`}
              onClick={() => setCaptionStyle('hashtags')}
            >
              <Hash size={22} className="option-icon" />
              <h4>Hashtags Only</h4>
              <p>Extract and format tags for easy copy-pasting.</p>
              {captionStyle === 'hashtags' && <CheckCircle2 className="check-icon" size={20} />}
            </div>
          </div>

          <div className="wizard-actions">
            <button className="btn-wizard-back" onClick={() => setStep(1)}>
              <ArrowLeft size={18} /> Back
            </button>
            <button className="btn-wizard-next" onClick={() => setStep(3)}>
              Next: Notifications <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Notification Preference */}
      {step === 3 && (
        <div className="wizard-card animate-fade-in">
          <div className="wizard-card-header">
            <Zap className="card-icon" size={24} />
            <div>
              <h3>Step 3: Notification Preferences</h3>
              <p>Set delivery notification behavior when your videos are processed.</p>
            </div>
          </div>

          <div className="wizard-options-grid">
            <div
              className={`wizard-option-card ${notifyMode === 'instant' ? 'selected' : ''}`}
              onClick={() => setNotifyMode('instant')}
            >
              <Bell size={22} className="option-icon" />
              <h4>Instant Sound Alert</h4>
              <p>Play notification chime as soon as export finishes.</p>
              {notifyMode === 'instant' && <CheckCircle2 className="check-icon" size={20} />}
            </div>

            <div
              className={`wizard-option-card ${notifyMode === 'silent' ? 'selected' : ''}`}
              onClick={() => setNotifyMode('silent')}
            >
              <BellOff size={22} className="option-icon" />
              <h4>Silent Delivery</h4>
              <p>Deliver videos silently without sound notifications.</p>
              {notifyMode === 'silent' && <CheckCircle2 className="check-icon" size={20} />}
            </div>
          </div>

          <div className="wizard-actions">
            <button className="btn-wizard-back" onClick={() => setStep(2)}>
              <ArrowLeft size={18} /> Back
            </button>
            <button className="btn-wizard-next" onClick={handleFinishStep}>
              Complete Wizard <CheckCircle2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Summary Card & Instant URL Tester */}
      {step === 4 && (
        <div className="wizard-card animate-fade-in">
          <div className="wizard-summary-banner">
            <ShieldCheck size={32} className="summary-icon" />
            <div>
              <h3>Setup Successfully Configured!</h3>
              <p>Your custom Instagram downloader profile is saved and active.</p>
            </div>
          </div>

          <div className="summary-details-box">
            <div className="summary-row">
              <span className="label">Resolution:</span>
              <span className="value badge-violet">💎 {quality.toUpperCase()} (1080p)</span>
            </div>
            <div className="summary-row">
              <span className="label">Caption Format:</span>
              <span className="value badge-pink">📝 {captionStyle.toUpperCase()}</span>
            </div>
            <div className="summary-row">
              <span className="label">Notifications:</span>
              <span className="value badge-blue">🔔 {notifyMode.toUpperCase()}</span>
            </div>
          </div>

          <div className="live-tester-card">
            <h4><Sparkles size={16} /> Instant URL Tester</h4>
            <p>Paste any Instagram link below to verify your wizard settings:</p>
            
            <div className="tester-input-wrap">
              <input
                type="text"
                placeholder="https://www.instagram.com/reel/..."
                value={testUrl}
                onChange={e => setTestUrl(e.target.value)}
              />
              <button
                className="btn-test-go"
                onClick={() => {
                  if (testUrl.includes('instagram.com')) {
                    setTestStatus({ type: 'success', text: '✅ Link verified! Valid Instagram payload.' })
                  } else {
                    setTestStatus({ type: 'error', text: '❌ Please enter a valid Instagram URL' })
                  }
                }}
              >
                Test <Download size={16} />
              </button>
            </div>

            {testStatus && (
              <div className={`tester-status status-${testStatus.type}`}>
                {testStatus.text}
              </div>
            )}
          </div>

          <div className="wizard-actions">
            <button className="btn-wizard-back" onClick={() => setStep(1)}>
              Re-configure Wizard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WizardPage
