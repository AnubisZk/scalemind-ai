// ============================================================
// ScaleMind AI — Dosya Ayrıştırıcı (Client-side)
// CSV ve XLSX dosyalarını Dataset tipine dönüştürür.
// ============================================================
import * as XLSX from 'xlsx'
import type { Dataset, Variable, VariableType } from '../types'

export interface ParseResult {
  dataset: Dataset
  rawData: Record<string, (number | string | null)[]>
  warnings: string[]
}

// ------ Tip Tahmini ------

function inferType(values: (number | string | null)[]): VariableType {
  const nonNull = values.filter((v) => v !== null && v !== '' && v !== undefined)
  if (nonNull.length === 0) return 'continuous'

  const numeric = nonNull.filter((v) => !isNaN(Number(v)))
  const uniqueVals = new Set(nonNull.map(Number))

  // ID gibi benzersiz değerler
  if (uniqueVals.size === nonNull.length && uniqueVals.size > 50) return 'id'

  // Binary
  if (uniqueVals.size === 2) return 'binary'

  // Likert (1-5, 1-6, 1-7 gibi ardışık tam sayılar)
  if (numeric.length === nonNull.length) {
    const nums = [...uniqueVals].sort((a, b) => a - b)
    const min = nums[0]
    const max = nums[nums.length - 1]
    const isSequential = nums.every((v, i) => i === 0 || v === nums[i - 1] + 1)
    if (isSequential && min >= 1 && max <= 10 && uniqueVals.size >= 3) return 'likert'
    return 'continuous'
  }

  return 'categorical'
}

function detectMissingRate(values: (number | string | null)[]): number {
  const missing = values.filter(
    (v) => v === null || v === '' || v === undefined || v === 'NA' || v === 'N/A'
  ).length
  return missing / values.length
}

function computeBasicStats(values: (number | string | null)[]) {
  const nums = values
    .filter((v) => v !== null && v !== '' && !isNaN(Number(v)))
    .map(Number)
  if (nums.length === 0) return {}
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const sd = Math.sqrt(nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nums.length - 1))
  return { mean: +mean.toFixed(3), sd: +sd.toFixed(3), min: Math.min(...nums), max: Math.max(...nums) }
}

// ------ CSV Ayrıştırıcı ------

function parseCSVText(text: string): Record<string, string[]> {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const result: Record<string, string[]> = {}
  headers.forEach((h) => (result[h] = []))
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',')
    headers.forEach((h, j) => {
      result[h].push((vals[j] ?? '').trim().replace(/^"|"$/g, ''))
    })
  }
  return result
}

// ------ Ana Parser ------

export async function parseFile(file: File): Promise<ParseResult> {
  const warnings: string[] = []
  const ext = file.name.split('.').pop()?.toLowerCase()

  let rawColumns: Record<string, string[]> = {}

  if (ext === 'csv' || ext === 'tsv') {
    const text = await file.text()
    rawColumns = parseCSVText(text)
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { header: 1 })
    const headers = (json[0] as (string | number)[]).map(String)
    headers.forEach((h) => (rawColumns[h] = []))
    for (let i = 1; i < json.length; i++) {
      const row = json[i] as (string | number)[]
      headers.forEach((h, j) => {
        rawColumns[h].push(String(row[j] ?? ''))
      })
    }
  } else {
    throw new Error('Desteklenmeyen dosya formatı. CSV, XLSX veya TSV yükleyin.')
  }

  const columnNames = Object.keys(rawColumns)
  const rowCount = rawColumns[columnNames[0]]?.length ?? 0

  // Boş sütunları uyar
  const emptyCols = columnNames.filter((c) => rawColumns[c].every((v) => v === ''))
  if (emptyCols.length > 0) warnings.push(`Boş sütunlar tespit edildi: ${emptyCols.join(', ')}`)

  // Düşük örnek sayısı uyarısı
  if (rowCount < 100) warnings.push(`Örneklem boyutu (n=${rowCount}) faktör analizi için yeterli olmayabilir. En az 200 katılımcı önerilir.`)
  if (rowCount < 50) warnings.push(`Kritik: n=${rowCount} çok küçük. Psikometrik analiz için en az 100 katılımcı gereklidir.`)

  // Değişken tiplerini çıkar
  const rawData: Record<string, (number | string | null)[]> = {}
  const variables: Variable[] = columnNames.map((name) => {
    const strValues = rawColumns[name]
    const parsedValues = strValues.map((v) => {
      if (v === '' || v === 'NA' || v === 'N/A' || v === 'null') return null
      const n = Number(v)
      return isNaN(n) ? v : n
    })
    rawData[name] = parsedValues
    const type = inferType(parsedValues)
    const missingRate = detectMissingRate(parsedValues)
    const stats = computeBasicStats(parsedValues)
    return {
      name,
      type,
      isReversed: false,
      missingRate: +missingRate.toFixed(4),
      unique: new Set(parsedValues.filter((v) => v !== null)).size,
      ...stats,
    } as Variable
  })

  // Sabit değişken uyarısı
  const constantVars = variables.filter((v) => v.unique === 1)
  if (constantVars.length > 0)
    warnings.push(`Sabit değişkenler (tek değer): ${constantVars.map((v) => v.name).join(', ')} — analizden çıkarılmalı`)

  const dataset: Dataset = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: file.name,
    rows: rowCount,
    cols: columnNames.length,
    variables,
    uploadedAt: new Date().toISOString(),
  }

  return { dataset, rawData, warnings }
}
