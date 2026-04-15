const BASE_URL = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'https://scalemind-ai-production.up.railway.app'

async function post(path, body) {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

export async function runNormality(data, variables) {
  return post('/normality', { data, variables })
}

export async function runItemAnalysis(data, items, reversedItems) {
  return post('/item-analysis', { data, items, reversedItems })
}

export async function runReliability(data, items, subscales) {
  return post('/reliability', { data, items, subscales })
}

export async function runEFA(data, items, options) {
  return post('/efa', { data, items, options })
}

export async function runCFA(data, model) {
  return post('/cfa', { data, model })
}

export async function runContentValidity(ratings) {
  return post('/content-validity', ratings)
}

export async function getAIInterpretation(request) {
  return post('/interpret', request)
}

export async function parseDataset(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(BASE_URL + '/parse', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Dosya işlenemedi')
  return res.json()
}

export async function streamAIInterpretation(request, onChunk) {
  onChunk('AI stream henüz aktif değil.')
}
// 15 Nis 2026 Çar +03 01:10:55
// 15 Nis 2026 Çar +03 01:12:53
