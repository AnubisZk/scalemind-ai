// ============================================================
// ScaleMind AI — Zustand Global State Store
// ============================================================
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type {
  Project,
  Dataset,
  AnalysisStepId,
  StepStatus,
  AnalysisResult,
  Variable,
} from '../types'

// ------ Adım tanımları (sıralı akış) ------
export const ANALYSIS_STEPS = [
  { id: 'upload' as AnalysisStepId,           labelTr: 'Veri Yükleme' },
  { id: 'preprocessing' as AnalysisStepId,    labelTr: 'Ön İşleme' },
  { id: 'normality' as AnalysisStepId,        labelTr: 'Normallik' },
  { id: 'item-analysis' as AnalysisStepId,    labelTr: 'Madde Analizi' },
  { id: 'reliability' as AnalysisStepId,      labelTr: 'Güvenirlik' },
  { id: 'content-validity' as AnalysisStepId, labelTr: 'Kapsam Geçerliliği' },
  { id: 'efa' as AnalysisStepId,              labelTr: 'AFA (EFA)' },
  { id: 'cfa' as AnalysisStepId,              labelTr: 'DFA (CFA)' },
  { id: 'sem' as AnalysisStepId,              labelTr: 'Yapısal Model' },
  { id: 'reporting' as AnalysisStepId,        labelTr: 'Rapor' },
]

interface AppState {
  // Mevcut proje
  project: Project | null
  activeStep: AnalysisStepId

  // UI durumu
  sidebarOpen: boolean
  expertMode: boolean
  language: 'tr' | 'en'

  // Yükleme durumları
  loading: Record<string, boolean>
  errors: Record<string, string>

  // Eylemler
  setProject: (project: Project) => void
  updateDataset: (dataset: Dataset) => void
  updateVariable: (name: string, changes: Partial<Variable>) => void
  setActiveStep: (step: AnalysisStepId) => void
  setStepStatus: (step: AnalysisStepId, status: StepStatus) => void
  setStepResult: (step: AnalysisStepId, result: AnalysisResult) => void
  setLoading: (key: string, value: boolean) => void
  setError: (key: string, message: string) => void
  clearError: (key: string) => void
  toggleSidebar: () => void
  toggleExpertMode: () => void
  setLanguage: (lang: 'tr' | 'en') => void
  resetProject: () => void
}

const createInitialProject = (): Project => ({
  id: Math.random().toString(36).slice(2) + Date.now().toString(36),
  name: 'Yeni Proje',
  steps: ANALYSIS_STEPS.map((s, i) => ({
    id: s.id,
    label: s.labelTr,
    labelTr: s.labelTr,
    status: i === 0 ? 'active' : 'pending',
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const useAppStore = create<AppState>()(
  persist(
    immer((set) => ({
      project: null,
      activeStep: 'upload',
      sidebarOpen: true,
      expertMode: false,
      language: 'tr',
      loading: {},
      errors: {},

      setProject: (project) =>
        set((state) => {
          state.project = project
          state.activeStep = 'upload'
        }),

      updateDataset: (dataset) =>
        set((state) => {
          if (state.project) {
            state.project.dataset = dataset
            state.project.updatedAt = new Date().toISOString()
          }
        }),

      updateVariable: (name, changes) =>
        set((state) => {
          const vars = state.project?.dataset?.variables
          if (!vars) return
          const idx = vars.findIndex((v) => v.name === name)
          if (idx !== -1) Object.assign(vars[idx], changes)
        }),

      setActiveStep: (step) =>
        set((state) => {
          state.activeStep = step
        }),

      setStepStatus: (step, status) =>
        set((state) => {
          const s = state.project?.steps.find((x) => x.id === step)
          if (s) s.status = status
        }),

      setStepResult: (step, result) =>
        set((state) => {
          const s = state.project?.steps.find((x) => x.id === step)
          if (s) {
            s.result = result
            s.status = 'completed'
            s.completedAt = new Date().toISOString()
          }
          if (state.project) state.project.updatedAt = new Date().toISOString()
        }),

      setLoading: (key, value) =>
        set((state) => {
          state.loading[key] = value
        }),

      setError: (key, message) =>
        set((state) => {
          state.errors[key] = message
        }),

      clearError: (key) =>
        set((state) => {
          delete state.errors[key]
        }),

      toggleSidebar: () =>
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen
        }),

      toggleExpertMode: () =>
        set((state) => {
          state.expertMode = !state.expertMode
        }),

      setLanguage: (lang) =>
        set((state) => {
          state.language = lang
        }),

      resetProject: () =>
        set((state) => {
          state.project = createInitialProject()
          state.activeStep = 'upload'
          state.errors = {}
          state.loading = {}
        }),
    })),
    {
      name: 'scalemind-storage',
      // Sadece proje meta verisini kaydet, büyük ham veriyi kaydetme
      partialize: (state) => ({
        project: state.project
          ? { ...state.project, dataset: state.project.dataset ? { ...state.project.dataset, rawData: undefined } : undefined }
          : null,
        language: state.language,
        expertMode: state.expertMode,
      }),
    }
  )
)
