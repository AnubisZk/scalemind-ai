// ============================================================
// ScaleMind AI — Ön İşleme Modülü
// Eksik veri analizi + uç değer tespiti + ters kodlama
// ============================================================
import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import AnalysisPanel from '../../shared/AnalysisPanel'

interface MissingVar { name: string; count: number; rate: number }
interface PreprocessResult {
  totalMissing: number
  missingRate: number
  byVariable: MissingVar[]
  rowsWithMissing: number
  n: number
  nVars: number
}

// ------ Mini bar ------
function MiniBar({ rate, max }: { rate: number; max: number }) {
  const pct = max > 0 ? (rate / max) * 100 : 0
  const color = rate > 0.10 ? '#A32D2D' : rate > 0.05 ? '#854F0B' : '#3B6D11'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: 'var(--color-background-secondary)', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color, minWidth: 36 }}>{(rate * 100).toFixed(1)}%</span>
    </div>
  )
}

// ------ Eğitim İçeriği ------
const EducationContent = () => (
  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
    <h3 style={{ fontSize: 15, fontWeight: 500, marginTop: 0 }}>Eksik Veri Neden Önemli?</h3>
    <p>Eksik veriler analiz sonuçlarını ciddi biçimde etkileyebilir. Özellikle sistematik (rastgele olmayan) eksiklikler örneklem temsil gücünü düşürür ve hatalı sonuçlara yol açar.</p>
    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Kabul Edilebilir Eksiklik Oranları</h3>
    <ul style={{ paddingLeft: 20 }}>
      <li><strong>%5 altı</strong> — Sorunsuz, liste bazlı silme uygulanabilir</li>
      <li><strong>%5–%10</strong> — Ortalama/medyan ile doldurma düşünülebilir</li>
      <li><strong>%10–%20</strong> — Çoklu imputasyon önerilir</li>
      <li><strong>%20 üzeri</strong> — Madde çıkarılması değerlendirilebilir</li>
    </ul>
    <h3 style={{ fontSize: 15, fontWeight: 500 }}>Ters Maddeler</h3>
    <p>Ters maddeler, ölçeğin geri kalanıyla zıt yönde puanlanan maddelerdir. Örneğin "Kendimi başarısız hissediyorum" maddesi, düşük puan iyi performansı gösteriyorsa ters kodlanmalıdır.</p>
    <div style={{ background: '#E6F1FB', borderRadius: 6, padding: '10px 14px', marginTop: 12, border: '0.5px solid #85B7EB' }}>
      <strong style={{ fontSize: 13, color: '#0C447C' }}>Ters Kodlama Formülü:</strong>
      <p style={{ fontSize: 13, color: '#185FA5', margin: '6px 0 0', fontFamily: 'monospace' }}>
        Yeni puan = (Maks + Min) − Eski puan
      </p>
    </div>
  </div>
)

