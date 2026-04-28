import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

const BASE = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'http://localhost:8002'

export default function StatisticsModule() {
  const { project } = useAppStore()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [depVar, setDepVar] = useState('')
  const [groupVar, setGroupVar] = useState('')
  const [testType, setTestType] = useState('independent')

  const upload = async (f: File) => {
    setLoading(true); setError(null)
    try {
      const form = new FormData(); form.append('file', f)
      const res = await fetch(`${BASE}/statistics/upload-preview`, { method: 'POST', body: form })
      const data = await res.json()
      setPreview(data)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const runTest = async () => {
    if (!depVar) return setError('Bağımlı değişken seçin.')
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BASE}/statistics/t-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependent_variable: depVar,
          group_variable: groupVar || null,
          covariates: [], language: 'both', alpha: 0.05,
          test_type: testType
        })
      })
      const data = await res.json()
      setResult(data)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const numericVars = preview?.variables?.filter((v: any) =>
    v.type === 'continuous' || v.type === 'ordinal'
  ) || []
  const groupVars = preview?.variables?.filter((v: any) =>
    v.type === 'binary' || v.type === 'nominal' || v.type === 'ordinal'
  ) || []

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 500 }}>İstatistiksel Analizler</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px' }}>
        t-Testi, ANOVA, Non-parametrik testler, Korelasyon, Regresyon · APA 7 otomatik rapor
      </p>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7',
          borderRadius: 8, color: '#c53030', fontSize: 13, marginBottom: 16 }}>
          ⚠ {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#c53030' }}>✕</button>
        </div>
      )}

      {/* Veri Yükleme */}
      <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 20, marginBottom: 20, border: '1px solid #e9ecef' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>1. Veri Yükle</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          padding: '12px 16px', border: '2px dashed #dee2e6', borderRadius: 8,
          background: 'white', transition: 'border-color 0.2s' }}>
          <span style={{ fontSize: 24 }}>📂</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{file ? file.name : 'CSV veya Excel dosyası seçin'}</div>
            <div style={{ fontSize: 12, color: '#868e96' }}>veya sürükleyip bırakın</div>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); upload(f) } }} />
        </label>
        {preview && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#495057' }}>
            ✅ {preview.rows} satır · {preview.columns} değişken yüklendi
            {preview.warnings?.map((w: string, i: number) => (
              <div key={i} style={{ color: '#e67700', marginTop: 4 }}>⚠ {w}</div>
            ))}
          </div>
        )}
      </div>

      {/* Değişken Seçimi */}
      {preview && (
        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 20, marginBottom: 20, border: '1px solid #e9ecef' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>2. Değişken & Test Seç</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>
                Bağımlı Değişken *
              </label>
              <select value={depVar} onChange={e => setDepVar(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ced4da', fontSize: 13 }}>
                <option value="">— Seçin —</option>
                {numericVars.map((v: any) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>
                Grup Değişkeni
              </label>
              <select value={groupVar} onChange={e => setGroupVar(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ced4da', fontSize: 13 }}>
                <option value="">— Opsiyonel —</option>
                {groupVars.map((v: any) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>
                Test Tipi
              </label>
              <select value={testType} onChange={e => setTestType(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ced4da', fontSize: 13 }}>
                <option value="independent">Bağımsız t-Testi</option>
                <option value="welch">Welch t-Testi</option>
                <option value="paired">Eşleştirilmiş t-Testi</option>
                <option value="one_sample">Tek Örneklem t-Testi</option>
              </select>
            </div>
          </div>
          <button onClick={runTest} disabled={loading || !depVar}
            style={{ marginTop: 16, padding: '10px 24px', background: '#185FA5', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              opacity: loading || !depVar ? 0.6 : 1 }}>
            {loading ? '⚙️ Analiz yapılıyor...' : '▶ Analizi Çalıştır'}
          </button>
        </div>
      )}

      {/* Sonuçlar */}
      {result && (
        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 20, border: '1px solid #e9ecef' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>
            3. Sonuçlar — {result.analysis_name}
          </h3>

          {/* Ana sonuçlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
            {Object.entries(result.main_results || {})
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => (
                <div key={k} style={{ background: 'white', borderRadius: 8, padding: '10px 12px',
                  border: '1px solid #dee2e6', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#868e96', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#212529' }}>{String(v)}</div>
                </div>
              ))}
          </div>

          {/* Etki büyüklüğü */}
          {result.effect_size?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#495057', marginBottom: 8 }}>ETKİ BÜYÜKLÜĞü</div>
              {result.effect_size.map((es: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: '1px solid #e9ecef', fontSize: 13 }}>
                  <span>{es.name}</span>
                  <span><strong>{es.value}</strong> <span style={{ color: '#868e96' }}>({es.interpretation})</span></span>
                </div>
              ))}
            </div>
          )}

          {/* APA 7 */}
          {result.apa7_tr && (
            <div style={{ background: 'white', borderRadius: 8, padding: 16,
              border: '1px solid #dee2e6', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 8, letterSpacing: 1 }}>
                APA 7 RAPORU (TR)
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, fontStyle: 'italic', color: '#212529' }}>
                {result.apa7_tr}
              </p>
            </div>
          )}
          {result.apa7_en && (
            <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #dee2e6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 8, letterSpacing: 1 }}>
                APA 7 REPORT (EN)
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, fontStyle: 'italic', color: '#212529' }}>
                {result.apa7_en}
              </p>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {result.warnings.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#e67700' }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
