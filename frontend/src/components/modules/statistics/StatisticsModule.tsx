// ============================================================
// ScaleMind AI — İstatistiksel Analizler Modülü (Tam Versiyon)
// t-Test, ANOVA, ANCOVA, MANCOVA, Non-parametrik, Korelasyon,
// Regresyon, Ki-Kare + Varsayım Testleri + AI Yorum + APA 7
// ============================================================
import React, { useState, useCallback } from 'react'
import { useAppStore } from '../../../store/useAppStore'

const BASE = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'http://localhost:8002'
const AI_BASE = import.meta.env.VITE_AI_WORKER_URL || 'http://localhost:8002'

// ─── TİPLER ──────────────────────────────────────────────────────────────────
type VarRole = 'dependent' | 'independent' | 'grouping' | 'covariate' | 'scale_item' | 'id' | 'ignore'
type TestFamily = 'parametric' | 'nonparametric' | 'anova' | 'correlation' | 'regression' | 'categorical'
type WizardStep = 'upload' | 'variables' | 'assumptions' | 'test_select' | 'result'

const ROLE_LABELS: Record<VarRole, string> = {
  dependent: 'Bağımlı Değişken', independent: 'Bağımsız Değişken',
  grouping: 'Gruplama Değişkeni', covariate: 'Kovaryant',
  scale_item: 'Ölçek Maddesi', id: 'ID / Kimlik', ignore: 'Yoksay'
}

const ROLE_COLORS: Record<VarRole, string> = {
  dependent: '#185FA5', independent: '#3B6D11', grouping: '#854F0B',
  covariate: '#534AB7', scale_item: '#993556', id: '#888', ignore: '#ccc'
}

