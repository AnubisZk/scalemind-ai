// ============================================================
// ScaleMind AI — Veri Yükleme Modülü
// ============================================================
import React, { useCallback, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { parseFile } from '../../../lib/parser'
import type { VariableType } from '../../../types'

const TYPE_LABELS: Record<VariableType, string> = {
  likert:       'Likert',
  continuous:   'Sürekli',
  categorical:  'Kategorik',
  binary:       'Binary',
  id:           'ID / No',
  demographic:  'Demografik',
}

const TYPE_COLORS: Record<VariableType, string> = {
  likert:       '#185FA5',
  continuous:   '#3B6D11',
  categorical:  '#854F0B',
  binary:       '#534AB7',
  id:           '#888780',
  demographic:  '#993556',
}

export default function UploadModule() {
  const { project, updateDataset, setStepResult, setActiveStep, setStepStatus, setLoading, loading } = useAppStore()
  const [warnings, setWarnings] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [rawData, setRawData] = useState<Record<string, (number | string | null)[]>>({})

  const dataset = project?.dataset

  const handleFile = useCallback(async (file: File) => {
    setLoading('upload', true)
    setWarnings([])
    try {
      const { dataset: ds, rawData: rd, warnings: warns } = await parseFile(file)
      ds.rawData = rd
      sessionStorage.setItem('scalemind_rawdata', JSON.stringify(rd))
      updateDataset(ds)
      setRawData(rd)
      setWarnings(warns)
      setStepStatus('upload', 'active')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dosya işlenemedi'
      setWarnings([`Hata: ${msg}`])
    } finally {
      setLoading('upload', false)
    }
  }, [updateDataset, setLoading, setStepStatus])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleContinue = () => {
    if (!dataset) return
    setStepResult('upload', {
      type: 'upload',
      data: { rows: dataset.rows, cols: dataset.cols, variables: dataset.variables },
      warnings,
      timestamp: new Date().toISOString(),
    })
    setActiveStep('preprocessing')
  }

  const toggleReversed = (name: string) => {
    const { updateVariable } = useAppStore.getState()
    const v = dataset?.variables.find((v) => v.name === name)
    if (v) updateVariable(name, { isReversed: !v.isReversed })
  }

  const changeType = (name: string, type: VariableType) => {
    const { updateVariable } = useAppStore.getState()
    updateVariable(name, { type })
  }

  const changeSubscale = (name: string, sub: string) => {
    const { updateVariable } = useAppStore.getState()
    updateVariable(name, { subscale: sub || undefined })
  }

  const isLoading = loading['upload']

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>Veri Yükleme</h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-secondary)' }}>
        CSV, XLSX veya TSV formatındaki veri setinizi yükleyin. Sistem değişken tiplerini otomatik algılar.
      </p>

      {/* Drop Zone */}
      {!dataset && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          style={{
            border: `2px dashed ${isDragging ? '#185FA5' : 'var(--color-border-secondary)'}`,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            background: isDragging ? '#E6F1FB' : 'var(--color-background-secondary)',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'all 0.15s',
          }}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input id="file-input" type="file" accept=".csv,.xlsx,.xls,.tsv" style={{ display: 'none' }} onChange={onFileInput} />
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
            {isLoading ? 'Dosya işleniyor...' : 'Dosyayı buraya sürükleyin veya tıklayın'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>CSV, XLSX, TSV — Maks 50 MB</div>
        </div>
      )}

      {/* Uyarılar */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FAEEDA', borderRadius: 8, border: '0.5px solid #EF9F27' }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 13, color: '#633806', display: 'flex', gap: 8, marginBottom: i < warnings.length - 1 ? 4 : 0 }}>
              <span>⚠</span><span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Özet Kartlar */}
      {dataset && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Katılımcı', value: dataset.rows.toLocaleString('tr-TR') },
              { label: 'Değişken', value: dataset.cols.toString() },
              { label: 'Eksik Veri', value: `%${(dataset.variables.reduce((a, v) => a + v.missingRate, 0) / dataset.variables.length * 100).toFixed(1)}` },
              { label: 'Likert Madde', value: dataset.variables.filter((v) => v.type === 'likert').length.toString() },
            ].map((card) => (
              <div key={card.label} style={{
                background: 'var(--color-background-secondary)',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Değişken Tablosu */}
          <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Değişken Yönetimi</span>
              <button
                onClick={() => (document.getElementById('file-input') as HTMLInputElement | null)?.click()}
                style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Değiştir
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)' }}>
                    {['Değişken', 'Tip', 'Ort.', 'SS', 'Eksik %', 'Ters', 'Alt Boyut'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.variables.map((v, i) => (
                    <tr key={v.name} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: i % 2 === 0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{v.name}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <select
                          value={v.type}
                          onChange={(e) => changeType(v.name, e.target.value as VariableType)}
                          style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 4,
                            border: `1px solid ${TYPE_COLORS[v.type]}`,
                            color: TYPE_COLORS[v.type],
                            background: 'transparent', cursor: 'pointer',
                          }}
                        >
                          {(Object.keys(TYPE_LABELS) as VariableType[]).map((t) => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '7px 12px', color: 'var(--color-text-secondary)' }}>{v.mean?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--color-text-secondary)' }}>{v.sd?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '7px 12px', color: v.missingRate > 0.05 ? '#A32D2D' : 'var(--color-text-secondary)' }}>
                        {(v.missingRate * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '7px 12px' }}>
                        {v.type === 'likert' && (
                          <input type="checkbox" checked={v.isReversed} onChange={() => toggleReversed(v.name)} />
                        )}
                      </td>
                      <td style={{ padding: '7px 12px' }}>
                        {v.type === 'likert' && (
                          <input
                            type="text"
                            placeholder="örn. F1"
                            defaultValue={v.subscale ?? ''}
                            onBlur={(e) => changeSubscale(v.name, e.target.value)}
                            style={{
                              width: 60, fontSize: 11, padding: '2px 6px',
                              borderRadius: 4, border: '0.5px solid var(--color-border-secondary)',
                              background: 'transparent', color: 'var(--color-text-primary)',
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Devam */}
          <button
            onClick={handleContinue}
            disabled={!dataset}
            style={{
              padding: '10px 28px',
              background: '#185FA5', color: 'white',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Ön İşlemeye Geç →
          </button>
        </>
      )}
    </div>
  )
}
