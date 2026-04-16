// ============================================================
// ScaleMind AI — Rapor Modülü
// Tüm analiz sonuçlarını PDF ve Word olarak dışa aktarır
// ============================================================
import React, { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

const BASE_URL = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'https://scalemind-ai-production.up.railway.app'

interface StepSummary {
  id: string
  label: string
  status: string
  hasData: boolean
}

export default function ReportingModule() {
  const { project } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [reportTitle, setReportTitle] = useState('Psikometrik Analiz Raporu')
  const [authorName, setAuthorName] = useState('')
  const [institution, setInstitution] = useState('')

  const steps = project?.steps ?? []
  const completedSteps = steps.filter((s) => s.status === 'completed')

  const stepSummaries: StepSummary[] = steps.map((s) => ({
    id: s.id,
    label: s.labelTr,
    status: s.status,
    hasData: !!s.result,
  }))

  const handleGeneratePDF = async () => {
    setIsGenerating(true)
    try {
      // Tüm tamamlanan adımların sonuçlarını topla
      const reportData: Record<string, unknown> = {
        title: reportTitle,
        author: authorName,
        institution,
        dataset: project?.dataset ? {
          rows: project.dataset.rows,
          cols: project.dataset.cols,
          name: project.dataset.name,
        } : null,
      }

      steps.forEach((step) => {
        if (step.result?.data) {
          const keyMap: Record<string, string> = {
            'reliability': 'reliability',
            'content-validity': 'contentValidity',
            'efa': 'efa',
            'cfa': 'cfa',
            'normality': 'normality',
            'item-analysis': 'itemAnalysis',
          }
          const key = keyMap[step.id]
          if (key) reportData[key] = step.result.data
        }
      })

      const res = await fetch(`${BASE_URL}/report/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      })

      if (!res.ok) throw new Error('PDF üretilemedi')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setGenerated(true)
    } catch (err) {
      alert(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Akademik Rapor Üretimi
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
        Tamamlanan analizleri APA 7 uyumlu PDF raporu olarak dışa aktarın.
      </p>

      {/* Tamamlanan Adımlar */}
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: 16, marginBottom: 20, border: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>
          Rapora Eklenecek Analizler
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stepSummaries.map((step) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
                background: step.status === 'completed' ? '#EAF3DE' : 'var(--color-background-secondary)',
                color: step.status === 'completed' ? '#3B6D11' : '#B4B2A9',
                border: `1.5px solid ${step.status === 'completed' ? '#97C459' : '#D3D1C7'}`,
              }}>
                {step.status === 'completed' ? '✓' : '○'}
              </span>
              <span style={{
                fontSize: 13,
                color: step.status === 'completed' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: step.status === 'completed' ? 500 : 400,
              }}>
                {step.label}
              </span>
              {step.status === 'completed' && step.hasData && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11' }}>
                  Veri mevcut
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rapor Bilgileri */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 16 }}>Rapor Bilgileri</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Rapor Başlığı</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Yazar Adı (opsiyonel)</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ad Soyad"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Kurum (opsiyonel)</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Üniversite / Kurum adı"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* Dışa Aktarma Butonları */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={handleGeneratePDF}
          disabled={isGenerating || completedSteps.length === 0}
          style={{
            padding: '12px 28px',
            background: isGenerating ? '#888' : '#185FA5',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 500,
            cursor: isGenerating || completedSteps.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {isGenerating ? 'PDF Oluşturuluyor...' : '📄 PDF İndir'}
        </button>
      </div>

      {generated && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', borderRadius: 8, border: '0.5px solid #C0DD97', fontSize: 13, color: '#27500A' }}>
          ✓ Rapor başarıyla indirildi!
        </div>
      )}

      {completedSteps.length === 0 && (
        <div style={{ padding: '10px 14px', background: '#FAEEDA', borderRadius: 8, border: '0.5px solid #EF9F27', fontSize: 13, color: '#633806' }}>
          ⚠ Rapor oluşturmak için en az bir analiz tamamlanmış olmalıdır.
        </div>
      )}
    </div>
  )
}
