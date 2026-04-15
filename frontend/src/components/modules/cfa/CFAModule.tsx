// ============================================================
// ScaleMind AI — DFA (CFA) Modülü
// lavaan tabanlı: Model kurma, uyum indeksleri, AVE, CR
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runCFA, getAIInterpretation } from '../../../lib/api'
import type { CFAResult, AIComment } from '../../../types'

// ------ Uyum İndeksi Kartı ------
function FitCard({ label, value, threshold, good, direction = 'above' }: {
  label: string; value: number | null; threshold: string
  good: boolean; direction?: 'above' | 'below'
}) {
  const fmt = value === null ? '—' : value < 0.001 ? '< .001' : value.toFixed(3)
  return (
    <div style={{
      background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px',
      border: `0.5px solid ${good ? 'var(--color-border-tertiary)' : '#F09595'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        {label} <span style={{ color: '#aaa' }}>{threshold}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 500, color: good ? '#3B6D11' : '#A32D2D' }}>{fmt}</div>
      <div style={{ fontSize: 11, marginTop: 2, color: good ? '#3B6D11' : '#A32D2D' }}>
        {good ? '✓ Yeterli' : '✕ Yetersiz'}
      </div>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>DFA (CFA) Nedir?</h3>
    <p>Doğrulayıcı Faktör Analizi, teorik olarak belirlenen bir faktör yapısının verilerle ne ölçüde uyuştuğunu test eder. AFA'dan farklı olarak hangi maddenin hangi faktöre ait olduğu önceden belirlenir.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Uyum İndeksleri</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>CFI ≥ .90</strong> — kabul edilebilir, ≥ .95 iyi</li>
      <li><strong>TLI ≥ .90</strong> — kabul edilebilir</li>
      <li><strong>RMSEA ≤ .08</strong> — kabul edilebilir, ≤ .05 iyi</li>
      <li><strong>SRMR ≤ .10</strong> — kabul edilebilir, ≤ .08 iyi</li>
      <li><strong>χ²/df ≤ 5</strong> — kabul edilebilir, ≤ 3 iyi</li>
    </ul>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>AVE ve CR</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>AVE ≥ .50</strong> — yakınsak geçerlilik</li>
      <li><strong>CR ≥ .70</strong> — bileşik güvenirlik</li>
    </ul>

    <div style={{ background: '#FAEEDA', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #EF9F27' }}>
      <strong style={{ fontSize: 13, color: '#633806' }}>Önemli Uyarı:</strong>
      <p style={{ fontSize: 13, color: '#854F0B', margin: '6px 0 0' }}>
        Modifikasyon indekslerine bakarak teorik gerekçe olmadan model değiştirmek bilimsel açıdan savunulamaz. Her değişiklik teorik olarak gerekçelendirilmelidir.
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function CFAModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<CFAResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [activeTab2, setActiveTab2] = useState<'fit' | 'loadings' | 'validity'>('fit')
  const [estimator, setEstimator] = useState<'ml' | 'mlr' | 'wlsmv'>('mlr')
  const [correlatedFactors, setCorrelatedFactors] = useState(true)

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert') ?? []

  // Alt boyut grupları
  const subscaleMap: Record<string, string[]> = {}
  likertItems.forEach((v) => {
    const sub = v.subscale ?? 'Faktör1'
    if (!subscaleMap[sub]) subscaleMap[sub] = []
    subscaleMap[sub].push(v.name)
  })

  // EFA sonucundan gelen faktör yapısı varsa kullan
  const efaResult = project?.steps.find((s) => s.id === 'efa')?.result?.data as {
    factorItemMap?: Record<string, string[]>
  } | undefined

  const factorMap = efaResult?.factorItemMap && Object.keys(efaResult.factorItemMap).length > 0
    ? efaResult.factorItemMap
    : subscaleMap

  const isRunning = loading['cfa']

  const handleRun = async () => {
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    if (Object.keys(factorMap).length === 0) return
    setLoading('cfa', true)
    try {
      const data: Record<string, number[]> = {}
      const allItems = Object.values(factorMap).flat()
      for (const item of allItems) {
        const vals = rawData[item] ?? []
        data[item] = vals.filter((v: unknown) => v !== null && !isNaN(Number(v))).map(Number)
      }

      const model = {
        factors: Object.entries(factorMap)
          .filter(([_, items]) => Array.isArray(items) && items.length >= 2)
          .map(([name, items]) => ({ name, items })),
        correlatedFactors,
        estimator,
      }

      const res = await runCFA(data, model) as { result: CFAResult & { warnings?: string[] } }
      const r = res.result
      setResult(r)
      setWarnings(r.warnings ?? [])
      setStepResult('cfa', {
        type: 'cfa',
        data: r,
        warnings: r.warnings ?? [],
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`CFA hatası: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('cfa', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'cfa',
        results: { fit: result.fit, ave: result.ave, cr: result.cr },
        projectContext: { sampleSize: dataset?.rows ?? 0, language: useAppStore.getState().language },
      }) as { interpretation: string }
      const text = res.interpretation
      setAiComment({ summary: text.split('\n\n')[0] ?? text, findings: [], warnings: [], recommendations: [], resultsSection: text, language: useAppStore.getState().language, generatedAt: new Date().toISOString() })
    } catch { setWarnings((w) => [...w, 'AI yorumu alınamadı.']) }
    finally { setIsLoadingAI(false) }
  }

  return (
    <AnalysisPanel
      title="Doğrulayıcı Faktör Analizi (DFA)"
      subtitle="lavaan · Uyum indeksleri · AVE · CR · Faktör yükleri"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      {/* Model Özeti */}
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16, marginBottom: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>Model Yapısı</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {Object.entries(factorMap).map(([factor, items]) => (
            <div key={factor} style={{ background: '#EEEDFE', borderRadius: 6, padding: '6px 10px', border: '0.5px solid #AFA9EC' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#3C3489', marginBottom: 2 }}>{factor}</div>
              <div style={{ fontSize: 10, color: '#534AB7' }}>{Array.isArray(items) ? `${items.length} madde: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}` : String(items)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Tahminleyici</label>
            <select value={estimator} onChange={(e) => setEstimator(e.target.value as typeof estimator)}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }}>
              <option value="mlr">MLR (Robust — önerilen)</option>
              <option value="ml">ML (Maximum Likelihood)</option>
              <option value="wlsmv">WLSMV (Ordinal)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <input type="checkbox" id="corr" checked={correlatedFactors} onChange={(e) => setCorrelatedFactors(e.target.checked)} />
            <label htmlFor="corr" style={{ fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>Faktörler arası korelasyon</label>
          </div>
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={isRunning || Object.keys(factorMap).length === 0}
        style={{ padding: '10px 24px', background: isRunning ? '#888' : '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer', marginBottom: 24 }}
      >
        {isRunning ? 'CFA Çalışıyor... (R lavaan)' : 'DFA Başlat'}
      </button>

      {result && (
        <div>
          {/* Alt sekmeler */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 20 }}>
            {([['fit', 'Uyum İndeksleri'], ['loadings', 'Faktör Yükleri'], ['validity', 'AVE / CR']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab2(id)} style={{
                padding: '7px 16px', border: 'none', background: 'transparent',
                borderBottom: activeTab2 === id ? '2px solid #185FA5' : '2px solid transparent',
                fontSize: 13, fontWeight: activeTab2 === id ? 500 : 400,
                color: activeTab2 === id ? '#185FA5' : 'var(--color-text-secondary)',
                cursor: 'pointer', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* Uyum İndeksleri */}
          {activeTab2 === 'fit' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                <FitCard label="CFI" value={result.fit.cfi} threshold="≥ .90" good={result.fit.cfi >= 0.90} />
                <FitCard label="TLI" value={result.fit.tli} threshold="≥ .90" good={result.fit.tli >= 0.90} />
                <FitCard label="RMSEA" value={result.fit.rmsea} threshold="≤ .08" good={result.fit.rmsea <= 0.08} direction="below" />
                <FitCard label="SRMR" value={result.fit.srmr} threshold="≤ .10" good={(result.fit.srmr ?? 1) <= 0.10} direction="below" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                <FitCard label="χ²/df" value={result.fit.chi2df} threshold="≤ 5" good={result.fit.chi2df <= 5} direction="below" />
                <FitCard label="χ² (df)" value={result.fit.chi2} threshold={`df=${result.fit.df}`} good={result.fit.pValue > 0.05} />
                <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>RMSEA 90% GA</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    [{result.fit.rmseaCI[0].toFixed(3)}, {result.fit.rmseaCI[1].toFixed(3)}]
                  </div>
                </div>
              </div>
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: result.fit.isAdequate ? '#EAF3DE' : '#FCEBEB',
                border: `0.5px solid ${result.fit.isAdequate ? '#C0DD97' : '#F09595'}`,
              }}>
                <div style={{ fontSize: 13, color: result.fit.isAdequate ? '#27500A' : '#A32D2D', fontWeight: 500 }}>
                  {result.fit.fitSummary}
                </div>
              </div>
            </div>
          )}

          {/* Faktör Yükleri */}
          {activeTab2 === 'loadings' && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)' }}>
                    {['Faktör', 'Madde', 'Std. Yük', 'SE', 'p'].map((h) => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.standardizedLoadings.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                      <td style={{ padding: '6px 12px', color: '#534AB7', fontWeight: 500 }}>{row.factor}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--color-text-primary)' }}>{row.item}</td>
                      <td style={{ padding: '6px 12px', color: Math.abs(row.loading) >= 0.40 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>
                        {row.loading.toFixed(3)}
                      </td>
                      <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)' }}>{row.se.toFixed(3)}</td>
                      <td style={{ padding: '6px 12px', color: row.pValue < 0.05 ? '#3B6D11' : '#A32D2D' }}>
                        {row.pValue < 0.001 ? '< .001' : row.pValue.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AVE / CR */}
          {activeTab2 === 'validity' && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)' }}>
                    {['Faktör', 'AVE', 'CR (ω)', 'Yakınsak Geçerlilik', 'Bileşik Güvenirlik'].map((h) => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(result.ave).map((factor, i) => {
                    const ave = result.ave[factor]
                    const cr = result.cr[factor]
                    return (
                      <tr key={factor} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                        <td style={{ padding: '6px 12px', color: '#534AB7', fontWeight: 500 }}>{factor}</td>
                        <td style={{ padding: '6px 12px', color: ave >= 0.50 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>{ave?.toFixed(3) ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: cr >= 0.70 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>{cr?.toFixed(3) ?? '—'}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: ave >= 0.50 ? '#EAF3DE' : '#FCEBEB', color: ave >= 0.50 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>
                            {ave >= 0.50 ? 'Yeterli ✓' : 'Yetersiz ✕'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: cr >= 0.70 ? '#EAF3DE' : '#FCEBEB', color: cr >= 0.70 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>
                            {cr >= 0.70 ? 'Yeterli ✓' : 'Yetersiz ✕'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Lavaan syntax */}
          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: 8 }}>lavaan Model Syntaxı</summary>
            <pre style={{ fontSize: 11, background: 'var(--color-background-secondary)', padding: 12, borderRadius: 6, overflowX: 'auto', color: 'var(--color-text-primary)' }}>
              {result.lavaan_syntax}
            </pre>
          </details>

          <button
            onClick={() => setActiveStep('sem')}
            style={{ padding: '10px 24px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Yapısal Modele Geç →
          </button>
        </div>
      )}
    </AnalysisPanel>
  )
}
