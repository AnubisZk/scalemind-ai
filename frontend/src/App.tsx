import React from 'react'
import AppLayout from './components/layout/AppLayout'
import UploadModule from './components/modules/upload/UploadModule'
import PreprocessingModule from './components/modules/preprocessing/PreprocessingModule'
import NormalityModule from './components/modules/normality/NormalityModule'
import ItemAnalysisModule from './components/modules/item-analysis/ItemAnalysisModule'
import ReliabilityModule from './components/modules/reliability/ReliabilityModule'
import ContentValidityModule from './components/modules/content-validity/ContentValidityModule'
import EFAModule from './components/modules/efa/EFAModule'
import CFAModule from './components/modules/cfa/CFAModule'
import ReportingModule from './components/modules/reporting/ReportingModule'
import SEMModule from './components/modules/sem/SEMModule'
import { useAppStore, ANALYSIS_STEPS } from './store/useAppStore'
import type { AnalysisStepId, StepStatus } from './types'

function PlaceholderModule({ stepId }: { stepId: AnalysisStepId }) {
  const label = ANALYSIS_STEPS.find((s) => s.id === stepId)?.labelTr ?? stepId
  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 500 }}>{label}</h2>
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '40px 32px', textAlign: 'center', marginTop: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Bu modül geliştiriliyor</div>
        <div style={{ fontSize: 13, color: '#666' }}>{label} modülü yakında ekleniyor.</div>
      </div>
    </div>
  )
}

function WelcomeScreen() {
  const { setProject } = useAppStore()
  const handleNewProject = () => {
    setProject({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: 'Yeni Proje',
      steps: ANALYSIS_STEPS.map((s, i) => ({
        id: s.id, label: s.labelTr, labelTr: s.labelTr,
        status: (i === 0 ? 'active' : 'pending') as StepStatus,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  return (
    <div style={{ maxWidth: 640, margin: '48px auto', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'white', margin: '0 auto 24px' }}>S</div>
      <h1 style={{ fontSize: 26, fontWeight: 500, margin: '0 0 12px' }}>ScaleMind AI'ya Hoş Geldiniz</h1>
      <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, margin: '0 0 32px' }}>
        Psikometrik ölçek geliştirme ve analiz platformu.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { icon: '📊', title: 'Psikometrik Analiz', desc: 'KMO, EFA, CFA, SEM' },
          { icon: '🤖', title: 'AI Yorumlama', desc: 'Claude destekli akademik yorum' },
          { icon: '📄', title: 'Rapor Üretimi', desc: 'APA 7 uyumlu PDF/Word' },
        ].map((card) => (
          <div key={card.title} style={{ background: '#f5f5f5', borderRadius: 8, padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{card.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={handleNewProject} style={{ padding: '12px 32px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
        Yeni Proje Başlat
      </button>
    </div>
  )
}

function StepRouter({ stepId }: { stepId: AnalysisStepId }) {
  switch (stepId) {
    case 'upload':           return <UploadModule />
    case 'preprocessing':    return <PreprocessingModule />
    case 'normality':        return <NormalityModule />
    case 'item-analysis':    return <ItemAnalysisModule />
    case 'reliability':      return <ReliabilityModule />
    case 'content-validity': return <ContentValidityModule />
    case 'efa':              return <EFAModule />
    case 'cfa':              return <CFAModule />
    case 'sem':              return <SEMModule />
    case 'reporting':        return <ReportingModule />
    default:                 return <PlaceholderModule stepId={stepId} />
  }
}


function PasswordScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = React.useState('')
  const [error, setError] = React.useState(false)
  const handle = () => {
    if (pw === 'zskvlcm') { onUnlock() }
    else { setError(true); setTimeout(() => setError(false), 2000) }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', maxWidth: 380, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'white', margin: '0 auto 20px' }}>S</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', color: '#1a1a1a' }}>ScaleMind AI</h1>
        <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px' }}>Psikometrik Analiz Platformu</p>
        <input
          type="password"
          placeholder="Erişim şifresi"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${error ? '#e53e3e' : '#ddd'}`, fontSize: 14, marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
        />
        {error && <p style={{ color: '#e53e3e', fontSize: 13, margin: '0 0 12px' }}>Hatalı şifre</p>}
        <button onClick={handle} style={{ width: '100%', padding: '12px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Giriş
        </button>
        <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>ScaleMind AI · Psikometrik Ölçek Geliştirme</p>
      </div>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = React.useState(() => sessionStorage.getItem('sm_auth') === '1' || localStorage.getItem('sm_auth') === '1')
  if (!unlocked) return <PasswordScreen onUnlock={() => { sessionStorage.setItem('sm_auth', '1'); localStorage.setItem('sm_auth', '1'); setUnlocked(true) }} />
  const { project, activeStep } = useAppStore()
  if (!project) {
    return <div style={{ minHeight: '100vh', background: '#fafafa' }}><WelcomeScreen /></div>
  }
  return <AppLayout><StepRouter stepId={activeStep} /></AppLayout>
}
