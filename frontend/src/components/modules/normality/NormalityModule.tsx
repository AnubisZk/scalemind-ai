// ============================================================
// ScaleMind AI — Normallik Analizi Modülü
// Tek değişkenli + Mardia çoklu normallik + Tahminleyici önerisi
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runNormality, getAIInterpretation } from '../../../lib/api'
import type { NormalityResult, AIComment } from '../../../types'

// ------ Renk yardımcıları ------
function normalColor(isNormal: boolean) {
  return isNormal ? '#3B6D11' : '#A32D2D'
}

// ------ Tek Değişkenli Tablo ------
function UnivariateTable({ data }: { data: NormalityResult['univariate'] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? data : data.slice(0, 15)

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Tek Değişkenli Normallik
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)' }}>
              {['Değişken', 'Ort.', 'SS', 'Çarpıklık', 'Basıklık', 'SW p', 'Durum'].map((h) => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => (
              <tr key={row.variable} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                <td style={{ padding: '6px 10px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{row.variable}</td>
                <td style={{ padding: '6px 10px', color: 'var(--color-text-secondary)' }}>{row.mean.toFixed(2)}</td>
                <td style={{ padding: '6px 10px', color: 'var(--color-text-secondary)' }}>{row.sd.toFixed(2)}</td>
                <td style={{ padding: '6px 10px', color: Math.abs(row.skewness) > 2 ? '#A32D2D' : 'var(--color-text-primary)', fontWeight: Math.abs(row.skewness) > 2 ? 500 : 400 }}>
                  {row.skewness.toFixed(3)}
                </td>
                <td style={{ padding: '6px 10px', color: Math.abs(row.kurtosis) > 7 ? '#A32D2D' : 'var(--color-text-primary)', fontWeight: Math.abs(row.kurtosis) > 7 ? 500 : 400 }}>
                  {row.kurtosis.toFixed(3)}
                </td>
                <td style={{ padding: '6px 10px', color: row.swPValue !== null && row.swPValue !== undefined && row.swPValue < 0.05 ? '#A32D2D' : 'var(--color-text-secondary)' }}>
                  {row.swPValue !== null && row.swPValue !== undefined ? row.swPValue.toFixed(3) : '—'}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: row.isNormal ? '#EAF3DE' : '#FCEBEB',
                    color: normalColor(row.isNormal),
                    fontWeight: 500,
                  }}>
                    {row.isNormal ? 'Normal' : 'Normal Değil'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 15 && (
        <div style={{ padding: '8px 16px', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 12, color: '#185FA5', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            {showAll ? 'Daha az göster' : `Tümünü göster (${data.length} değişken)`}
          </button>
        </div>
      )}
    </div>
  )
}

// ------ Öneri Kartı ------
function RecommendationCard({ result }: { result: NormalityResult }) {
  const colors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    ml:        { bg: '#EAF3DE', border: '#C0DD97', text: '#27500A', label: 'ML (Maximum Likelihood)' },
    mlr:       { bg: '#E6F1FB', border: '#85B7EB', text: '#0C447C', label: 'MLR (Robust ML)' },
    wlsmv:     { bg: '#EEEDFE', border: '#AFA9EC', text: '#3C3489', label: 'WLSMV' },
    bootstrap: { bg: '#FAEEDA', border: '#EF9F27', text: '#633806', label: 'Bootstrap' },
  }
  const c = colors[result.recommendation] ?? colors.ml

  return (
    <div style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: c.text, fontWeight: 500, marginBottom: 6 }}>Önerilen Tahminleyici</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: c.text, marginBottom: 6 }}>{c.label}</div>
      <div style={{ fontSize: 13, color: c.text, lineHeight: 1.6 }}>{result.recommendationReason}</div>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Neden Normallik Test Edilir?</h3>
    <p>ML tabanlı faktör analizi ve SEM yöntemleri, verilerin çok değişkenli normal dağılıma uyduğunu varsayar. Bu varsayım ihlal edildiğinde standart hatalar ve ki-kare istatistiği yanlı olur.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Mardia Testi</h3>
    <p>Çok değişkenli normalliği değerlendirmek için en yaygın kullanılan testtir. İki bileşeni vardır: çok değişkenli çarpıklık ve çok değişkenli basıklık. Her ikisi de p &gt; .05 ise çoklu normallik kabul edilir.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Tek Değişkenli Kriterler</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>|Çarpıklık| &lt; 2</strong> — kabul edilebilir</li>
      <li><strong>|Basıklık| &lt; 7</strong> — kabul edilebilir (West vd., 1995)</li>
      <li>Shapiro-Wilk testi büyük örneklemlerde aşırı duyarlıdır — sayısal kriterleri önceliklendirin</li>
    </ul>

    <div style={{ background: '#FAEEDA', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #EF9F27' }}>
      <strong style={{ fontSize: 13, color: '#633806' }}>Likert Verisi İçin Not:</strong>
      <p style={{ fontSize: 13, color: '#854F0B', margin: '6px 0 0' }}>
        Ordinal Likert maddeleri hiçbir zaman tam olarak normal dağılmaz. Bu nedenle WLSMV veya MLR tahminleyicileri sıkça tercih edilir.
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function NormalityModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<NormalityResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert').map((v) => v.name) ?? []
  const isRunning = loading['normality']

  const handleRun = async () => {
    if (likertItems.length < 2) return
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    setLoading('normality', true)
    try {
      const data: Record<string, number[]> = {}
      for (const item of likertItems) {
        data[item] = (rawData[item] ?? [])
          .filter((v) => v !== null && v !== '' && !isNaN(Number(v)))
          .map(Number)
      }
      const res = await runNormality(data, likertItems) as { result: NormalityResult }
      const r = res.result
      setResult(r)

      const warns: string[] = []
      const nonNormal = r.univariate.filter((v) => !v.isNormal)
      if (nonNormal.length > 0)
        warns.push(`${nonNormal.length} değişken normallik kriterini karşılamıyor.`)
      if (r.multivariate && !r.multivariate.isMultivariateNormal)
        warns.push('Çoklu normallik sağlanmamış. Robust tahminleyici önerilir.')
      if (r.multivariate && r.multivariate.nOutliers > 0)
        warns.push(`${r.multivariate.nOutliers} çok değişkenli aykırı gözlem tespit edildi.`)
      setWarnings(warns)

      setStepResult('normality', {
        type: 'normality',
        data: r,
        warnings: warns,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`Normallik analizi başarısız: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('normality', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'normality',
        results: {
          nNonNormal: result.univariate.filter((v) => !v.isNormal).length,
          nTotal: result.univariate.length,
          multivariate: result.multivariate,
          recommendation: result.recommendation,
        },
        projectContext: {
          sampleSize: dataset?.rows ?? 0,
          language: useAppStore.getState().language,
        },
      }) as { interpretation: string }
      const text = res.interpretation
      setAiComment({
        summary: text.split('\n\n')[0] ?? text,
        findings: [], warnings: [], recommendations: [],
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

  return (
    <AnalysisPanel
      title="Normallik Analizi"
      subtitle="Tek değişkenli normallik · Mardia çoklu normallik · Tahminleyici önerisi"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      <button
        onClick={handleRun}
        disabled={isRunning}
        style={{
          padding: '10px 24px', background: isRunning ? '#888' : '#185FA5',
          color: 'white', border: 'none', borderRadius: 8,
          fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer',
          marginBottom: 20,
        }}
      >
        {isRunning ? 'Analiz Çalışıyor...' : 'Normallik Testini Başlat'}
      </button>

      {result && (
        <div>
          {/* Özet kartlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Toplam Değişken', value: result.univariate.length.toString() },
              { label: 'Normal', value: result.univariate.filter((v) => v.isNormal).length.toString(), ok: true },
              { label: 'Normal Değil', value: result.univariate.filter((v) => !v.isNormal).length.toString(), ok: false },
              { label: 'Çok Değişkenli', value: result.multivariate ? (result.multivariate.isMultivariateNormal ? 'Normal ✓' : 'Normal Değil ✕') : '—', ok: result.multivariate?.isMultivariateNormal },
            ].map((c) => (
              <div key={c.label} style={{
                background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px',
                border: c.ok === false ? '0.5px solid #F09595' : '0.5px solid var(--color-border-tertiary)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: c.ok === false ? '#A32D2D' : c.ok === true ? '#3B6D11' : 'var(--color-text-primary)' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Mardia */}
          {result.multivariate && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>Mardia Çoklu Normallik Testi</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
                {[
                  { label: 'Mardia Çarpıklık', value: result.multivariate.mardiaSkewness.toFixed(3), p: result.multivariate.mardiaSkewnessPValue },
                  { label: 'Mardia Basıklık', value: result.multivariate.mardiaKurtosis.toFixed(3), p: result.multivariate.mardiaKurtosisPValue },
                  { label: 'Mahalanobis Aykırı', value: result.multivariate.nOutliers.toString(), p: null },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.value}</div>
                    {item.p !== null && (
                      <div style={{ fontSize: 11, color: item.p < 0.05 ? '#A32D2D' : '#3B6D11', marginTop: 2 }}>
                        p = {item.p < 0.001 ? '< .001' : item.p.toFixed(3)} {item.p < 0.05 ? '✕' : '✓'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tahminleyici Önerisi */}
          <RecommendationCard result={result} />

          {/* Tek Değişkenli Tablo */}
          <UnivariateTable data={result.univariate} />

          <button
            onClick={() => setActiveStep('item-analysis')}
            style={{ padding: '10px 24px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Madde Analizine Geç →
          </button>
        </div>
      )}
    </AnalysisPanel>
  )
}
