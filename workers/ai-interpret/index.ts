// ============================================================
// ScaleMind AI — AI Interpretation Worker
// Cloudflare Worker: Claude API ile istatistiksel yorumlama
// ============================================================

export interface Env {
  ANTHROPIC_API_KEY: string
  ALLOWED_ORIGIN: string
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

// ------ Analiz türüne göre sistem promptu ------

function buildSystemPrompt(language: 'tr' | 'en'): string {
  if (language === 'tr') {
    return `Sen ScaleMind AI'ın istatistik yorumlama asistanısın.

Görevin: Sana verilen istatistiksel analiz sonuçlarını akademik dilde, bilimsel olarak doğru biçimde yorumlamak.

KURALLARIN:
1. Yalnızca sana verilen sayısal sonuçlara dayan. Sonuç uydurmayacaksın.
2. Kesin yargı yerine "bulgular şunu düşündürmektedir", "sonuçlar göstermektedir" gibi ifadeler kullan.
3. Eğer bir değer kabul sınırını ihlal ediyorsa bunu açıkça ve eğitici bir dille belirt.
4. Yorumun şu bölümleri içersin: (a) Kısa özet, (b) Güçlü yönler, (c) Uyarılar/Sınırlılıklar, (d) Önerilen sonraki adım.
5. APA 7 uyumlu raporlama örnekleri sun.
6. Hiperbolik, abartılı ya da kesin olmayan ifadelerden kaçın.
7. Eğer örneklem boyutu çok küçükse veya bir varsayım ihlal edilmişse bunu mutlaka belirt.`
  }
  return `You are the statistical interpretation assistant of ScaleMind AI.

Your role: Interpret the statistical analysis results provided to you in academic, scientifically accurate language.

RULES:
1. Only rely on the numerical results given to you. Do not fabricate results.
2. Use cautious language: "findings suggest", "results indicate" rather than absolute claims.
3. If a value violates an acceptable threshold, state this clearly and educationally.
4. Your interpretation should include: (a) Brief summary, (b) Strengths, (c) Warnings/Limitations, (d) Recommended next step.
5. Provide APA 7 compliant reporting examples.
6. Avoid hyperbolic, exaggerated, or uncertain claims.
7. Always flag if sample size is too small or an assumption is violated.`
}

// ------ Analiz türüne göre kullanıcı mesajı ------

function buildUserMessage(
  analysisType: string,
  results: unknown,
  context: { sampleSize: number; scale?: string; targetGroup?: string; language: 'tr' | 'en' }
): string {
  const lang = context.language
  const ctx = lang === 'tr'
    ? `Örneklem boyutu: ${context.sampleSize}${context.scale ? `, Ölçek: ${context.scale}` : ''}${context.targetGroup ? `, Hedef grup: ${context.targetGroup}` : ''}`
    : `Sample size: ${context.sampleSize}${context.scale ? `, Scale: ${context.scale}` : ''}${context.targetGroup ? `, Target group: ${context.targetGroup}` : ''}`

  const typeLabel: Record<string, string> = {
    normality:         lang === 'tr' ? 'Normallik Analizi' : 'Normality Analysis',
    'item-analysis':   lang === 'tr' ? 'Madde Analizi' : 'Item Analysis',
    reliability:       lang === 'tr' ? 'Güvenirlik Analizi' : 'Reliability Analysis',
    'content-validity':lang === 'tr' ? 'Kapsam Geçerliliği' : 'Content Validity',
    efa:               lang === 'tr' ? 'Açımlayıcı Faktör Analizi (AFA)' : 'Exploratory Factor Analysis (EFA)',
    cfa:               lang === 'tr' ? 'Doğrulayıcı Faktör Analizi (DFA)' : 'Confirmatory Factor Analysis (CFA)',
    sem:               lang === 'tr' ? 'Yapısal Eşitlik Modellemesi' : 'Structural Equation Modeling',
  }

  const prefix = lang === 'tr'
    ? `Aşağıdaki ${typeLabel[analysisType] ?? analysisType} sonuçlarını yorumla.\n\nBağlam: ${ctx}\n\nSonuçlar (JSON):`
    : `Interpret the following ${typeLabel[analysisType] ?? analysisType} results.\n\nContext: ${ctx}\n\nResults (JSON):`

  return `${prefix}\n\n${JSON.stringify(results, null, 2)}`
}

// ------ CORS ------

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// ------ Ana İşleyici ------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '*'

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Sadece POST' }), { status: 405 })
    }

    const url = new URL(request.url)
    const isStream = url.pathname === '/interpret-stream'

    try {
      const body = await request.json() as {
        analysisType: string
        results: unknown
        projectContext: {
          sampleSize: number
          scale?: string
          targetGroup?: string
          language: 'tr' | 'en'
        }
      }

      const systemPrompt = buildSystemPrompt(body.projectContext.language)
      const userMessage = buildUserMessage(
        body.analysisType,
        body.results,
        body.projectContext
      )

      const anthropicBody = {
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        ...(isStream ? { stream: true } : {}),
      }

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicBody),
      })

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text()
        return new Response(JSON.stringify({ error: `Claude API hatası: ${err}` }), {
          status: 500,
          headers: { ...cors(origin), 'Content-Type': 'application/json' },
        })
      }

      // Streaming yanıt — doğrudan aktar
      if (isStream) {
        return new Response(anthropicRes.body, {
          status: 200,
          headers: {
            ...cors(origin),
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      // Normal yanıt
      const data = await anthropicRes.json() as {
        content: { type: string; text: string }[]
      }
      const text = data.content.find((c) => c.type === 'text')?.text ?? ''
      return new Response(
        JSON.stringify({ success: true, interpretation: text }),
        {
          status: 200,
          headers: { ...cors(origin), 'Content-Type': 'application/json' },
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen hata'
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 500,
        headers: { ...cors(origin), 'Content-Type': 'application/json' },
      })
    }
  },
}
