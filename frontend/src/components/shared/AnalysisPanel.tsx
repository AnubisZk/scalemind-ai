// ============================================================
// ScaleMind AI — Analiz Ekranı Ortak Sarmalayıcı
// Her analiz ekranında: Sonuçlar | Açıklama | AI Yorum
// ============================================================
import React, { useState } from 'react'
import type { AIComment } from '../../types'

interface AnalysisPanelProps {
  title: string
  subtitle?: string
  warnings?: string[]
  children: React.ReactNode              // Sonuçlar sekmesi
  educationContent: React.ReactNode      // Açıklama sekmesi
  aiComment?: AIComment | null
  isLoadingAI?: boolean
  onRequestAI?: () => void
}

type Tab = 'results' | 'education' | 'ai'

export default function AnalysisPanel({
  title,
  subtitle,
  warnings = [],
  children,
  educationContent,
  aiComment,
  isLoadingAI,
  onRequestAI,
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('results')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'results',   label: 'Sonuçlar' },
    { id: 'education', label: 'Açıklama' },
    { id: 'ai',        label: 'AI Yorum' },
  ]

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Başlık */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>{subtitle}</p>}
      </div>

      {/* Uyarılar */}
      {warnings.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: '#FAEEDA',
          border: '0.5px solid #EF9F27',
          borderRadius: 8,
        }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 13, color: '#633806', display: 'flex', gap: 8, marginBottom: i < warnings.length - 1 ? 6 : 0 }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sekme Başlıkları */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        marginBottom: 20,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #185FA5' : '2px solid transparent',
              background: 'transparent',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 500 : 400,
              color: activeTab === tab.id ? '#185FA5' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.label}
            {tab.id === 'ai' && aiComment && (
              <span style={{
                marginLeft: 6, padding: '1px 6px', borderRadius: 10,
                background: '#EAF3DE', color: '#3B6D11', fontSize: 10,
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Sekme İçerikleri */}
      {activeTab === 'results' && (
        <div>{children}</div>
      )}

      {activeTab === 'education' && (
        <div style={{
          background: 'var(--color-background-secondary)',
          borderRadius: 8,
          padding: 20,
          border: '0.5px solid var(--color-border-tertiary)',
        }}>
          {educationContent}
        </div>
      )}

      {activeTab === 'ai' && (
        <div>
          {!aiComment && !isLoadingAI && onRequestAI && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Analiz sonuçlarınız üzerinde AI destekli akademik yorum alın.
              </p>
              <button
                onClick={onRequestAI}
                style={{
                  padding: '10px 24px',
                  background: '#185FA5',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                AI Yorum Oluştur ↗
              </button>
            </div>
          )}

          {isLoadingAI && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                Yorum oluşturuluyor...
              </div>
            </div>
          )}

          {aiComment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Özet */}
              <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Genel Değerlendirme</div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{aiComment.summary}</p>
              </div>

              {/* Bulgular */}
              {aiComment.findings.length > 0 && (
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: 16, border: '0.5px solid #C0DD97' }}>
                  <div style={{ fontSize: 12, color: '#27500A', marginBottom: 8, fontWeight: 500 }}>Temel Bulgular</div>
                  {aiComment.findings.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#27500A' }}>
                      <span>•</span><span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Uyarılar */}
              {aiComment.warnings.length > 0 && (
                <div style={{ background: '#FAEEDA', borderRadius: 8, padding: 16, border: '0.5px solid #EF9F27' }}>
                  <div style={{ fontSize: 12, color: '#633806', marginBottom: 8, fontWeight: 500 }}>Dikkat Edilmesi Gerekenler</div>
                  {aiComment.warnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#633806' }}>
                      <span>⚠</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Öneriler */}
              {aiComment.recommendations.length > 0 && (
                <div style={{ background: '#E6F1FB', borderRadius: 8, padding: 16, border: '0.5px solid #85B7EB' }}>
                  <div style={{ fontSize: 12, color: '#0C447C', marginBottom: 8, fontWeight: 500 }}>Önerilen Sonraki Adımlar</div>
                  {aiComment.recommendations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#0C447C' }}>
                      <span>{i + 1}.</span><span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Yöntem / Bulgular bölümü */}
              {(aiComment.methodSection || aiComment.resultsSection) && (
                <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, fontWeight: 500 }}>Makale / Tez Taslağı (APA 7)</div>
                  {aiComment.methodSection && (
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>{aiComment.methodSection}</p>
                  )}
                  {aiComment.resultsSection && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>{aiComment.resultsSection}</p>
                  )}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                {new Date(aiComment.generatedAt).toLocaleString('tr-TR')} tarihinde oluşturuldu
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
