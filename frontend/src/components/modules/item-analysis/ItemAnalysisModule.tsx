// ============================================================
// ScaleMind AI — Madde Analizi Modülü
// İtem istatistikleri + Korelasyon ısı haritası + AI yorum
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runItemAnalysis, getAIInterpretation } from '../../../lib/api'
import type { ItemAnalysisResult, AIComment } from '../../../types'

// ------ Korelasyon Isı Haritası ------
function CorrelationHeatmap({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const n = labels.length
  const maxShow = 20
  const show = Math.min(n, maxShow)
  const subLabels = labels.slice(0, show)
  const subMatrix = matrix.slice(0, show).map((row) => row.slice(0, show))

  function cellColor(val: number): string {
    const abs = Math.abs(val)
    if (val === 1) return '#0C447C'
    if (abs >= 0.70) return val > 0 ? '#185FA5' : '#A32D2D'
    if (abs >= 0.50) return val > 0 ? '#378ADD' : '#E24B4A'
    if (abs >= 0.30) return val > 0 ? '#85B7EB' : '#F09595'
    return '#D3D1C7'
  }
  function cellBg(val: number): string {
    const abs = Math.abs(val)
    if (val === 1) return '#E6F1FB'
    if (abs >= 0.70) return val > 0 ? '#E6F1FB' : '#FCEBEB'
    if (abs >= 0.50) return val > 0 ? '#F0F7FD' : '#FEF5F5'
    return 'transparent'
  }

  const cellSize = Math.max(28, Math.min(44, Math.floor(560 / show)))

  return (
    <div style={{ overflowX: 'auto' }}>
      {n > maxShow && (
        <div style={{ fontSize: 12, color: '#854F0B', marginBottom: 8 }}>
          ⚠ İlk {maxShow} madde gösteriliyor ({n} maddenin tamamı için tabloyu inceleyin)
        </div>
      )}
      <div style={{ display: 'inline-block' }}>
        <div style={{ display: 'flex', marginLeft: cellSize + 4 }}>
          {subLabels.map((l) => (
            <div key={l} style={{ width: cellSize, fontSize: 9, color: 'var(--color-text-secondary)', textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', height: 40, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              {l}
            </div>
          ))}
        </div>
        {subMatrix.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: cellSize, fontSize: 9, color: 'var(--color-text-secondary)', paddingRight: 4, textAlign: 'right', flexShrink: 0 }}>{subLabels[i]}</div>
            {row.map((val, j) => (
              <div key={j} title={`${subLabels[i]} × ${subLabels[j]}: ${val.toFixed(3)}`} style={{
                width: cellSize, height: cellSize,
                background: cellBg(val),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: cellSize > 36 ? 10 : 8,
                color: cellColor(val),
                fontWeight: Math.abs(val) >= 0.50 ? 500 : 400,
                border: '0.5px solid var(--color-border-tertiary)',
                cursor: 'default',
                flexShrink: 0,
              }}>
                {i === j ? '—' : val.toFixed(2)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8, display: 'flex', gap: 16 }}>
        <span style={{ color: '#185FA5' }}>■ r ≥ .70 güçlü</span>
        <span style={{ color: '#378ADD' }}>■ .50–.69 orta</span>
        <span style={{ color: '#85B7EB' }}>■ .30–.49 zayıf</span>
        <span style={{ color: '#D3D1C7' }}>■ &lt; .30 ihmal edilebilir</span>
      </div>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Madde Analizi Neden Yapılır?</h3>
    <p>Her maddenin ölçtüğü yapıyı ne kadar iyi temsil ettiğini değerlendirmek için yapılır. Zayıf maddeler ölçeğin güvenirliğini ve geçerliliğini düşürür.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Düzeltilmiş Madde-Toplam Korelasyonu</h3>
    <p>Bir maddenin kendisi hariç ölçek toplamıyla korelasyonunu gösterir. Bu değerin <strong>.30 veya üzerinde</strong> olması beklenir. .30 altındaki maddeler revize edilmeli veya çıkarılmalıdır.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Madde Silinirse Alpha</h3>
    <p>Bir madde çıkarıldığında ölçeğin Cronbach alpha değerinin ne olacağını gösterir. Bu değer mevcut alpha'dan belirgin biçimde yüksekse, o madde ölçeği zayıflatıyor olabilir.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Taban/Tavan Etkisi</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>Tavan etkisi:</strong> Katılımcıların büyük çoğunluğu en yüksek puanı veriyorsa madde ayrım gücü düşüktür</li>
      <li><strong>Taban etkisi:</strong> Büyük çoğunluk en düşük puanı veriyorsa aynı sorun geçerlidir</li>
      <li>Her iki durumda da madde ifadesi güçlendirilmelidir</li>
    </ul>
  </div>
)

// ------ Ana Bileşen ------
export default function ItemAnalysisModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<ItemAnalysisResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [activeTab2, setActiveTab2] = useState<'table' | 'heatmap'>('table')

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert').map((v) => v.name) ?? []
  const reversedItems = dataset?.variables.filter((v) => v.isReversed).map((v) => v.name) ?? []
  const isRunning = loading['item-analysis']

  const handleRun = async () => {
    if (likertItems.length < 2) return
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    setLoading('item-analysis', true)
    try {
      const data: Record<string, number[]> = {}
      for (const item of likertItems) {
        data[item] = (rawData[item] ?? []).filter((v) => v !== null && !isNaN(Number(v))).map(Number)
      }
      const res = await runItemAnalysis(data, likertItems, reversedItems) as { result: ItemAnalysisResult & { warnings?: string[]; n?: number } }
      const r = res.result
      setResult(r)
      setWarnings(r.recommendations ?? [])
      setStepResult('item-analysis', {
        type: 'item-analysis',
        data: r,
        warnings: r.recommendations ?? [],
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`Madde analizi başarısız: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('item-analysis', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'item-analysis',
        results: {
          weakItems: result.weakItems,
          redundantPairs: result.redundantPairs,
          nItems: result.items.length,
          baseAlpha: (result as ItemAnalysisResult & { baseAlpha?: number }).baseAlpha,
        },
        projectContext: { sampleSize: dataset?.rows ?? 0, language: useAppStore.getState().language },
      }) as { interpretation: string }
      const text = res.interpretation
      setAiComment({ summary: text.split('\n\n')[0] ?? text, findings: [], warnings: [], recommendations: [], resultsSection: text, language: useAppStore.getState().language, generatedAt: new Date().toISOString() })
    } catch { setWarnings((w) => [...w, 'AI yorumu alınamadı.']) }
    finally { setIsLoadingAI(false) }
  }

  return (
    <AnalysisPanel
      title="Madde Analizi"
      subtitle="Betimsel istatistikler · Madde-toplam korelasyonu · Korelasyon ısı haritası"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      <button
        onClick={handleRun}
        disabled={isRunning}
        style={{ padding: '10px 24px', background: isRunning ? '#888' : '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer', marginBottom: 20 }}
      >
        {isRunning ? 'Hesaplanıyor...' : 'Madde Analizini Başlat'}
      </button>

      {result && (
        <div>
          {/* Alt sekme */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 16 }}>
            {([['table', 'Madde Tablosu'], ['heatmap', 'Korelasyon Isı Haritası']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab2(id)} style={{
                padding: '7px 16px', border: 'none', background: 'transparent',
                borderBottom: activeTab2 === id ? '2px solid #185FA5' : '2px solid transparent',
                fontSize: 13, fontWeight: activeTab2 === id ? 500 : 400,
                color: activeTab2 === id ? '#185FA5' : 'var(--color-text-secondary)',
                cursor: 'pointer', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {activeTab2 === 'table' && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-background-secondary)' }}>
                      {['Madde', 'Ort.', 'SS', 'r(düz.)', 'α sil.', 'Taban', 'Tavan', 'Durum'].map((h) => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item, i) => {
                      const isWeak = result.weakItems.includes(item.name)
                      return (
                        <tr key={item.name} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 500, color: isWeak ? '#A32D2D' : 'var(--color-text-primary)' }}>{item.name}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-secondary)' }}>{item.mean.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-secondary)' }}>{item.sd.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', color: item.correctedItemTotalCorr < 0.30 ? '#A32D2D' : '#3B6D11', fontWeight: 500 }}>{item.correctedItemTotalCorr.toFixed(3)}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-secondary)' }}>{item.alphaIfDeleted?.toFixed(3) ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: item.floorEffect ? '#A32D2D' : 'var(--color-text-secondary)' }}>{item.floorEffect ? '⚠' : '—'}</td>
                          <td style={{ padding: '6px 10px', color: item.ceilingEffect ? '#A32D2D' : 'var(--color-text-secondary)' }}>{item.ceilingEffect ? '⚠' : '—'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            {isWeak ? (
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Zayıf</span>
                            ) : (
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11', fontWeight: 500 }}>İyi</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab2 === 'heatmap' && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <CorrelationHeatmap matrix={result.correlationMatrix} labels={result.items.map((i) => i.name)} />
            </div>
          )}

          <button
            onClick={() => setActiveStep('reliability')}
            style={{ padding: '10px 24px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Güvenirlik Analizine Geç →
          </button>
        </div>
      )}
    </AnalysisPanel>
  )
}
