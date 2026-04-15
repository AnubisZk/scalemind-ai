// ============================================================
// ScaleMind AI — Merkezi Tip Tanımlamaları
// ============================================================

// ------ Proje & Veri ------

export type VariableType = 'likert' | 'continuous' | 'categorical' | 'binary' | 'id' | 'demographic'

export interface Variable {
  name: string
  type: VariableType
  isReversed: boolean
  subscale?: string
  missingRate: number
  mean?: number
  sd?: number
  min?: number
  max?: number
  unique?: number
}

export interface Dataset {
  id: string
  name: string
  rows: number
  cols: number
  variables: Variable[]
  rawData?: Record<string, (number | string | null)[]>
  uploadedAt: string
}

export interface Project {
  id: string
  name: string
  description?: string
  dataset?: Dataset
  steps: AnalysisStep[]
  createdAt: string
  updatedAt: string
}

// ------ Analiz Adımları ------

export type AnalysisStepId =
  | 'upload'
  | 'preprocessing'
  | 'normality'
  | 'item-analysis'
  | 'reliability'
  | 'content-validity'
  | 'efa'
  | 'cfa'
  | 'sem'
  | 'reporting'

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'error'

export interface AnalysisStep {
  id: AnalysisStepId
  label: string
  labelTr: string
  status: StepStatus
  result?: AnalysisResult
  completedAt?: string
}

// ------ Analiz Sonuçları ------

export interface AnalysisResult {
  type: AnalysisStepId
  data: unknown
  warnings: string[]
  aiComment?: AIComment
  timestamp: string
}

// ------ Ön İşleme ------

export interface MissingDataSummary {
  totalMissing: number
  missingRate: number
  byVariable: { name: string; count: number; rate: number }[]
  rowsWithMissing: number
  strategy?: 'listwise' | 'mean' | 'median' | 'em'
}

export interface OutlierSummary {
  mahalanobisOutliers: number[]
  zscoreOutliers: { variable: string; rowIndices: number[] }[]
  totalFlagged: number
}

// ------ Normallik ------

export interface UnivariateNormality {
  variable: string
  mean: number
  sd: number
  skewness: number
  kurtosis: number
  swPValue?: number
  ksPValue?: number
  isNormal: boolean
}

export interface MultivariateNormality {
  mardiaSkewness: number
  mardiaSkewnessPValue: number
  mardiaKurtosis: number
  mardiaKurtosisPValue: number
  hzStatistic?: number
  hzPValue?: number
  isMultivariateNormal: boolean
  nOutliers: number
}

export interface NormalityResult {
  univariate: UnivariateNormality[]
  multivariate: MultivariateNormality
  recommendation: 'ml' | 'robust' | 'wlsmv' | 'bootstrap'
  recommendationReason: string
}

// ------ Madde Analizi ------

export interface ItemStats {
  name: string
  mean: number
  sd: number
  min: number
  max: number
  skewness: number
  kurtosis: number
  itemTotalCorr: number
  correctedItemTotalCorr: number
  alphaIfDeleted: number
  floorEffect: boolean
  ceilingEffect: boolean
}

export interface ItemAnalysisResult {
  items: ItemStats[]
  correlationMatrix: number[][]
  weakItems: string[]
  redundantPairs: [string, string][]
  recommendations: string[]
}

// ------ Güvenirlik ------

export interface ReliabilityResult {
  cronbachAlpha: number
  cronbachAlphaCI: [number, number]
  mcdonaldOmegaTotal: number
  mcdonaldOmegaHierarchical?: number
  splitHalf: number
  spearmanBrown: number
  meanInterItemCorr: number
  subscales?: {
    name: string
    items: string[]
    alpha: number
    omega: number
    n: number
  }[]
  interpretation: string
}

// ------ Kapsam Geçerliliği ------

export interface ContentValidityResult {
  icvi: { item: string; value: number; adequate: boolean }[]
  scviAve: number
  scviUa: number
  expertCount: number
  threshold: number
  problematicItems: string[]
  recommendations: string[]
}

// ------ AFA / EFA ------

export interface EFAResult {
  kmo: number
  kmoInterpretation: string
  bartlettChi2: number
  bartlettDf: number
  bartlettP: number
  determinant: number
  eigenvalues: number[]
  parallelAnalysisN?: number
  suggestedFactors: number
  selectedFactors: number
  extractionMethod: string
  rotation: string
  loadings: number[][]   // [item][factor]
  variableNames: string[]
  factorNames: string[]
  communalities: number[]
  uniqueness: number[]
  varianceExplained: { factor: number; eigenvalue: number; variance: number; cumulative: number }[]
  crossLoadings: [string, string, number][]  // [item, factor1, factor2, loading_diff]
  factorItemMap: Record<string, string[]>
}

// ------ DFA / CFA ------

export interface CFAFit {
  chi2: number
  df: number
  chi2df: number
  pValue: number
  cfi: number
  tli: number
  rmsea: number
  rmseaCI: [number, number]
  srmr: number
  gfi?: number
  aic?: number
  bic?: number
  isAdequate: boolean
  fitSummary: string
}

export interface CFAResult {
  fit: CFAFit
  standardizedLoadings: { item: string; factor: string; loading: number; se: number; pValue: number }[]
  factorCorrelations?: number[][]
  ave: Record<string, number>
  cr: Record<string, number>
  htmt?: Record<string, Record<string, number>>
  modificationIndices?: { lhs: string; rhs: string; mi: number; epc: number }[]
  lavaan_syntax: string
}

// ------ AI Yorum ------

export interface AIComment {
  summary: string
  findings: string[]
  warnings: string[]
  recommendations: string[]
  methodSection?: string
  resultsSection?: string
  language: 'tr' | 'en'
  generatedAt: string
}

// ------ Worker API ------

export interface WorkerRequest {
  action: string
  projectId: string
  data: unknown
}

export interface WorkerResponse<T = unknown> {
  success: boolean
  result?: T
  error?: string
  warnings?: string[]
}