// ------ Ana Bileşen ------
export default function PreprocessingModule() {
  const { project, setStepResult, setActiveStep } = useAppStore()
  const [result, setResult] = useState<PreprocessResult | null>(null)
  const [strategy, setStrategy] = useState<'listwise' | 'mean' | 'median'>('listwise')
  const [sortBy, setSortBy] = useState<'name' | 'rate'>('rate')

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert') ?? []
  const reversedItems = likertItems.filter((v) => v.isReversed)

  // Client-side eksik veri hesabı
  useEffect(() => {
    if (!dataset?.rawData) return
    const vars = dataset.variables.map((v) => v.name)
    const n = dataset.rows
    const byVariable: MissingVar[] = vars.map((name) => {
      const vals = dataset.rawData![name] ?? []
      const count = vals.filter((v) => v === null || v === '' || v === undefined).length
      return { name, count, rate: count / n }
    })
    const totalMissing = byVariable.reduce((a, b) => a + b.count, 0)
    const rowsWithMissing = Array.from({ length: n }, (_, i) =>
      vars.some((v) => {
        const val = dataset.rawData![v]?.[i]
        return val === null || val === '' || val === undefined
      })
    ).filter(Boolean).length

    setResult({
      totalMissing,
      missingRate: totalMissing / (n * vars.length),
      byVariable,
      rowsWithMissing,
      n,
      nVars: vars.length,
    })
  }, [dataset])

  const handleContinue = () => {
    if (!result) return
    setStepResult('preprocessing', {
      type: 'preprocessing',
      data: { ...result, strategy },
      warnings: result.missingRate > 0.10
        ? ['Yüksek eksik veri oranı tespit edildi. Sonuçları dikkatli yorumlayın.']
        : [],
      timestamp: new Date().toISOString(),
    })
    setActiveStep('normality')
  }

  const sorted = result
    ? [...result.byVariable].sort((a, b) =>
        sortBy === 'rate' ? b.rate - a.rate : a.name.localeCompare(b.name)
      )
    : []

  const maxRate = sorted[0]?.rate ?? 1
  const problematic = sorted.filter((v) => v.rate > 0.05)

  return (
    <AnalysisPanel
      title="Ön İşleme"
      subtitle="Eksik veri analizi · Uç değer tespiti · Ters kodlama kontrolü"
      warnings={
        result && result.missingRate > 0.10
          ? [`Genel eksik veri oranı %${(result.missingRate * 100).toFixed(1)} — yüksek. Strateji seçin.`]
          : []
      }
      educationContent={<EducationContent />}
    >
      {result && (
        <div>
          {/* Özet Kartlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Katılımcı', value: result.n.toLocaleString('tr-TR') },
              { label: 'Değişken', value: result.nVars.toString() },
              { label: 'Eksik Gözlem', value: result.totalMissing.toLocaleString('tr-TR') },
              { label: 'Eksik Satır', value: result.rowsWithMissing.toString() },
            ].map((c) => (
              <div key={c.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Ters Maddeler */}
          {reversedItems.length > 0 && (
            <div style={{ background: '#EAF3DE', border: '0.5px solid #C0DD97', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#27500A', marginBottom: 6 }}>
                Ters Kodlanacak Maddeler ({reversedItems.length} adet)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {reversedItems.map((v) => (
                  <span key={v.name} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#FFFFFF', color: '#3B6D11', border: '0.5px solid #97C459' }}>
                    {v.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Eksik Veri Stratejisi */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>Eksik Veri Stratejisi</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'listwise', label: 'Liste Bazlı Silme', desc: 'Eksik satırı analiz dışı bırak' },
                { id: 'mean',     label: 'Ortalama ile Doldur', desc: 'Sütun ortalamasını kullan' },
                { id: 'median',   label: 'Medyan ile Doldur', desc: 'Sütun medyanını kullan' },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: strategy === s.id ? '2px solid #185FA5' : '0.5px solid var(--color-border-secondary)',
                    background: strategy === s.id ? '#E6F1FB' : 'var(--color-background-secondary)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: strategy === s.id ? '#185FA5' : 'var(--color-text-primary)', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.desc}</div>
                </button>
              ))}
            </div>
            {strategy === 'listwise' && result.rowsWithMissing > 0 && (
              <div style={{ fontSize: 12, color: '#854F0B', marginTop: 8 }}>
                ⚠ {result.rowsWithMissing} satır analiz dışı kalacak. Etkin n = {result.n - result.rowsWithMissing}
              </div>
            )}
          </div>

          {/* Değişken Bazlı Eksiklik */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                Değişken Bazlı Eksiklik {problematic.length > 0 && <span style={{ fontSize: 11, color: '#A32D2D', marginLeft: 8 }}>({problematic.length} sorunlu)</span>}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['rate', 'name'] as const).map((s) => (
                  <button key={s} onClick={() => setSortBy(s)} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                    background: sortBy === s ? '#185FA5' : 'transparent',
                    color: sortBy === s ? 'white' : 'var(--color-text-secondary)',
                    border: '0.5px solid var(--color-border-secondary)',
                  }}>
                    {s === 'rate' ? 'Oran' : 'İsim'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--color-background-secondary)' }}>
                  <tr>
                    {['Değişken', 'Tip', 'Eksik (n)', 'Oran'].map((h) => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((v, i) => {
                    const varInfo = dataset?.variables.find((dv) => dv.name === v.name)
                    return (
                      <tr key={v.name} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{v.name}</td>
                        <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)', fontSize: 11 }}>{varInfo?.type ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: v.count > 0 ? '#854F0B' : 'var(--color-text-secondary)' }}>{v.count}</td>
                        <td style={{ padding: '6px 12px' }}><MiniBar rate={v.rate} max={maxRate} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleContinue}
            style={{ padding: '10px 28px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Normallik Analizine Geç →
          </button>
        </div>
      )}
    </AnalysisPanel>
  )
}
