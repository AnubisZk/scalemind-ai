// ============================================================
// ScaleMind AI — Kapsam Geçerliliği Modülü
// Uzman puanları girişi + I-CVI + S-CVI/Ave + S-CVI/UA
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runContentValidity, getAIInterpretation } from '../../../lib/api'
import type { ContentValidityResult, AIComment } from '../../../types'

// ------ CVI Göstergesi ------
function CVIBadge({ value, threshold }: { value: number; threshold: number }) {
  const ok = value >= threshold
  return (
    <span style={{
      fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
      background: ok ? '#EAF3DE' : '#FCEBEB',
      color: ok ? '#3B6D11' : '#A32D2D',
    }}>
      {value.toFixed(3)} {ok ? '✓' : '✕'}
    </span>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Kapsam Geçerliliği Nedir?</h3>
    <p>Kapsam geçerliliği, bir ölçekteki maddelerin ölçülmek istenen yapıyı ne ölçüde temsil ettiğini değerlendirir. Bu değerlendirme uzman görüşlerine dayanır.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>I-CVI (Madde Kapsam Geçerlik İndeksi)</h3>
    <p>Her maddeyi "uygun" (3-4) veya "uygun değil" (1-2) olarak değerlendiren uzmanların oranıdır.</p>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>≥ .78</strong> (3+ uzman) — kabul edilebilir</li>
      <li><strong>1.00</strong> (1-2 uzman) — zorunlu</li>
    </ul>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>S-CVI (Ölçek Kapsam Geçerlik İndeksi)</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>S-CVI/Ave ≥ .90</strong> — tüm I-CVI değerlerinin ortalaması</li>
      <li><strong>S-CVI/UA ≥ .80</strong> — tüm uzmanların uygun bulduğu madde oranı</li>
    </ul>

    <div style={{ background: '#E6F1FB', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #85B7EB' }}>
      <strong style={{ fontSize: 13, color: '#0C447C' }}>APA Raporlama Örneği:</strong>
      <p style={{ fontSize: 13, color: '#185FA5', margin: '6px 0 0', fontStyle: 'italic' }}>
        "Kapsam geçerliliği 7 uzman tarafından değerlendirilmiş; S-CVI/Ave = .94 ve S-CVI/UA = .86 olarak hesaplanmıştır."
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function ContentValidityModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<ContentValidityResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  // Uzman giriş formu
  const [expertCount, setExpertCount] = useState(7)
  const [scale, setScale] = useState<1 | 2>(2)
  const [itemCount, setItemCount] = useState(10)
  const [itemNames, setItemNames] = useState<string[]>([])
  const [ratings, setRatings] = useState<Record<string, number[]>>({})
  const [step, setStep] = useState<'setup' | 'input' | 'result'>('setup')

  const likertItems = project?.dataset?.variables
    .filter((v) => v.type === 'likert')
    .map((v) => v.name) ?? []

  const handleSetup = () => {
    const names = likertItems.length > 0
      ? likertItems.slice(0, itemCount)
      : Array.from({ length: itemCount }, (_, i) => `Madde ${i + 1}`)
    setItemNames(names)
    const initRatings: Record<string, number[]> = {}
    names.forEach((n) => { initRatings[n] = Array(expertCount).fill(scale === 1 ? 1 : 4) })
    setRatings(initRatings)
    setStep('input')
  }

  const updateRating = (item: string, expertIdx: number, val: number) => {
    setRatings((prev) => {
      const updated = { ...prev }
      updated[item] = [...(prev[item] ?? [])]
      updated[item][expertIdx] = val
      return updated
    })
  }

  const handleRun = async () => {
    setLoading('content-validity', true)
    try {
      const res = await runContentValidity({ expertCount, ratings, scale }) as { result: ContentValidityResult & { warnings?: string[] } }
      const r = res.result
      setResult(r)
      setWarnings(r.recommendations ?? [])
      setStepResult('content-validity', {
        type: 'content-validity',
        data: r,
        warnings: r.recommendations ?? [],
        timestamp: new Date().toISOString(),
      })
      setStep('result')
    } catch (err) {
      setWarnings([`Hesaplama hatası: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('content-validity', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'content-validity',
        results: result,
        projectContext: { sampleSize: expertCount, language: useAppStore.getState().language },
      }) as { interpretation: string }
      const text = res.interpretation
      setAiComment({ summary: text.split('\n\n')[0] ?? text, findings: [], warnings: [], recommendations: [], resultsSection: text, language: useAppStore.getState().language, generatedAt: new Date().toISOString() })
    } catch { setWarnings((w) => [...w, 'AI yorumu alınamadı.']) }
    finally { setIsLoadingAI(false) }
  }

  const isRunning = loading['content-validity']

  return (
    <AnalysisPanel
      title="Kapsam Geçerliliği"
      subtitle="I-CVI · S-CVI/Ave · S-CVI/UA · Uzman puanları analizi"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      {/* Kurulum */}
      {step === 'setup' && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 20, marginBottom: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 16 }}>Uzman Değerlendirme Ayarları</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Uzman Sayısı</label>
              <input type="number" min={2} max={20} value={expertCount}
                onChange={(e) => setExpertCount(Number(e.target.value))}
                style={{ width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                {expertCount <= 2 ? 'I-CVI eşiği: 1.00' : expertCount <= 5 ? 'I-CVI eşiği: 0.80' : 'I-CVI eşiği: 0.78'}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Değerlendirme Ölçeği</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { id: 2, label: '4\'lü Likert', desc: '1=Uygun değil, 4=Çok uygun' },
                  { id: 1, label: 'İkili', desc: '0=Uygun değil, 1=Uygun' },
                ] as const).map((s) => (
                  <button key={s.id} onClick={() => setScale(s.id)} style={{
                    flex: 1, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    border: scale === s.id ? '2px solid #185FA5' : '0.5px solid var(--color-border-secondary)',
                    background: scale === s.id ? '#E6F1FB' : 'var(--color-background-secondary)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: scale === s.id ? '#185FA5' : 'var(--color-text-primary)' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                Madde Sayısı {likertItems.length > 0 && `(ölçekte ${likertItems.length} madde var)`}
              </label>
              <input type="number" min={1} max={likertItems.length || 50} value={itemCount}
                onChange={(e) => setItemCount(Number(e.target.value))}
                style={{ width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>

          <button onClick={handleSetup} style={{ padding: '10px 24px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Uzman Puanlarını Gir →
          </button>
        </div>
      )}

      {/* Puan Girişi */}
      {step === 'input' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Her madde için {expertCount} uzmanın puanını girin ({scale === 1 ? '0=Uygun değil, 1=Uygun' : '1=Hiç uygun değil, 2=Uygun değil, 3=Uygun, 4=Çok uygun'})
          </div>

          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', minWidth: 100 }}>Madde</th>
                    {Array.from({ length: expertCount }, (_, i) => (
                      <th key={i} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', minWidth: 60 }}>
                        U{i + 1}
                      </th>
                    ))}
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>I-CVI</th>
                  </tr>
                </thead>
                <tbody>
                  {itemNames.map((item, rowIdx) => {
                    const itemRatings = ratings[item] ?? []
                    const relevant = scale === 1
                      ? itemRatings.filter((v) => v === 1).length
                      : itemRatings.filter((v) => v >= 3).length
                    const icvi = expertCount > 0 ? relevant / expertCount : 0
                    return (
                      <tr key={item} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: rowIdx % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 12 }}>{item}</td>
                        {Array.from({ length: expertCount }, (_, ei) => (
                          <td key={ei} style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min={scale === 1 ? 0 : 1}
                              max={scale === 1 ? 1 : 4}
                              value={itemRatings[ei] ?? (scale === 1 ? 1 : 4)}
                              onChange={(e) => updateRating(item, ei, Number(e.target.value))}
                              style={{ width: 40, textAlign: 'center', fontSize: 12, padding: '3px', borderRadius: 4, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <CVIBadge value={icvi} threshold={expertCount <= 2 ? 1.0 : expertCount <= 5 ? 0.80 : 0.78} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('setup')} style={{ padding: '8px 18px', background: 'transparent', color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              ← Geri
            </button>
            <button onClick={handleRun} disabled={isRunning} style={{ padding: '10px 24px', background: isRunning ? '#888' : '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer' }}>
              {isRunning ? 'Hesaplanıyor...' : 'CVI Hesapla'}
            </button>
          </div>
        </div>
      )}

      {/* Sonuçlar */}
      {step === 'result' && result && (
        <div>
          {/* Özet */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'S-CVI/Ave', value: result.scviAve.toFixed(3), ok: result.scviAve >= 0.90, threshold: '≥ .90' },
              { label: 'S-CVI/UA', value: result.scviUa.toFixed(3), ok: result.scviUa >= 0.80, threshold: '≥ .80' },
              { label: 'Yeterli Madde', value: `${result.nAdequateItems}/${result.nTotalItems}`, ok: result.nAdequateItems === result.nTotalItems, threshold: '' },
            ].map((c) => (
              <div key={c.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px 16px', border: `0.5px solid ${c.ok ? 'var(--color-border-tertiary)' : '#F09595'}` }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{c.label} {c.threshold && <span style={{ color: '#888' }}>{c.threshold}</span>}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: c.ok ? '#3B6D11' : '#A32D2D' }}>{c.value}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: c.ok ? '#3B6D11' : '#A32D2D' }}>{c.ok ? '✓ Yeterli' : '✕ Yetersiz'}</div>
              </div>
            ))}
          </div>

          {/* I-CVI Tablosu */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Madde Bazlı I-CVI (Eşik: {result.threshold})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-background-secondary)' }}>
                  {['Madde', 'Uygun Uzman', 'Toplam Uzman', 'I-CVI', 'Durum'].map((h) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.icvi.map((row, i) => (
                  <tr key={row.item} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{row.item}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)' }}>{row.relevantExperts}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)' }}>{row.totalExperts}</td>
                    <td style={{ padding: '6px 12px' }}><CVIBadge value={row.value} threshold={result.threshold} /></td>
                    <td style={{ padding: '6px 12px' }}>
                      {row.adequate
                        ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11', fontWeight: 500 }}>Yeterli</span>
                        : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Yetersiz</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('input')} style={{ padding: '8px 18px', background: 'transparent', color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Puanları Düzenle
            </button>
            <button onClick={() => setActiveStep('efa')} style={{ padding: '10px 24px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              AFA'ya Geç →
            </button>
          </div>
        </div>
      )}
    </AnalysisPanel>
  )
}