// ─── TEST TANIMI ─────────────────────────────────────────────────────────────
const TEST_DEFINITIONS = [
  // Parametrik
  { id: 'independent', family: 'parametric', label: 'Bağımsız t-Testi', icon: '⚖️',
    desc: '2 bağımsız grup ortalaması karşılaştırması', requires: ['dependent','grouping'],
    assumptions: ['Normallik', 'Varyans Homojenliği'], effect: "Cohen's d" },
  { id: 'welch', family: 'parametric', label: 'Welch t-Testi', icon: '⚖️',
    desc: '2 grup, varyanslar eşit değil', requires: ['dependent','grouping'],
    assumptions: ['Normallik'], effect: "Cohen's d" },
  { id: 'paired', family: 'parametric', label: 'Eşleştirilmiş t-Testi', icon: '🔗',
    desc: 'Aynı gruptan 2 ölçüm (ön-son test)', requires: ['dependent','grouping'],
    assumptions: ['Farkların Normalliği'], effect: "Cohen's d" },
  { id: 'one_sample', family: 'parametric', label: 'Tek Örneklem t-Testi', icon: '🎯',
    desc: 'Örneklem ortalamasını referans değerle karşılaştır', requires: ['dependent'],
    assumptions: ['Normallik'], effect: "Cohen's d" },
  // ANOVA
  { id: 'one_way_anova', family: 'anova', label: 'Tek Yönlü ANOVA', icon: '📊',
    desc: '3+ bağımsız grup ortalaması', requires: ['dependent','grouping'],
    assumptions: ['Normallik', 'Varyans Homojenliği'], effect: 'Eta²', posthoc: true },
  { id: 'welch_anova', family: 'anova', label: 'Welch ANOVA', icon: '📊',
    desc: '3+ grup, varyanslar eşit değil', requires: ['dependent','grouping'],
    assumptions: ['Normallik'], effect: 'Eta²', posthoc: true },
  { id: 'ancova', family: 'anova', label: 'ANCOVA', icon: '🎛️',
    desc: 'Kovaryant kontrolüyle grup karşılaştırması', requires: ['dependent','grouping','covariate'],
    assumptions: ['Normallik', 'Regresyon Eğimi Homojenliği'], effect: 'Parsiyel Eta²' },
  { id: 'manova', family: 'anova', label: 'MANOVA', icon: '🎛️',
    desc: 'Birden fazla bağımlı değişken', requires: ['dependent','grouping'],
    assumptions: ['Çok Değişkenli Normallik', 'Kovaryans Homojenliği'], effect: "Wilks' Lambda" },
  // Non-parametrik
  { id: 'mann_whitney', family: 'nonparametric', label: 'Mann-Whitney U', icon: '🔀',
    desc: '2 bağımsız grup, normallik yok', requires: ['dependent','grouping'],
    assumptions: [], effect: 'Rank-biserial r' },
  { id: 'wilcoxon', family: 'nonparametric', label: 'Wilcoxon İşaretli Sıra', icon: '🔀',
    desc: '2 eşleştirilmiş ölçüm, normallik yok', requires: ['dependent','grouping'],
    assumptions: [], effect: 'r' },
  { id: 'kruskal_wallis', family: 'nonparametric', label: 'Kruskal-Wallis H', icon: '🔀',
    desc: '3+ grup, normallik yok', requires: ['dependent','grouping'],
    assumptions: [], effect: 'Eta²', posthoc: true },
  { id: 'friedman', family: 'nonparametric', label: 'Friedman Testi', icon: '🔀',
    desc: '3+ tekrarlı ölçüm, normallik yok', requires: ['dependent','grouping'],
    assumptions: [], effect: "Kendall's W" },
  // Korelasyon
  { id: 'pearson', family: 'correlation', label: 'Pearson Korelasyon', icon: '📈',
    desc: '2 sürekli değişken ilişkisi', requires: ['dependent','independent'],
    assumptions: ['Normallik', 'Doğrusallık'], effect: 'r' },
  { id: 'spearman', family: 'correlation', label: 'Spearman Korelasyon', icon: '📈',
    desc: 'Sıralı veya normallik olmayan korelasyon', requires: ['dependent','independent'],
    assumptions: [], effect: 'r' },
  { id: 'kendall', family: 'correlation', label: 'Kendall Tau', icon: '📈',
    desc: 'Küçük örneklem veya bağlı sıra korelasyonu', requires: ['dependent','independent'],
    assumptions: [], effect: 'τ' },
  // Regresyon
  { id: 'linear_regression', family: 'regression', label: 'Basit Regresyon', icon: '📉',
    desc: '1 yordayıcı → 1 sürekli bağımlı', requires: ['dependent','independent'],
    assumptions: ['Normallik (Artıklar)', 'Doğrusallık', 'Homokedastik'], effect: 'R²' },
  { id: 'multiple_regression', family: 'regression', label: 'Çoklu Regresyon', icon: '📉',
    desc: '2+ yordayıcı → 1 sürekli bağımlı', requires: ['dependent','independent'],
    assumptions: ['Normallik (Artıklar)', 'Çoklu Doğrusal Bağlantı Yok'], effect: 'R²' },
  { id: 'logistic_regression', family: 'regression', label: 'Lojistik Regresyon', icon: '📉',
    desc: 'Binary bağımlı değişken tahmini', requires: ['dependent','independent'],
    assumptions: ['Çoklu Doğrusal Bağlantı Yok'], effect: "Nagelkerke R²" },
  { id: 'ordinal_logistic', family: 'regression', label: 'Ordinal Lojistik', icon: '📉',
    desc: 'Sıralı kategorik bağımlı değişken', requires: ['dependent','independent'],
    assumptions: ['Paralel Çizgiler'], effect: 'AIC/BIC' },
]

const FAMILY_LABELS: Record<string, string> = {
  parametric: 'Parametrik Testler', nonparametric: 'Non-parametrik Testler',
  anova: 'ANOVA / ANCOVA / MANOVA', correlation: 'Korelasyon',
  regression: 'Regresyon', categorical: 'Kategorik'
}
const FAMILY_COLORS: Record<string, string> = {
  parametric: '#185FA5', nonparametric: '#854F0B',
  anova: '#3B6D11', correlation: '#534AB7',
  regression: '#993556', categorical: '#888'
}

