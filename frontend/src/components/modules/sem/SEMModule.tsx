// ============================================================
// ScaleMind AI — SEM Görsel Editör
// React Flow tabanlı AMOS benzeri yol diyagramı
// Latent (oval) + Observed (dikdörtgen) + Hata terimleri
// ============================================================
import React, { useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../../../store/useAppStore'
import { runCFA } from '../../../lib/api'

// ------ Tip tanımları ------
type SEMNodeType = 'latent' | 'observed' | 'error'

interface SEMNodeData {
  label: string
  nodeType: SEMNodeType
  [key: string]: unknown
}

// ------ Özel Node Bileşenleri ------

// Latent değişken — Oval
function LatentNode({ data, selected }: { data: SEMNodeData; selected?: boolean }) {
  return (
    <div style={{
      width: 110, height: 70,
      borderRadius: '50%',
      background: selected ? '#E6F1FB' : '#EEEDFE',
      border: `2px solid ${selected ? '#185FA5' : '#534AB7'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 500,
      color: '#3C3489',
      cursor: 'grab',
      boxShadow: selected ? '0 0 0 2px #185FA5' : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#534AB7', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#534AB7', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#534AB7', width: 8, height: 8, left: '50%' }} />
      <Handle type="target" position={Position.Top} style={{ background: '#534AB7', width: 8, height: 8, left: '50%' }} />
      <span style={{ textAlign: 'center', padding: '0 8px', wordBreak: 'break-word' }}>{data.label}</span>
    </div>
  )
}

// Gözlenen değişken — Dikdörtgen
function ObservedNode({ data, selected }: { data: SEMNodeData; selected?: boolean }) {
  return (
    <div style={{
      width: 100, height: 50,
      borderRadius: 4,
      background: selected ? '#E6F1FB' : '#FFFFFF',
      border: `2px solid ${selected ? '#185FA5' : '#378ADD'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 500,
      color: '#185FA5',
      cursor: 'grab',
      boxShadow: selected ? '0 0 0 2px #185FA5' : '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#378ADD', width: 7, height: 7 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#378ADD', width: 7, height: 7 }} />
      <Handle type="target" position={Position.Top} style={{ background: '#378ADD', width: 7, height: 7 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#378ADD', width: 7, height: 7 }} />
      <span style={{ textAlign: 'center', padding: '0 6px', wordBreak: 'break-word' }}>{data.label}</span>
    </div>
  )
}

// Hata terimi — Küçük daire
function ErrorNode({ data }: { data: SEMNodeData }) {
  return (
    <div style={{
      width: 36, height: 36,
      borderRadius: '50%',
      background: '#F1EFE8',
      border: '1.5px solid #B4B2A9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: '#888780',
      cursor: 'grab',
    }}>
      <Handle type="source" position={Position.Right} style={{ background: '#888780', width: 6, height: 6 }} />
      <span>{data.label}</span>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  latent: LatentNode as never,
  observed: ObservedNode as never,
  error: ErrorNode as never,
}

// ------ Eğitim İçeriği ------
function EducationPanel() {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, marginTop: 0 }}>SEM Editörü Nasıl Kullanılır?</h3>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li><strong>Oval</strong> — Latent (gizil) değişken</li>
        <li><strong>Dikdörtgen</strong> — Gözlenen değişken (madde)</li>
        <li><strong>Küçük daire</strong> — Hata terimi</li>
        <li>Düğümleri sürükleyerek yerleştirin</li>
        <li>Bağlantı noktasından sürükleyerek ok çizin</li>
        <li>Seçili düğümü Delete ile silin</li>
      </ul>
    </div>
  )
}

// ------ Ana Bileşen ------
function SEMEditorInner() {
  const { project, setStepResult } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SEMNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [showEducation, setShowEducation] = useState(false)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const nodeIdRef = useRef(1)

  const dataset = project?.dataset
  const likertItems = dataset?.variables.filter((v) => v.type === 'likert').map((v) => v.name) ?? []

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({
      ...connection,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#534AB7', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' as never, color: '#534AB7' },
    }, eds)),
    [setEdges]
  )

  const addNode = (type: SEMNodeType, label?: string) => {
    const id = `node_${nodeIdRef.current++}`
    const prefix = type === 'latent' ? 'F' : type === 'error' ? 'e' : 'V'
    const lbl = label || newNodeLabel || `${prefix}${nodeIdRef.current}`
    const newNode: Node<SEMNodeData> = {
      id,
      type,
      position: { x: 150 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: lbl, nodeType: type },
    }
    setNodes((nds) => [...nds, newNode])
    setNewNodeLabel('')
  }

  // EFA/CFA faktörlerinden otomatik model oluştur
  const autoLoadFromEFA = () => {
    const efaResult = project?.steps.find((s) => s.id === 'efa')?.result?.data as {
      factorItemMap?: Record<string, string[]>
    } | undefined

    if (!efaResult?.factorItemMap) {
      alert('Önce EFA analizi yapın')
      return
    }

    const newNodes: Node<SEMNodeData>[] = []
    const newEdges: Edge[] = []
    let nodeId = 1

    const factorEntries = Object.entries(efaResult.factorItemMap).slice(0, 6)
    const xStart = 300

    factorEntries.forEach(([factor, items], fi) => {
      const latentId = `latent_${fi}`
      const yFactor = 80 + fi * 180

      newNodes.push({
        id: latentId,
        type: 'latent',
        position: { x: xStart, y: yFactor },
        data: { label: factor, nodeType: 'latent' },
      })

      const validItems = Array.isArray(items) ? items.slice(0, 4) : []
      validItems.forEach((item, ii) => {
        const obsId = `obs_${nodeId++}`
        const errId = `err_${nodeId++}`
        const xObs = xStart + 200
        const yObs = yFactor - (validItems.length * 30) + ii * 60

        newNodes.push({
          id: obsId,
          type: 'observed',
          position: { x: xObs, y: yObs },
          data: { label: item, nodeType: 'observed' },
        })
        newNodes.push({
          id: errId,
          type: 'error',
          position: { x: xObs + 130, y: yObs + 7 },
          data: { label: `e${nodeId}`, nodeType: 'error' },
        })

        newEdges.push({
          id: `e_lat_${latentId}_${obsId}`,
          source: latentId, target: obsId,
          type: 'smoothstep', animated: false,
          style: { stroke: '#534AB7', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as never, color: '#534AB7' },
        })
        newEdges.push({
          id: `e_err_${errId}_${obsId}`,
          source: errId, target: obsId,
          type: 'smoothstep', animated: false,
          style: { stroke: '#B4B2A9', strokeWidth: 1 },
          markerEnd: { type: 'arrowclosed' as never, color: '#B4B2A9' },
        })
      })

      // Faktörler arası kovaryans (öncekiyle)
      if (fi > 0) {
        newEdges.push({
          id: `e_cov_${fi}`,
          source: `latent_${fi - 1}`,
          target: latentId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#3B6D11', strokeWidth: 1.5, strokeDasharray: '5,3' },
        })
      }
    })

    nodeIdRef.current = nodeId
    setNodes(newNodes)
    setEdges(newEdges)
  }

  // Diyagramdan CFA modeli çıkar ve çalıştır
  const handleRunSEM = async () => {
    const rawData = JSON.parse(sessionStorage.getItem('scalemind_rawdata') || '{}')
    setIsRunning(true)
    setWarnings([])
    try {
      // Latent → Observed ilişkilerinden model kur
      const latentNodes = nodes.filter((n) => n.data.nodeType === 'latent')
      const factors: { name: string; items: string[] }[] = []

      latentNodes.forEach((latent) => {
        const items = edges
          .filter((e) => e.source === latent.id)
          .map((e) => nodes.find((n) => n.id === e.target))
          .filter((n) => n?.data.nodeType === 'observed')
          .map((n) => n!.data.label as string)
          .filter((label) => likertItems.includes(label))

        if (items.length >= 2) {
          factors.push({ name: latent.data.label as string, items })
        }
      })

      if (factors.length === 0) {
        setWarnings(['Model geçersiz: En az bir latent değişken ve ona bağlı 2+ gözlenen değişken olmalı'])
        return
      }

      const data: Record<string, number[]> = {}
      const allItems = factors.flatMap((f) => f.items)
      for (const item of allItems) {
        const vals = rawData[item] ?? []
        data[item] = vals.filter((v: unknown) => v !== null && !isNaN(Number(v))).map(Number)
      }

      const res = await runCFA(data, {
        factors,
        correlatedFactors: true,
        estimator: 'mlr',
      }) as { result: Record<string, unknown> & { warnings?: string[] } }

      setResult(res.result)
      setWarnings(res.result.warnings ?? [])
      setStepResult('sem', {
        type: 'sem',
        data: res.result,
        warnings: res.result.warnings ?? [],
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setWarnings([`SEM hatası: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setIsRunning(false)
    }
  }

  const fit = result?.fit as Record<string, number> | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          Yapısal Eşitlik Modeli (SEM)
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          AMOS benzeri görsel editör · Sürükle-bırak model kurma · lavaan analizi
        </p>
      </div>

      {/* Uyarılar */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FAEEDA', borderRadius: 8, border: '0.5px solid #EF9F27' }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#633806' }}>⚠ {w}</div>
          ))}
        </div>
      )}

      {/* Araç Çubuğu */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12,
        padding: '10px 12px', background: 'var(--color-background-secondary)',
        borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Değişken adı..."
          value={newNodeLabel}
          onChange={(e) => setNewNodeLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNode('observed')}
          style={{ fontSize: 12, padding: '5px 8px', borderRadius: 4, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', width: 130 }}
        />
        <button onClick={() => addNode('latent')} style={{ padding: '5px 10px', borderRadius: 20, border: '2px solid #534AB7', background: '#EEEDFE', color: '#3C3489', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
          + Latent (Oval)
        </button>
        <button onClick={() => addNode('observed')} style={{ padding: '5px 10px', borderRadius: 4, border: '2px solid #378ADD', background: '#E6F1FB', color: '#185FA5', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
          + Gözlenen (□)
        </button>
        <button onClick={() => addNode('error')} style={{ padding: '5px 10px', borderRadius: 20, border: '1.5px solid #B4B2A9', background: '#F1EFE8', color: '#888780', fontSize: 11, cursor: 'pointer' }}>
          + Hata (○)
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--color-border-tertiary)', margin: '0 4px' }} />

        <button onClick={autoLoadFromEFA} style={{ padding: '5px 10px', borderRadius: 4, border: '0.5px solid #97C459', background: '#EAF3DE', color: '#3B6D11', fontSize: 11, cursor: 'pointer' }}>
          EFA'dan Yükle ✨
        </button>

        <button onClick={() => { setNodes([]); setEdges([]) }} style={{ padding: '5px 10px', borderRadius: 4, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer' }}>
          Temizle
        </button>

        <button onClick={() => setShowEducation(!showEducation)} style={{ padding: '5px 10px', borderRadius: 4, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer' }}>
          {showEducation ? 'Gizle ?' : 'Yardım ?'}
        </button>

        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleRunSEM}
            disabled={isRunning || nodes.length === 0}
            style={{
              padding: '6px 16px', borderRadius: 6,
              background: isRunning ? '#888' : '#185FA5',
              color: 'white', border: 'none', fontSize: 12, fontWeight: 500,
              cursor: isRunning || nodes.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {isRunning ? 'Analiz Çalışıyor...' : '▶ SEM Analizi Başlat'}
          </button>
        </div>
      </div>

      {showEducation && (
        <div style={{ marginBottom: 12, padding: '12px 16px', background: 'var(--color-background-secondary)', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)' }}>
          <EducationPanel />
        </div>
      )}

      {/* React Flow Canvas */}
      <div style={{ flex: 1, minHeight: 500, border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden', background: '#FAFAFA' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E0DED8" />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as SEMNodeData
              if (d.nodeType === 'latent') return '#534AB7'
              if (d.nodeType === 'observed') return '#185FA5'
              return '#B4B2A9'
            }}
            style={{ background: 'white', border: '0.5px solid #E0DED8' }}
          />
          <Panel position="top-right">
            <div style={{ background: 'white', padding: '6px 10px', borderRadius: 6, border: '0.5px solid #E0DED8', fontSize: 10, color: '#888' }}>
              {nodes.length} düğüm · {edges.length} bağlantı
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* SEM Sonuçları */}
      {result && fit && (
        <div style={{ marginTop: 16, background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>SEM Uyum İndeksleri</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            {[
              { label: 'CFI', value: fit.cfi, ok: fit.cfi >= 0.90 },
              { label: 'TLI', value: fit.tli, ok: fit.tli >= 0.90 },
              { label: 'RMSEA', value: fit.rmsea, ok: fit.rmsea <= 0.08 },
              { label: 'SRMR', value: fit.srmr, ok: (fit.srmr ?? 1) <= 0.10 },
            ].map((ind) => (
              <div key={ind.label} style={{
                background: ind.ok ? '#EAF3DE' : '#FCEBEB',
                borderRadius: 6, padding: '8px 10px',
                border: `0.5px solid ${ind.ok ? '#C0DD97' : '#F09595'}`,
              }}>
                <div style={{ fontSize: 10, color: ind.ok ? '#27500A' : '#A32D2D', marginBottom: 2 }}>{ind.label}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: ind.ok ? '#3B6D11' : '#A32D2D' }}>
                  {ind.value?.toFixed(3) ?? '—'}
                </div>
                <div style={{ fontSize: 9, color: ind.ok ? '#3B6D11' : '#A32D2D' }}>{ind.ok ? '✓' : '✕'}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            χ²({fit.df}) = {fit.chi2?.toFixed(3)}, p = {fit.pValue < 0.001 ? '< .001' : fit.pValue?.toFixed(3)} | χ²/df = {fit.chi2df?.toFixed(3)}
          </div>
        </div>
      )}
    </div>
  )
}

// React Flow Provider ile sar
export default function SEMModule() {
  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <ReactFlowProvider>
        <SEMEditorInner />
      </ReactFlowProvider>
    </div>
  )
}
