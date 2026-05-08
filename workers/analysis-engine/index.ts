// ============================================================
// ScaleMind AI — Analysis Engine Worker
// Cloudflare Worker: İstatistiksel hesaplama uç noktaları
// ============================================================

export interface Env {
  R_API_URL: string          // Railway/Fly.io'daki R+Python API
  ALLOWED_ORIGIN: string
}

// ------ CORS Başlıkları ------

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(data: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  })
}

// ------ Yardımcı: R/Python API'ye JSON köprü ------

async function bridgeToBackend(
  env: Env,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${env.R_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Backend hatası (${res.status}): ${err}`)
  }

  return res.json()
}

// ------ Yardımcı: Raw proxy — multipart ve JSON body bozulmadan aktarılır ------

async function proxyRawToBackend(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const incomingUrl = new URL(request.url)
  const targetUrl = `${env.R_API_URL}${incomingUrl.pathname}${incomingUrl.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')

  const method = request.method.toUpperCase()

  const backendResponse = await fetch(targetUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(backendResponse.headers)
  responseHeaders.set('Access-Control-Allow-Origin', origin)
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  })
}

// ------ Ön İşleme (Worker'da hesaplanır, hızlı) ------

function computePreprocessing(
  data: Record<string, (number | string | null)[]>,
  variables: string[]
) {
  const byVariable = variables.map((v) => {
    const vals = data[v] ?? []
    const missing = vals.filter((x) => x === null || x === '').length
    return { name: v, count: missing, rate: +(missing / vals.length).toFixed(4) }
  })

  const totalMissing = byVariable.reduce((a, b) => a + b.count, 0)
  const rowCount = (data[variables[0]] ?? []).length

  const rowsWithMissing = Array.from({ length: rowCount }, (_, i) =>
    variables.some((v) => data[v][i] === null || data[v][i] === '')
  ).filter(Boolean).length

  return {
    totalMissing,
    missingRate: +(totalMissing / (rowCount * variables.length)).toFixed(4),
    byVariable,
    rowsWithMissing,
  }
}

// ------ Ana İşleyici ------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '*'

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Sadece POST destekleniyor' }, 405, origin)
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Statistics extension:
      // /statistics/* endpointleri Worker içinde body okunmadan backend'e aktarılır.
      // Böylece hem multipart/form-data hem JSON body bozulmaz.
      if (path.startsWith('/statistics')) {
        return proxyRawToBackend(request, env, origin)
      }

      // Eski parse endpointi — sadece /parse için multipart form işlenir.
      if (path === '/parse') {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
          return jsonResponse({ error: 'Dosya bulunamadı' }, 400, origin)
        }

        const backendForm = new FormData()
        backendForm.append('file', file)

        const urlParams = request.url.includes('?')
          ? '?' + request.url.split('?')[1]
          : ''

        const res = await fetch(`${env.R_API_URL}${path}${urlParams}`, {
          method: 'POST',
          body: backendForm,
        })

        const result = await res.json()
        return jsonResponse(result, res.status, origin)
      }

      // Bundan sonra sadece JSON endpointler okunur.
      const body = await request.json() as Record<string, unknown>

      // ------ Ön İşleme (Worker'da) ------
      if (path === '/preprocess') {
        const result = computePreprocessing(
          body.data as Record<string, (number | string | null)[]>,
          body.variables as string[]
        )

        return jsonResponse({ success: true, result }, 200, origin)
      }

      // ------ Ağır analizler: Backend'e köprüle ------
      const backendPaths = [
        '/normality',
        '/item-analysis',
        '/reliability',
        '/content-validity',
        '/efa',
        '/cfa',
        '/sem',
        '/report/pdf',
      ]

      if (backendPaths.includes(path)) {
        const result = await bridgeToBackend(env, path, body)

        // Backend zaten {success, result} formatında döndürüyor, tekrar sarmalama
        if (typeof result === 'object' && result !== null && 'result' in result) {
          return jsonResponse(result, 200, origin)
        }

        return jsonResponse({ success: true, result }, 200, origin)
      }

      return jsonResponse({ error: `Bilinmeyen endpoint: ${path}` }, 404, origin)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen hata'
      return jsonResponse({ success: false, error: message }, 500, origin)
    }
  },
}
