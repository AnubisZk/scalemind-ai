// ============================================================
// ScaleMind AI — AFA (EFA) Modülü
// KMO, Bartlett, Scree Plot, Faktör Yükleri Isı Haritası
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'
import { runEFA, getAIInterpretation } from '../../../lib/api'
import type { EFAResult, AIComment } from '../../../types'

// ------ Scree Plot (SVG) ------
function ScreePlot({ eigenvalues }: { eigenvalues: number[] }) {
  const vals = eigenvalues.slice(0, Math.min(eigenvalues.length, 15))
  const maxVal = Math.max(...vals, 1)
  const W = 420
  const H = 200
  const PAD = { top: 12, right: 16, bottom: 36, left: 40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xStep = innerW / (vals.length - 1 || 1)
  const yScale = (v: number) => innerH - (v / maxVal) * innerH

  const points = vals.map((v, i) => ({ x: PAD.left + i * xStep, y: PAD.top + yScale(v) }))
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.5, 1, 1.5, 2, maxVal].map((v) => {
        if (v > maxVal) return null
        const y = PAD.top + yScale(v)
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#E0DED8" strokeWidth="0.5" />
            <text x={PAD.left - 6} y={y + 4} fontSize="9" textAnchor="end" fill="#888780">{v.toFixed(1)}</text>
          </g>
        )
      })}
      {/* Eigenvalue = 1 referans çizgisi */}
      {maxVal >= 1 && (
        <line
          x1={PAD.left} y1={PAD.top + yScale(1)}
          x2={PAD.left + innerW} y2={PAD.top + yScale(1)}
          stroke="#E24B4A" strokeWidth="1" strokeDasharray="4,3"
        />
      )}
      {/* Polyline */}
      <polyline points={polyline} fill="none" stroke="#185FA5" strokeWidth="2" />
      {/* Noktalar */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill={eigenvalues[i] >= 1 ? '#185FA5' : '#B5D4F4'} />
          <text x={p.x} y={H - PAD.bottom + 16} fontSize="9" textAnchor="middle" fill="#888780">{i + 1}</text>
        </g>
      ))}
      {/* Eksen etiketleri */}
      <text x={W / 2} y={H - 2} fontSize="10" textAnchor="middle" fill="#888780">Faktör No</text>
      <text transform={`rotate(-90,10,${H / 2})`} x={0} y={H / 2} fontSize="10" textAnchor="middle" fill="#888780">Özdeğer</text>
    </svg>
  )
}