// ─── ANA COMPONENT ───────────────────────────────────────────────────────────
export default function StatisticsModule() {
  const { project } = useAppStore()
  const [step, setStep] = useState<WizardStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [roles, setRoles] = useState<Record<string, VarRole>>({})
  const [assumptions, setAssumptions] = useState<any>(null)
  const [selectedTest, setSelectedTest] = useState<string>('')
  const [testOptions, setTestOptions] = useState<any>({ alpha: 0.05, language: 'both' })
  const [result, setResult] = useState<any>(null)
  const [aiComment, setAiComment] = useState<string>('')
  const [recommendation, setRecommendation] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(`stat_${Date.now()}`)
  const [muValue, setMuValue] = useState('0')
  const [corrMethod, setCorrMethod] = useState<'pearson'|'spearman'|'kendall'>('pearson')

  // ── Değişken rolleri ─────────────────────────────────────────────────────
  const depVars = Object.entries(roles).filter(([,r]) => r === 'dependent').map(([v]) => v)
  const indVars = Object.entries(roles).filter(([,r]) => r === 'independent').map(([v]) => v)
  const groupVars = Object.entries(roles).filter(([,r]) => r === 'grouping').map(([v]) => v)
  const covVars = Object.entries(roles).filter(([,r]) => r === 'covariate').map(([v]) => v)

  // ── Dosya Yükleme ─────────────────────────────────────────────────────────
  const handleFile = async (f: File) => {
    setLoading(true); setError(null)
    try {
      const form = new FormData(); form.append('file', f)
      const res = await fetch(`${BASE}/statistics/upload-preview?session_id=${sessionId}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.detail || 'Yükleme hatası')
      setPreview(data)
      setFile(f)
      // Otomatik rol ata
      const autoRoles: Record<string, VarRole> = {}
      data.variables?.forEach((v: any) => {
        autoRoles[v.name] = (v.suggested_role as VarRole) || 'ignore'
      })
      setRoles(autoRoles)
      setStep('variables')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  // ── Test Önerisi Al ───────────────────────────────────────────────────────
  const getRecommendation = async () => {
    setLoading(true); setError(null)
    try {
      const normOk = assumptions?.overall_verdict === 'parametric_ok' ? true :
                     assumptions?.overall_verdict === 'use_nonparametric' ? false : undefined
      const homoOk = assumptions?.homogeneity?.every((h: any) => h.is_homogeneous) ?? undefined
      const groupCount = groupVars[0] ? preview?.variables?.find((v: any) => v.name === groupVars[0])?.unique_count : undefined

      const res = await fetch(`${BASE}/statistics/recommend-test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependent_variables: depVars,
          independent_variable: indVars[0] || groupVars[0] || null,
          measurement: 'independent',
          group_count: groupCount,
          normality_ok: normOk,
          homogeneity_ok: homoOk,
          n: preview?.rows,
          dependent_type: 'continuous',
          covariate: covVars[0] || null,
        })
      })
      const data = await res.json()
      setRecommendation(data)
      setSelectedTest(data.recommended_test_id || '')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  // ── Varsayım Testleri ─────────────────────────────────────────────────────
  const runAssumptions = async () => {
    if (!depVars[0]) return setError('Bağımlı değişken seçin.')
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({
        dependent_variable: depVars[0],
        session_id: sessionId,
        alpha: '0.05',
        ...(groupVars[0] ? { group_variable: groupVars[0] } : {})
      })
      const res = await fetch(`${BASE}/statistics/assumptions?${params}`, { method: 'POST' })
      const data = await res.json()
      setAssumptions(data)
      await getRecommendation()
      setStep('test_select')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  // ── Analiz Çalıştır ───────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!selectedTest) return setError('Test seçin.')
    setLoading(true); setError(null); setAiComment('')
    try {
      let endpoint = ''
      let body: any = { language: 'both', alpha: testOptions.alpha, covariates: covVars }

      const testDef = TEST_DEFINITIONS.find(t => t.id === selectedTest)

      if (['independent','welch','paired','one_sample'].includes(selectedTest)) {
        endpoint = '/statistics/t-test'
        body = { ...body, dependent_variable: depVars[0], group_variable: groupVars[0] || null,
                 test_type: selectedTest, mu: selectedTest === 'one_sample' ? parseFloat(muValue) : undefined }
      } else if (['one_way_anova','welch_anova','ancova','manova'].includes(selectedTest)) {
        endpoint = selectedTest === 'ancova' ? '/statistics/ancova' : '/statistics/anova'
        body = { ...body, dependent_variable: depVars[0], group_variable: groupVars[0],
                 test_type: selectedTest === 'one_way_anova' ? 'one_way' : 'one_way' }
      } else if (['mann_whitney','wilcoxon','kruskal_wallis','friedman'].includes(selectedTest)) {
        endpoint = '/statistics/nonparametric'
        body = { ...body, dependent_variable: depVars[0], group_variable: groupVars[0],
                 test_type: selectedTest }
      } else if (['pearson','spearman','kendall'].includes(selectedTest)) {
        endpoint = '/statistics/correlation'
        body = { variables: [...depVars, ...indVars, ...groupVars].slice(0, 10),
                 method: selectedTest, language: 'both' }
      } else if (['linear_regression','multiple_regression','logistic_regression','ordinal_logistic'].includes(selectedTest)) {
        endpoint = '/statistics/regression'
        body = { dependent_variable: depVars[0], independent_variables: [...indVars, ...groupVars],
                 method: selectedTest === 'linear_regression' ? 'linear' :
                         selectedTest === 'multiple_regression' ? 'multiple' :
                         selectedTest === 'logistic_regression' ? 'logistic' : 'ordinal_logistic',
                 enter_method: 'enter', language: 'both' }
      } else {
        return setError('Bu test henüz desteklenmiyor.')
      }

      const res = await fetch(`${BASE}${endpoint}?session_id=${sessionId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.warnings?.[0] || 'Analiz hatası')
      setResult(data)
      setStep('result')

      // AI yorum
      getAIComment(data)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  // ── AI Yorum ─────────────────────────────────────────────────────────────
  const getAIComment = async (analysisResult: any) => {
    setAiLoading(true)
    try {
      const res = await fetch(`${AI_BASE}/interpret`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'statistics',
          data: {
            analysis_name: analysisResult.analysis_name,
            test_used: analysisResult.test_used,
            main_results: analysisResult.main_results,
            effect_size: analysisResult.effect_size,
            apa7_tr: analysisResult.apa7_tr,
            warnings: analysisResult.warnings,
          },
          lang: 'tr'
        })
      })
      const data = await res.json()
      setAiComment(data.interpretation || data.result?.interpretation || '')
    } catch { setAiComment('') }
    finally { setAiLoading(false) }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>İstatistiksel Analizler</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 20px' }}>
        t-Testi · ANOVA · ANCOVA · MANOVA · Non-parametrik · Korelasyon · Regresyon · APA 7 + AI Yorum
      </p>

      {/* Hata */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7',
          borderRadius: 8, color: '#c53030', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c53030' }}>✕</button>
        </div>
      )}

      {/* Adım göstergesi */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border-secondary)' }}>
        {([
          { id: 'upload', label: '1. Veri' },
          { id: 'variables', label: '2. Değişkenler' },
          { id: 'test_select', label: '3. Test & Varsayım' },
          { id: 'result', label: '4. Sonuç' },
        ] as { id: WizardStep; label: string }[]).map((s, i) => {
          const steps: WizardStep[] = ['upload', 'variables', 'test_select', 'result']
          const isActive = s.id === step
          const isDone = steps.indexOf(s.id) < steps.indexOf(step)
          return (
            <div key={s.id} style={{
              flex: 1, padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              background: isActive ? '#185FA5' : isDone ? '#E6F1FB' : 'var(--color-background-secondary)',
              color: isActive ? '#fff' : isDone ? '#185FA5' : 'var(--color-text-tertiary)',
              borderRight: i < 3 ? '1px solid var(--color-border-secondary)' : 'none',
              cursor: isDone ? 'pointer' : 'default',
            }} onClick={() => isDone && setStep(s.id)}>
              {isDone ? '✓ ' : ''}{s.label}
            </div>
          )
        })}
      </div>

      {loading && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#185FA5', fontSize: 14 }}>
          ⚙️ İşleniyor...
        </div>
      )}

      {/* ── ADIM 1: VERİ YÜKLEME ── */}
      {step === 'upload' && !loading && (
        <UploadStep onFile={handleFile} file={file} preview={preview} />
      )}

      {/* ── ADIM 2: DEĞİŞKENLER ── */}
      {step === 'variables' && preview && (
        <VariablesStep
          preview={preview} roles={roles} setRoles={setRoles}
          onNext={() => { if (depVars.length > 0) runAssumptions(); else setStep('test_select') }}
          onBack={() => setStep('upload')}
          depVars={depVars} groupVars={groupVars} indVars={indVars} covVars={covVars}
        />
      )}

      {/* ── ADIM 3: TEST SEÇİMİ ── */}
      {step === 'test_select' && !loading && (
        <TestSelectStep
          assumptions={assumptions}
          recommendation={recommendation}
          selectedTest={selectedTest}
          setSelectedTest={setSelectedTest}
          testOptions={testOptions}
          setTestOptions={setTestOptions}
          muValue={muValue}
          setMuValue={setMuValue}
          depVars={depVars} groupVars={groupVars} indVars={indVars} covVars={covVars}
          onRun={runAnalysis}
          onBack={() => setStep('variables')}
        />
      )}

      {/* ── ADIM 4: SONUÇ ── */}
      {step === 'result' && result && (
        <ResultStep
          result={result}
          aiComment={aiComment}
          aiLoading={aiLoading}
          onNewAnalysis={() => { setStep('test_select'); setResult(null); setAiComment('') }}
          onRequestAI={() => getAIComment(result)}
        />
      )}
    </div>
  )
}

// ─── UPLOAD STEP ─────────────────────────────────────────────────────────────
function UploadStep({ onFile, file, preview }: { onFile: (f: File) => void; file: File | null; preview: any }) {
  return (
    <div>
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '40px 32px', border: '2px dashed var(--color-border-secondary)',
        borderRadius: 10, background: 'var(--color-background-secondary)', cursor: 'pointer',
        transition: 'border-color 0.2s', marginBottom: 16,
      }}>
        <span style={{ fontSize: 40 }}>📂</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {file ? file.name : 'CSV veya Excel dosyası seçin'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            veya sürükleyip bırakın · CSV, XLSX
          </div>
        </div>
        <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </label>
      {preview && (
        <div style={{ padding: '12px 16px', background: '#E6F1FB', borderRadius: 8, fontSize: 13, color: '#185FA5' }}>
          ✅ {preview.rows} satır · {preview.columns} değişken yüklendi
          {preview.warnings?.map((w: string, i: number) => (
            <div key={i} style={{ color: '#854F0B', marginTop: 4 }}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── VARIABLES STEP ──────────────────────────────────────────────────────────
function VariablesStep({ preview, roles, setRoles, onNext, onBack, depVars, groupVars, indVars, covVars }: any) {
  const roleOptions: VarRole[] = ['dependent','independent','grouping','covariate','scale_item','id','ignore']
  const numericVars = preview?.variables?.filter((v: any) => ['continuous','ordinal','binary'].includes(v.type)) || []
  const categoricalVars = preview?.variables?.filter((v: any) => ['nominal','binary'].includes(v.type)) || []

  return (
    <div>
      {/* Özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Bağımlı', vars: depVars, color: '#185FA5' },
          { label: 'Grup', vars: groupVars, color: '#854F0B' },
          { label: 'Bağımsız', vars: indVars, color: '#3B6D11' },
          { label: 'Kovaryant', vars: covVars, color: '#534AB7' },
        ].map(({ label, vars, color }) => (
          <div key={label} style={{ padding: '10px 12px', background: 'var(--color-background-secondary)',
            borderRadius: 8, border: `1px solid ${vars.length > 0 ? color : 'var(--color-border-secondary)'}` }}>
            <div style={{ fontSize: 11, color: vars.length > 0 ? color : 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{vars.length > 0 ? vars.join(', ').substring(0, 30) : '—'}</div>
          </div>
        ))}
      </div>

      {/* Değişken tablosu */}
      <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--color-border-secondary)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#185FA5', color: '#fff' }}>
            <tr>
              {['Değişken', 'Tip', 'Eksik %', 'Benzersiz', 'Rol'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview?.variables?.map((v: any, i: number) => (
              <tr key={v.name} style={{ borderBottom: '1px solid var(--color-border-secondary)',
                background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                <td style={{ padding: '7px 12px', fontWeight: 500 }}>{v.name}</td>
                <td style={{ padding: '7px 12px' }}>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                    background: v.type === 'continuous' ? '#E6F1FB' : v.type === 'ordinal' ? '#EDE9F5' : '#FEF3E2',
                    color: v.type === 'continuous' ? '#185FA5' : v.type === 'ordinal' ? '#534AB7' : '#854F0B' }}>
                    {v.type}
                  </span>
                </td>
                <td style={{ padding: '7px 12px', color: v.missing_pct > 10 ? '#c53030' : 'var(--color-text-secondary)' }}>
                  %{v.missing_pct}
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--color-text-secondary)' }}>{v.unique_count}</td>
                <td style={{ padding: '7px 12px' }}>
                  <select value={roles[v.name] || 'ignore'}
                    onChange={e => setRoles({ ...roles, [v.name]: e.target.value as VarRole })}
                    style={{ fontSize: 11, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--color-border-secondary)',
                      color: ROLE_COLORS[roles[v.name] as VarRole || 'ignore'], background: 'transparent', cursor: 'pointer' }}>
                    {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onBack} style={btnStyle('secondary')}>← Geri</button>
        <button onClick={onNext} disabled={depVars.length === 0}
          style={btnStyle('primary', depVars.length === 0)}>
          Varsayım Testleri → Test Seç
        </button>
      </div>
    </div>
  )
}

// ─── TEST SELECT STEP ─────────────────────────────────────────────────────────
function TestSelectStep({ assumptions, recommendation, selectedTest, setSelectedTest,
  testOptions, setTestOptions, muValue, setMuValue, depVars, groupVars, indVars, covVars,
  onRun, onBack }: any) {

  const familyGroups = ['parametric', 'nonparametric', 'anova', 'correlation', 'regression']

  return (
    <div>
      {/* Varsayım Sonuçları */}
      {assumptions && (
        <div style={{ padding: 16, borderRadius: 10, border: '1px solid', marginBottom: 20,
          ...verdictStyle(assumptions.overall_verdict) }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Varsayım Testi Sonucu</div>
          <div style={{ fontSize: 13 }}>{verdictText(assumptions.overall_verdict)}</div>
          {assumptions.normality?.map((n: any, i: number) => (
            <div key={i} style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
              {n.severity === 'violation' ? '❌' : n.severity === 'warning' ? '⚠️' : '✅'} {n.interpretation_tr}
            </div>
          ))}
          {assumptions.homogeneity?.map((h: any, i: number) => (
            <div key={i} style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
              {h.severity === 'violation' ? '❌' : '✅'} {h.interpretation_tr}
            </div>
          ))}
        </div>
      )}

      {/* AI Önerisi */}
      {recommendation && (
        <div style={{ padding: 16, background: 'rgba(24,95,165,0.08)', border: '1px solid #185FA5',
          borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
            🤖 ÖNERİLEN TEST
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#185FA5', marginBottom: 6 }}>
            {recommendation.recommended_test}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            {recommendation.reason_tr}
          </div>
          {recommendation.warnings?.map((w: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: '#854F0B' }}>⚠ {w}</div>
          ))}
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Güven: %{Math.round((recommendation.confidence || 0) * 100)} · 
            Alternatifler: {recommendation.alternative_tests?.join(', ')}
          </div>
        </div>
      )}

      {/* Test Seçimi */}
      {familyGroups.map(family => (
        <div key={family} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: FAMILY_COLORS[family],
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {FAMILY_LABELS[family]}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {TEST_DEFINITIONS.filter(t => t.family === family).map(test => {
              const isRecommended = recommendation?.recommended_test_id === test.id
              const isSelected = selectedTest === test.id
              return (
                <div key={test.id} onClick={() => setSelectedTest(test.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${isSelected ? FAMILY_COLORS[family] : isRecommended ? '#185FA5' : 'var(--color-border-secondary)'}`,
                    background: isSelected ? `${FAMILY_COLORS[family]}15` : isRecommended ? 'rgba(24,95,165,0.05)' : 'var(--color-background-secondary)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{test.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? FAMILY_COLORS[family] : 'var(--color-text-primary)' }}>
                      {test.label}
                    </span>
                    {isRecommended && <span style={{ fontSize: 10, background: '#185FA5', color: '#fff', padding: '1px 5px', borderRadius: 10 }}>✓ Önerilen</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{test.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    Etki: {test.effect}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Seçili test ayarları */}
      {selectedTest && (
        <div style={{ padding: 16, background: 'var(--color-background-secondary)', borderRadius: 10, border: '1px solid var(--color-border-secondary)', marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Seçili: {TEST_DEFINITIONS.find(t => t.id === selectedTest)?.label} — Ayarlar
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Anlamlılık Düzeyi (α)</label>
              <select value={testOptions.alpha} onChange={e => setTestOptions({ ...testOptions, alpha: parseFloat(e.target.value) })}
                style={selectStyle()}>
                <option value="0.05">0.05</option>
                <option value="0.01">0.01</option>
                <option value="0.10">0.10</option>
              </select>
            </div>
            {selectedTest === 'one_sample' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Test Değeri (μ₀)</label>
                <input type="number" value={muValue} onChange={e => setMuValue(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-secondary)', fontSize: 13, width: 100 }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rapor Dili</label>
              <select value={testOptions.language} onChange={e => setTestOptions({ ...testOptions, language: e.target.value })}
                style={selectStyle()}>
                <option value="both">TR + EN</option>
                <option value="tr">Sadece TR</option>
                <option value="en">Sadece EN</option>
              </select>
            </div>
          </div>
          {/* Varsayımlar hatırlatması */}
          {TEST_DEFINITIONS.find(t => t.id === selectedTest)?.assumptions?.length! > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              📋 Bu test için kontrol edilmesi gereken varsayımlar: {' '}
              {TEST_DEFINITIONS.find(t => t.id === selectedTest)?.assumptions?.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={onBack} style={btnStyle('secondary')}>← Geri</button>
        <button onClick={onRun} disabled={!selectedTest} style={btnStyle('primary', !selectedTest)}>
          ▶ Analizi Çalıştır
        </button>
      </div>
    </div>
  )
}

// ─── RESULT STEP ─────────────────────────────────────────────────────────────
function ResultStep({ result, aiComment, aiLoading, onNewAnalysis, onRequestAI }: any) {
  const [activeTab, setActiveTab] = useState<'results'|'apa'|'posthoc'|'ai'>('results')

  const tabs = [
    { id: 'results', label: 'Sonuçlar' },
    { id: 'apa', label: 'APA 7 Raporu' },
    ...(result.posthoc_results?.length > 0 ? [{ id: 'posthoc', label: 'Post-hoc' }] : []),
    { id: 'ai', label: '🤖 AI Yorum' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{result.analysis_name}</h3>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Test: {result.test_used}</div>
        </div>
        <button onClick={onNewAnalysis} style={btnStyle('secondary')}>← Yeni Analiz</button>
      </div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border-secondary)', marginBottom: 16 }}>
        {tabs.map((t: any) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === t.id ? 700 : 400, fontSize: 13,
              color: activeTab === t.id ? '#185FA5' : 'var(--color-text-secondary)',
              borderBottom: activeTab === t.id ? '2px solid #185FA5' : '2px solid transparent',
              marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Ana Sonuçlar */}
      {activeTab === 'results' && (
        <div>
          {/* İstatistikler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {Object.entries(result.main_results || {})
              .filter(([k, v]) => typeof v !== 'object' && v !== null)
              .map(([k, v]) => (
                <div key={k} style={{ padding: '10px 12px', background: 'var(--color-background-secondary)',
                  borderRadius: 8, border: '1px solid var(--color-border-secondary)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{
                    fontSize: 16, fontWeight: 700,
                    color: k === 'significant' ? (v ? '#3B6D11' : '#c53030') : 'var(--color-text-primary)'
                  }}>
                    {k === 'significant' ? (v ? 'Anlamlı ✓' : 'Anlamlı Değil') : String(v)}
                  </div>
                </div>
              ))}
          </div>

          {/* Etki büyüklüğü */}
          {result.effect_size?.length > 0 && (
            <div style={{ padding: 16, background: 'var(--color-background-secondary)', borderRadius: 8, border: '1px solid var(--color-border-secondary)', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#185FA5' }}>ETKİ BÜYÜKLÜĞü</div>
              {result.effect_size.map((es: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  borderBottom: '1px solid var(--color-border-secondary)', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{es.name}</span>
                  <span>
                    <strong style={{ color: '#185FA5' }}>{es.value}</strong>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>({es.interpretation})</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tanımlayıcı istatistikler */}
          {result.descriptive_statistics?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#185FA5' }}>TANIMLAYICI İSTATİSTİKLER</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#185FA5', color: '#fff' }}>
                      {['Değişken', 'Grup', 'n', 'Ort.', 'SS', 'Min', 'Max', 'Ortanca'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.descriptive_statistics.map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-secondary)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                        <td style={{ padding: '6px 10px', fontSize: 11 }}>{s.variable}</td>
                        <td style={{ padding: '6px 10px' }}>{s.group || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{s.n}</td>
                        <td style={{ padding: '6px 10px' }}>{s.mean?.toFixed(3)}</td>
                        <td style={{ padding: '6px 10px' }}>{s.std?.toFixed(3)}</td>
                        <td style={{ padding: '6px 10px' }}>{s.min?.toFixed(2)}</td>
                        <td style={{ padding: '6px 10px' }}>{s.max?.toFixed(2)}</td>
                        <td style={{ padding: '6px 10px' }}>{s.median?.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Uyarılar */}
          {result.warnings?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {(Array.isArray(result.warnings) ? result.warnings : [result.warnings]).map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#854F0B', marginBottom: 4 }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APA 7 Raporu */}
      {activeTab === 'apa' && (
        <div>
          {result.apa7_tr && (
            <div style={{ padding: 20, background: 'var(--color-background-secondary)', borderRadius: 10,
              border: '1px solid var(--color-border-secondary)', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 10, letterSpacing: 1 }}>
                TÜRKÇE — APA 7
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0, fontStyle: 'italic', color: 'var(--color-text-primary)' }}>
                {result.apa7_tr}
              </p>
              <button onClick={() => navigator.clipboard.writeText(result.apa7_tr)}
                style={{ ...btnStyle('secondary'), marginTop: 12, fontSize: 11 }}>📋 Kopyala</button>
            </div>
          )}
          {result.apa7_en && (
            <div style={{ padding: 20, background: 'var(--color-background-secondary)', borderRadius: 10, border: '1px solid var(--color-border-secondary)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 10, letterSpacing: 1 }}>
                ENGLISH — APA 7
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0, fontStyle: 'italic', color: 'var(--color-text-primary)' }}>
                {result.apa7_en}
              </p>
              <button onClick={() => navigator.clipboard.writeText(result.apa7_en)}
                style={{ ...btnStyle('secondary'), marginTop: 12, fontSize: 11 }}>📋 Copy</button>
            </div>
          )}
        </div>
      )}

      {/* Post-hoc */}
      {activeTab === 'posthoc' && result.posthoc_results?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 12 }}>POST-HOC ANALİZİ</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#185FA5', color: '#fff' }}>
                {['Grup 1', 'Grup 2', 'Ort. Fark', 'p', 'p (düz.)', 'Anlamlı?'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.posthoc_results.map((ph: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border-secondary)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                  <td style={{ padding: '8px 12px' }}>{ph.group1}</td>
                  <td style={{ padding: '8px 12px' }}>{ph.group2}</td>
                  <td style={{ padding: '8px 12px' }}>{ph.mean_diff?.toFixed(4) ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{ph.p_value?.toFixed(4)}</td>
                  <td style={{ padding: '8px 12px' }}>{ph.p_adjusted?.toFixed(4) ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: ph.significant ? '#3B6D11' : '#c53030', fontWeight: 600 }}>
                    {ph.significant ? 'Evet *' : 'Hayır'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Yorum */}
      {activeTab === 'ai' && (
        <div>
          {aiLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#185FA5' }}>🤖 AI yorumu hazırlanıyor...</div>
          ) : aiComment ? (
            <div style={{ padding: 20, background: 'rgba(24,95,165,0.06)', borderRadius: 10, border: '1px solid #185FA5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 10, letterSpacing: 1 }}>
                🤖 AI AKADEMİK YORUM
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0, color: 'var(--color-text-primary)' }}>
                {aiComment}
              </p>
              <button onClick={() => navigator.clipboard.writeText(aiComment)}
                style={{ ...btnStyle('secondary'), marginTop: 12, fontSize: 11 }}>📋 Kopyala</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <button onClick={onRequestAI} style={btnStyle('primary')}>🤖 AI Yorum Al</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── STYLE HELPERS ───────────────────────────────────────────────────────────
function btnStyle(variant: 'primary' | 'secondary', disabled = false): React.CSSProperties {
  return {
    padding: '9px 18px', borderRadius: 7, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
    opacity: disabled ? 0.5 : 1,
    ...(variant === 'primary'
      ? { background: '#185FA5', color: '#fff' }
      : { background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-secondary)' }),
  }
}

function selectStyle(): React.CSSProperties {
  return {
    padding: '6px 10px', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-secondary)', borderRadius: 6, fontSize: 13, cursor: 'pointer',
  }
}

function verdictStyle(verdict: string): React.CSSProperties {
  const map: Record<string, any> = {
    parametric_ok:    { background: '#F0FFF4', borderColor: '#3B6D11', color: '#276749' },
    use_welch:        { background: '#FFFBEB', borderColor: '#854F0B', color: '#744210' },
    use_nonparametric:{ background: '#FFF5F5', borderColor: '#c53030', color: '#742a2a' },
    check_manually:   { background: '#EEF2FF', borderColor: '#534AB7', color: '#3730a3' },
  }
  return map[verdict] || { background: 'var(--color-background-secondary)', borderColor: 'var(--color-border-secondary)', color: 'var(--color-text-primary)' }
}

function verdictText(verdict: string): string {
  const map: Record<string, string> = {
    parametric_ok:    '✅ Normallik ve homojenlik varsayımları sağlanıyor. Parametrik testler kullanılabilir.',
    use_welch:        '⚠️ Normallik sağlanıyor ancak varyanslar eşit değil. Welch düzeltmesi önerilir.',
    use_nonparametric:'❌ Normallik varsayımı ihlal edilmiş. Non-parametrik testler kullanılmalıdır.',
    check_manually:   '🔍 Karışık sonuçlar. Manuel değerlendirme gereklidir.',
  }
  return map[verdict] || verdict
}
