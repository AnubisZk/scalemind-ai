// ============================================================
// ScaleMind AI — Güvenirlik Analizi Modülü
// Cronbach alpha + McDonald omega + Alt boyut güvenirliği
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runReliability, getAIInterpretation } from '../../../lib/api'
import type { ReliabilityResult, AIComment } from '../../../types'

// ------ Renk yardımcıları ------
function alphaColor(val: number): string {
  if (val >= 0.90) return '#3B6D11'
  if (val >= 0.80) return '#639922'
  if (val >= 0.70) return '#854F0B'
  if (val >= 0.60) return '#993C1D'
  return '#A32D2D'
}
function alphaLabel(val: number): string {
  if (val >= 0.90) return 'Mükemmel'
  if (val >= 0.80) return 'İyi'
  if (val >= 0.70) return 'Kabul edilebilir'
  if (val >= 0.60) return 'Zayıf'
  return 'Kabul edilemez'
}

// ------ Mini çubuk grafik ------
function ReliabilityBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>{label}</span>
          <span style={{ fontSize: 13, color: '#888' }}>—</span>
        </div>
      </div>
    )
  }
  const pct = Math.min(100, Math.max(0, value * 100))
  const color = alphaColor(value)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color }}>
          {isNaN(value) ? '—' : value.toFixed(3)} <span style={{ fontSize: 11, fontWeight: 400 }}>({alphaLabel(value)})</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Güvenirlik Nedir?</h3>
    <p>Güvenirlik, bir ölçeğin tutarlı ve tekrarlanabilir ölçüm yapıp yapmadığını gösterir. Aynı bireye aynı ölçek farklı zamanlarda uygulandığında benzer sonuçlar alınıyorsa ölçek güvenilirdir.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Cronbach Alpha (α)</h3>
    <p>En yaygın iç tutarlılık katsayısıdır. Likert tipi maddeler arasındaki ortalama kovaryansa dayalı olarak hesaplanır. Tek başına yeterli değildir; çünkü madde sayısına ve ölçeğin tek boyutluluğuna duyarlıdır.</p>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>α ≥ .90</strong> — Mükemmel</li>
      <li><strong>α ≥ .80</strong> — İyi</li>
      <li><strong>α ≥ .70</strong> — Kabul edilebilir</li>
      <li><strong>α &lt; .60</strong> — Yetersiz</li>
    </ul>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>McDonald Omega (ω)</h3>
    <p>Alpha'nın bir üst versiyonudur ve faktör analizine dayalıdır. Çok boyutlu ölçeklerde alpha'dan daha doğru bir güvenirlik tahmini sunar. Güncel yayınlarda her ikisinin birlikte raporlanması beklenmektedir.</p>

    <div style={{ background: '#E6F1FB', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #85B7EB' }}>
      <strong style={{ fontSize: 13, color: '#0C447C' }}>APA 7 Raporlama Örneği:</strong>
      <p style={{ fontSize: 13, color: '#185FA5', margin: '6px 0 0', fontStyle: 'italic' }}>
        "Ölçeğin iç tutarlılığı Cronbach's α = .87 ve McDonald's ω = .89 olarak hesaplanmıştır (95% GA [.84, .90])."
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function ReliabilityModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<ReliabilityResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert').map((v) => v.name) ?? []

  // Alt boyutları çıkar
  const subscaleMap: Record<string, string[]> = {}
  dataset?.variables
    .filter((v) => v.type === 'likert' && v.subscale)
    .forEach((v) => {
      const sub = v.subscale!
      if (!subscaleMap[sub]) subscaleMap[sub] = []
      subscaleMap[sub].push(v.name)
    })

  const handleRun = async () => {
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    if (likertItems.length < 2) return
    setLoading('reliability', true)
    try {
      const data: Record<string, number[]> = {}
      for (const item of likertItems) {
        data[item] = (rawData[item] ?? [])
          .filter((v) => v !== null && !isNaN(Number(v)))
          .map(Number)
      }
      const res = await runReliability(
        data,
        likertItems,
        Object.keys(subscaleMap).length > 0 ? subscaleMap : undefined
      ) as any

      const r = res.result ?? res
      console.log('RESULT:', JSON.stringify(r))
      setResult(r)
      setWarnings(r.warnings ?? [])
      setStepResult('reliability', {
        type: 'reliability',
        data: r,
        warnings: r.warnings ?? [],
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`Güvenirlik hesaplanamadı: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('reliability', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'reliability',
        results: result,
        projectContext: {
          sampleSize: dataset?.rows ?? 0,
          scale: dataset?.name,
          language: useAppStore.getState().language,
        },
      }) as { interpretation: string }

      // Yorumu yapılandırılmış AIComment tipine çevir
      const text = res.interpretation
      setAiComment({
        summary: text.split('\n\n')[0] ?? text,
        findings: [],
        warnings: [],
        recommendations: [],
        resultsSection: text,
        language: useAppStore.getState().language,
        generatedAt: new Date().toISOString(),
      })
    } catch {
      setWarnings((w) => [...w, 'AI yorumu alınamadı.'])
    } finally {
      setIsLoadingAI(false)
    }
  }

  const isRunning = loading['reliability']

  return (
    <AnalysisPanel
      title="Güvenirlik Analizi"
      subtitle="Cronbach α, McDonald ω, split-half ve alt boyut güvenirliği"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      {/* Başlatma Ekranı */}
      {!result && (
        <div>
          <div style={{
            background: 'var(--color-background-secondary)',
            borderRadius: 8, padding: 20, marginBottom: 20,
            border: '0.5px solid var(--color-border-tertiary)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>
              Analiz Edilecek Maddeler
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              {likertItems.length} Likert maddesi tespit edildi.
              {Object.keys(subscaleMap).length > 0 && ` ${Object.keys(subscaleMap).length} alt boyut tanımlanmış.`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {likertItems.map((item) => (
                <span key={item} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 4,
                  background: '#E6F1FB', color: '#185FA5',
                  border: '0.5px solid #85B7EB',
                }}>
                  {item}
                </span>
              ))}
            </div>
            {Object.keys(subscaleMap).length > 0 && (
              <div style={{ marginTop: 12 }}>
                {Object.entries(subscaleMap).map(([sub, items]) => (
                  <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#534AB7', minWidth: 40 }}>{sub}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{items.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {likertItems.length < 2 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FCEBEB', borderRadius: 8, border: '0.5px solid #F09595', fontSize: 13, color: '#501313' }}>
              Güvenirlik hesabı için en az 2 Likert maddesi gereklidir. Veri yükleme adımında değişken tiplerini kontrol edin.
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              padding: '10px 24px', background: isRunning ? '#888' : '#185FA5',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer',
            }}
          >
            {isRunning ? 'Hesaplanıyor...' : 'Güvenirliği Hesapla'}
          </button>
        </div>
      )}

      {/* Sonuçlar */}
      {result && (
        <div>
          {/* Güvenirlik Çubukları */}
          <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8, padding: 20, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 16 }}>
              Genel Ölçek Güvenirliği (n = {dataset?.rows})
            </div>
            <ReliabilityBar label="Cronbach's Alpha (α)" value={result.cronbachAlpha} />
            <ReliabilityBar label="McDonald's Omega Total (ω)" value={result.mcdonaldOmegaTotal} />
            {result.mcdonaldOmegaHierarchical !== undefined && (
              <ReliabilityBar label="McDonald's Omega Hierarchical (ωh)" value={result.mcdonaldOmegaHierarchical} />
            )}
            <ReliabilityBar label="Spearman-Brown" value={result.spearmanBrown} />

            {/* CI */}
            {result.cronbachAlphaCI && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                α 95% Güven Aralığı: [{result.cronbachAlphaCI[0].toFixed(3)}, {result.cronbachAlphaCI[1].toFixed(3)}]
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Maddeler arası ortalama korelasyon: r = {result.meanInterItemCorr?.toFixed(3)}
            </div>
          </div>

          {/* Madde Bazlı Alpha */}
          {result.cronbachAlpha !== undefined && (
            <div style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8, overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                Madde Silinirse Alpha
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-background-secondary)' }}>
                      {['Madde', 'α (silinirse)', 'Fark', 'Öneri'].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.cronbachAlpha ? {} : {}).map(() => null)}
                    {/* alphaIfDeleted is a map on reliability result */}
                    {Object.entries((result as ReliabilityResult & { alphaIfDeleted?: Record<string, number> }).alphaIfDeleted ?? {}).map(([item, val]) => {
                      const diff = val - result.cronbachAlpha
                      return (
                        <tr key={item} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{item}</td>
                          <td style={{ padding: '7px 12px', color: alphaColor(val), fontWeight: 500 }}>{val.toFixed(3)}</td>
                          <td style={{ padding: '7px 12px', color: diff > 0.01 ? '#A32D2D' : diff < -0.01 ? '#3B6D11' : 'var(--color-text-secondary)' }}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(3)}
                          </td>
                          <td style={{ padding: '7px 12px', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            {diff > 0.01 ? '⚠ Alpha yükseliyor — maddeyi gözden geçirin' : diff < -0.01 ? '✓ Madde katkı sağlıyor' : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alt Boyut Güvenirliği */}
          {result.subscales && result.subscales.length > 0 && (
            <div style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 8, padding: 20, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 16 }}>Alt Boyut Güvenirliği</div>
              {result.subscales.map((sub) => (
                <div key={sub.name} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#534AB7', marginBottom: 6 }}>
                    {sub.name} ({sub.n} madde)
                  </div>
                  <ReliabilityBar label="α" value={sub.alpha} />
                  <ReliabilityBar label="ω" value={sub.omega} />
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    Maddeler: {sub.items.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Devam */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button
              onClick={handleRun}
              style={{
                padding: '8px 18px', background: 'transparent', color: '#185FA5',
                border: '0.5px solid #185FA5', borderRadius: 8,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Yeniden Hesapla
            </button>
            <button
              onClick={() => setActiveStep('content-validity')}
              style={{
                padding: '8px 18px', background: '#185FA5', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Kapsam Geçerliliğine Geç →
            </button>
          </div>
        </div>
      )}
    </AnalysisPanel>
  )
}