// ------ Faktör Yükleri Isı Haritası ------
function LoadingsHeatmap({ result }: { result: EFAResult }) {
  const { variableNames, factorNames, loadings } = result
  const loadingsArr = variableNames.map((name) => {
    const row = (loadings as unknown as Record<string, Record<string, number>>)[name] ?? {}
    return factorNames.map((f) => row[f] ?? 0)
  })

  function loadingColor(val: number): string {
    const abs = Math.abs(val)
    if (abs >= 0.70) return val > 0 ? '#0C447C' : '#501313'
    if (abs >= 0.50) return val > 0 ? '#185FA5' : '#A32D2D'
    if (abs >= 0.40) return val > 0 ? '#378ADD' : '#E24B4A'
    if (abs >= 0.32) return val > 0 ? '#85B7EB' : '#F09595'
    return '#D3D1C7'
  }
  function cellBg(val: number): string {
    const abs = Math.abs(val)
    if (abs >= 0.70) return val > 0 ? '#E6F1FB' : '#FCEBEB'
    if (abs >= 0.50) return val > 0 ? '#E6F1FB' : '#FCEBEB'
    if (abs >= 0.40) return val > 0 ? 'transparent' : 'transparent'
    return 'transparent'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Madde</th>
            {factorNames.map((f) => (
              <th key={f} style={{ padding: '6px 12px', textAlign: 'center', fontSize: 11, color: '#534AB7', fontWeight: 500 }}>{f}</th>
            ))}
            <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>h²</th>
          </tr>
        </thead>
        <tbody>
          {variableNames.map((item, i) => {
            const rowLoads = loadingsArr[i]
            const maxAbs = Math.max(...rowLoads.map(Math.abs))
            return (
              <tr key={item} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '6px 10px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{item}</td>
                {rowLoads.map((val, j) => (
                  <td key={j} style={{
                    padding: '6px 12px',
                    textAlign: 'center',
                    background: cellBg(val),
                    color: loadingColor(val),
                    fontWeight: Math.abs(val) === maxAbs && Math.abs(val) >= 0.40 ? 500 : 400,
                    border: Math.abs(val) === maxAbs && Math.abs(val) >= 0.40
                      ? '1.5px solid #185FA5' : '0.5px solid var(--color-border-tertiary)',
                  }}>
                    {Math.abs(val) < 0.10 ? '·' : val.toFixed(2)}
                  </td>
                ))}
                <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {(result.communalities[i] ?? 0).toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
        Not: Çerçeveli değer = en yüksek faktör yükü. h² = Ortak varyans (communality). Gri = .32 altı (göz ardı edilebilir).
      </div>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Açımlayıcı Faktör Analizi (AFA) Nedir?</h3>
    <p>AFA, bir ölçekteki maddelerin hangi gizil yapıları (faktörleri) yansıttığını keşfetmek için kullanılır. Ölçek geliştirme sürecinin ilk doğrulama aşamasında zorunludur.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>KMO ve Bartlett Testleri</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>KMO ≥ .70</strong> — Verinin faktör analizine uygunluğu</li>
      <li><strong>Bartlett p &lt; .05</strong> — Değişkenler arası anlamlı korelasyon var</li>
      <li>KMO &lt; .60 ise EFA uygulanmamalıdır.</li>
    </ul>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Faktör Sayısı Nasıl Belirlenir?</h3>
    <p>Üç kriter birlikte değerlendirilmelidir: (1) Özdeğer &gt; 1 kuralı (aşırı tahmin riski var), (2) Scree plot (dirsek noktası), (3) Paralel analiz (en güvenilir yöntem). Bu üç kriter uyuşmuyorsa teorik bilgi devreye girer.</p>

    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Rotasyon</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>Varimax</strong> — Faktörler bağımsızsa (dik rotasyon)</li>
      <li><strong>Oblimin / Promax</strong> — Faktörler birbiriyle ilişkiliyse (eğik rotasyon) — Sosyal bilimlerde genellikle tercih edilir</li>
    </ul>

    <div style={{ background: '#FAEEDA', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #EF9F27' }}>
      <strong style={{ fontSize: 13, color: '#633806' }}>Önemli Uyarı:</strong>
      <p style={{ fontSize: 13, color: '#854F0B', margin: '6px 0 0' }}>
        AFA keşifseldir — ortaya çıkan yapı, teorik beklentiyle uyuşmalıdır. Tamamen veriye dayalı karar vermekten kaçının.
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function EFAModule() {
  const { project, setStepResult, setActiveStep, setLoading, loading } = useAppStore()
  const [result, setResult] = useState<EFAResult | null>(null)
  const [aiComment, setAiComment] = useState<AIComment | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [options, setOptions] = useState({
    rotation: 'oblimin' as 'oblimin' | 'varimax' | 'promax',
    extraction: 'minres' as 'minres' | 'paf' | 'ml',
    nFactors: 0, // 0 = otomatik
  })

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert').map((v) => v.name) ?? []
  const isRunning = loading['efa']

  const handleRun = async () => {
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    if (likertItems.length < 3) return
    setLoading('efa', true)
    try {
      const data: Record<string, number[]> = {}
      for (const item of likertItems) {
        data[item] = (rawData[item] ?? []).filter((v) => v !== null && !isNaN(Number(v))).map(Number)
      }
      const res = await runEFA(data, likertItems, {
        extraction: options.extraction,
        rotation: options.rotation,
        nFactors: options.nFactors > 0 ? options.nFactors : undefined,
      }) as { result: EFAResult & { warnings?: string[] } }

      const r = res.result
      console.log('EFA RESULT:', JSON.stringify(r))
      setResult(r)
      setWarnings(r.warnings ?? [])
      setStepResult('efa', {
        type: 'efa',
        data: r,
        warnings: r.warnings ?? [],
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`EFA çalışamadı: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading('efa', false)
    }
  }

  const handleAI = async () => {
    if (!result) return
    setIsLoadingAI(true)
    try {
      const res = await getAIInterpretation({
        analysisType: 'efa',
        results: {
          kmo: result.kmo,
          bartlettP: result.bartlettP,
          suggestedFactors: result.suggestedFactors,
          selectedFactors: result.selectedFactors,
          varianceExplained: result.varianceExplained,
          factorItemMap: result.factorItemMap,
          crossLoadings: result.crossLoadings,
          lowLoadItems: (result as EFAResult & { lowLoadItems?: string[] }).lowLoadItems ?? [],
        },
        projectContext: {
          sampleSize: dataset?.rows ?? 0,
          scale: dataset?.name,
          language: useAppStore.getState().language,
        },
      }) as { interpretation: string }
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

  return (
    <AnalysisPanel
      title="Açımlayıcı Faktör Analizi (AFA)"
      subtitle="KMO · Bartlett · Scree Plot · Paralel Analiz · Faktör Yükleri"
      warnings={warnings}
      educationContent={<EducationContent />}
      aiComment={aiComment}
      isLoadingAI={isLoadingAI}
      onRequestAI={result ? handleAI : undefined}
    >
      {/* Ayarlar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12,
        marginBottom: 16, background: 'var(--color-background-secondary)',
        borderRadius: 8, padding: 16, border: '0.5px solid var(--color-border-tertiary)',
      }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Rotasyon</label>
          <select value={options.rotation} onChange={(e) => setOptions((o) => ({ ...o, rotation: e.target.value as typeof o.rotation }))}
            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }}>
            <option value="oblimin">Oblimin (önerilen)</option>
            <option value="varimax">Varimax</option>
            <option value="promax">Promax</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Çıkarma Yöntemi</label>
          <select value={options.extraction} onChange={(e) => setOptions((o) => ({ ...o, extraction: e.target.value as typeof o.extraction }))}
            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }}>
            <option value="minres">Minimum Residual (önerilen)</option>
            <option value="paf">Principal Axis Factoring</option>
            <option value="ml">Maximum Likelihood</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Faktör Sayısı (0 = otomatik)</label>
          <input type="number" min={0} max={10} value={options.nFactors}
            onChange={(e) => setOptions((o) => ({ ...o, nFactors: Number(e.target.value) }))}
            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={isRunning || likertItems.length < 3}
        style={{
          padding: '10px 24px', background: isRunning ? '#888' : '#185FA5',
          color: 'white', border: 'none', borderRadius: 8,
          fontSize: 14, fontWeight: 500, cursor: isRunning ? 'wait' : 'pointer',
          marginBottom: 24,
        }}
      >
        {isRunning ? 'Analiz Çalışıyor...' : 'AFA Başlat'}
      </button>

      {result && (
        <div>
          {/* KMO & Bartlett */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20,
          }}>
            {[
              { label: 'KMO', value: result.kmo.toFixed(3), sub: result.kmoInterpretation, ok: result.kmo >= 0.70 },
              { label: 'Bartlett p', value: result.bartlettP < 0.001 ? '< .001' : result.bartlettP.toFixed(3), sub: result.bartlettP < 0.05 ? 'Anlamlı ✓' : 'Anlamsız ✕', ok: result.bartlettP < 0.05 },
              { label: 'Önerilen Faktör', value: String(result.suggestedFactors), sub: 'Paralel analiz', ok: true },
              { label: 'Açıklanan Varyans', value: `%${result.varianceExplained[result.selectedFactors - 1]?.cumulative.toFixed(1) ?? '—'}`, sub: `${result.selectedFactors} faktör`, ok: (result.varianceExplained[result.selectedFactors - 1]?.cumulative ?? 0) >= 40 },
            ].map((card) => (
              <div key={card.label} style={{
                background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px',
                border: `0.5px solid ${card.ok ? 'var(--color-border-tertiary)' : '#F09595'}`,
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: card.ok ? 'var(--color-text-primary)' : '#A32D2D' }}>{card.value}</div>
                <div style={{ fontSize: 11, color: card.ok ? 'var(--color-text-secondary)' : '#A32D2D', marginTop: 2 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Scree Plot */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' }}>Scree Plot</div>
            <ScreePlot eigenvalues={result.eigenvalues} />
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Kırmızı kesikli çizgi = özdeğer 1.0 referansı. Dirsek noktasının solundaki faktörler anlamlıdır.
            </div>
          </div>

          {/* Faktör Yükleri */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--color-text-primary)' }}>
              Faktör Yükleri Matrisi ({result.extractionMethod} / {result.rotation})
            </div>
            <LoadingsHeatmap result={result} />
          </div>

          {/* Açıklanan Varyans Tablosu */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Açıklanan Varyans
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-background-secondary)' }}>
                  {['Faktör', 'Özdeğer', 'Varyans %', 'Kümülatif %'].map((h) => (
                    <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.varianceExplained.map((row) => (
                  <tr key={row.factor} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <td style={{ padding: '6px 14px', fontWeight: 500, color: '#534AB7' }}>{row.factor}</td>
                    <td style={{ padding: '6px 14px', color: 'var(--color-text-primary)' }}>{row.eigenvalue.toFixed(3)}</td>
                    <td style={{ padding: '6px 14px', color: 'var(--color-text-primary)' }}>{row.variance.toFixed(2)}%</td>
                    <td style={{ padding: '6px 14px', color: row.cumulative >= 40 ? '#3B6D11' : 'var(--color-text-secondary)', fontWeight: row.cumulative >= 40 ? 500 : 400 }}>{row.cumulative.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Devam */}
          <button
            onClick={() => setActiveStep('cfa')}
            style={{
              padding: '10px 24px', background: '#185FA5', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            DFA (CFA) Adımına Geç →
          </button>
        </div>
      )}
    </AnalysisPanel>
  )
}
