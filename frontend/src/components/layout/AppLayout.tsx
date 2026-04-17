// ============================================================
// ScaleMind AI — Ana Layout (Sidebar + İçerik)
// ============================================================
import React from 'react'
import { useAppStore, ANALYSIS_STEPS } from '../../store/useAppStore'
import type { AnalysisStepId } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  completed: '#639922',
  active:    '#185FA5',
  error:     '#A32D2D',
  skipped:   '#888780',
  pending:   '#B4B2A9',
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  active:    '●',
  error:     '✕',
  skipped:   '–',
  pending:   '○',
}

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { project, activeStep, sidebarOpen, expertMode, language, toggleSidebar, toggleExpertMode, setActiveStep, setLanguage } = useAppStore()

  const steps = project?.steps ?? []

  const canNavigateTo = (stepId: AnalysisStepId): boolean => {
    const idx = ANALYSIS_STEPS.findIndex((s) => s.id === stepId)
    if (idx === 0) return true
    // Önceki adım tamamlandıysa veya atlandıysa geçilebilir
    const prev = steps[idx - 1]
    return true
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--color-background-tertiary)' }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <aside style={{
          width: 240,
          minWidth: 240,
          background: 'var(--color-background-primary)',
          borderRight: '0.5px solid var(--color-border-tertiary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#185FA5', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'white', fontWeight: 500,
              }}>S</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>ScaleMind AI</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Psikometrik Analiz</div>
              </div>
            </div>
          </div>

          {/* Proje adı */}
          {project && (
            <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Aktif Proje</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
              {project.dataset && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {project.dataset.rows} katılımcı · {project.dataset.cols} değişken
                </div>
              )}
            </div>
          )}

          {/* Adım Listesi */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {ANALYSIS_STEPS.map((stepDef, idx) => {
              const step = steps.find((s) => s.id === stepDef.id)
              const status = step?.status ?? 'pending'
              const isActive = activeStep === stepDef.id
              const canNav = canNavigateTo(stepDef.id)

              return (
                <button
                  key={stepDef.id}
                  onClick={() => canNav && setActiveStep(stepDef.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 20px',
                    border: 'none',
                    background: isActive ? 'var(--color-background-secondary)' : 'transparent',
                    cursor: canNav ? 'pointer' : 'default',
                    opacity: canNav ? 1 : 0.45,
                    textAlign: 'left',
                    borderLeft: isActive ? '2px solid #185FA5' : '2px solid transparent',
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: isActive ? '#E6F1FB' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 500,
                    color: STATUS_COLORS[status],
                    border: `1.5px solid ${STATUS_COLORS[status]}`,
                    flexShrink: 0,
                  }}>
                    {STATUS_ICONS[status]}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: isActive ? 500 : 400,
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {idx + 1}. {stepDef.labelTr}
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Alt Kontroller */}
          <div style={{ padding: 16, borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={toggleExpertMode}
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 6,
                border: '0.5px solid var(--color-border-secondary)',
                background: expertMode ? '#E6F1FB' : 'transparent',
                color: expertMode ? '#185FA5' : 'var(--color-text-secondary)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {expertMode ? '● Uzman Görünüm' : '○ Uzman Görünüm'}
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['tr', 'en'] as const).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)} style={{
                  flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 4,
                  border: '0.5px solid var(--color-border-secondary)',
                  background: language === lang ? 'var(--color-background-secondary)' : 'transparent',
                  color: language === lang ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer', fontWeight: language === lang ? 500 : 400,
                }}>
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Ana İçerik */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Üst Bar */}
        <header style={{
          height: 48,
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={toggleSidebar}
            style={{
              width: 28, height: 28, border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6, background: 'transparent', cursor: 'pointer',
              fontSize: 14, color: 'var(--color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >☰</button>

            {/* Çıkış */}
            <button
              onClick={() => { sessionStorage.clear(); localStorage.clear(); window.location.reload() }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, border: '1px solid #e0e0e0', background: 'white', fontSize: 11, color: '#666', cursor: 'pointer' }}
            >
              ⏏ Çıkış
            </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {ANALYSIS_STEPS.find((s) => s.id === activeStep)?.labelTr ?? ''}
          </span>
          {project?.dataset && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
              — {project.dataset.name}
            </span>
          )}
        </header>

        {/* Sayfa İçeriği */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
