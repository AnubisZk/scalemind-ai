# ScaleMind AI

Araştırmacılar, lisansüstü öğrenciler ve akademisyenler için modern psikometrik ölçek geliştirme ve analiz platformu.

---

## Mimari Özet

```
Netlify (Frontend: React)
    ↕
Cloudflare Workers
  ├── analysis-engine  →  Railway/Fly.io (FastAPI + R)
  └── ai-interpret     →  Anthropic Claude API
```

---

## Klasör Yapısı

```
scalemind-ai/
├── frontend/                    # React + TypeScript + Vite
│   └── src/
│       ├── types/index.ts       # Merkezi tip tanımları
│       ├── store/               # Zustand global state
│       ├── lib/
│       │   ├── api.ts           # Worker API istemcisi
│       │   └── parser.ts        # CSV/XLSX ayrıştırıcı
│       └── components/
│           ├── layout/          # Sidebar, header
│           ├── shared/          # AnalysisPanel (3 sekme)
│           └── modules/
│               ├── upload/      ✅ Tamamlandı
│               ├── preprocessing/
│               ├── normality/
│               ├── item-analysis/
│               ├── reliability/ ✅ Tamamlandı
│               ├── content-validity/
│               ├── efa/         ✅ Tamamlandı
│               ├── cfa/
│               └── reporting/
├── workers/
│   ├── analysis-engine/         # Cloudflare Worker → Backend köprüsü
│   └── ai-interpret/            # Cloudflare Worker → Claude API
├── backend/                     # FastAPI + Python + R
│   ├── api/main.py
│   ├── services/
│   │   ├── python/
│   │   │   ├── normality.py     ✅ Mardia dahil
│   │   │   ├── item_analysis.py ✅ Madde-toplam, alpha if deleted
│   │   │   └── content_validity.py ✅ I-CVI, S-CVI
│   │   └── r_bridge/r_runner.py ✅
│   └── r_scripts/
│       ├── efa.R                ✅ psych + parallel analysis
│       ├── cfa.R                ✅ lavaan + semTools
│       └── reliability.R        ✅ psych omega
└── netlify.toml
```

---

## Faz 1 Tamamlanan Modüller

| Modül | Durum | Açıklama |
|-------|-------|----------|
| Veri Yükleme | ✅ | CSV/XLSX, otomatik tip tespiti, ters madde |
| Normallik | ✅ | Mardia çoklu normallik, öneri |
| Madde Analizi | ✅ | Korelasyon, alpha if deleted |
| Kapsam Geçerliliği | ✅ | I-CVI, S-CVI/Ave, S-CVI/UA |
| Güvenirlik | ✅ | α, ω, split-half, alt boyut |
| EFA | ✅ | KMO, Bartlett, parallel analysis, scree plot |
| CFA | ✅ | lavaan, fit indices, AVE, CR |
| AI Yorumlama | ✅ | Claude API, streaming |

---

## Kurulum

### 1. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local içine Cloudflare Worker URL'lerini gir
npm run dev
```

**.env.local:**
```
VITE_ANALYSIS_WORKER_URL=https://scalemind-analysis.workers.dev
VITE_AI_WORKER_URL=https://scalemind-ai-interpret.workers.dev
```

### 2. Backend (Local)

```bash
cd backend
pip install -r requirements.txt

# R paketleri (bir kez):
Rscript -e "install.packages(c('psych','lavaan','semTools','GPArotation','nFactors','jsonlite'))"

uvicorn api.main:app --reload --port 8000
```

### 3. Cloudflare Workers

```bash
# Her iki worker için:
cd workers/analysis-engine
npm install -g wrangler
wrangler login

# Secret tanımla:
wrangler secret put R_API_URL
# → https://your-backend.railway.app (Railway URL'i)

wrangler deploy

# AI Worker:
cd ../ai-interpret
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

### 4. Backend Deploy (Railway)

```bash
# railway.app üzerinden:
# 1. New Project → Deploy from GitHub
# 2. backend/ klasörünü root olarak seç
# 3. Dockerfile otomatik algılanır
# 4. URL'i kopyala → Cloudflare Worker secret olarak ekle
```

### 5. Frontend Deploy (Netlify)

```bash
# netlify.toml hazır
# 1. netlify.app → Import from Git
# 2. Build command: cd frontend && npm run build
# 3. Publish dir: frontend/dist
# 4. Environment variables:
#    VITE_ANALYSIS_WORKER_URL=https://scalemind-analysis.workers.dev
#    VITE_AI_WORKER_URL=https://scalemind-ai-interpret.workers.dev
```

---

## Veri Akışı

```
Kullanıcı CSV yükler
  → parser.ts (client-side parse)
  → Zustand store'a kaydet
  → Analiz başlat butonu
  → api.ts → Cloudflare Worker
  → Worker → FastAPI backend
  → FastAPI → R scripti çalıştır
  → Sonuç JSON → Worker → Frontend
  → AI yorum → ai-interpret Worker → Claude API
  → Sonuç ekranda göster
```

---

## Güvenlik Notları

- Ham veri Claude API'ye gönderilmez — yalnızca özet istatistikler gönderilir
- Cloudflare Worker CORS kısıtlaması uygular
- Backend Railway'de private deployment olarak çalışır
- Anthropic API key sadece Worker secret'ta tutulur

---

## Faz 2 Planı

- Ön işleme modülü (eksik veri stratejileri)
- Normallik modülü (görsel Q-Q plot)
- Madde analizi modülü (korelasyon ısı haritası)
- Kapsam geçerliliği UI modülü
- CFA görsel model editörü
- Proje kaydetme/yükleme
- PDF rapor üretici

## Faz 3 Planı

- AMOS benzeri SEM görsel editörü (React Flow)
- Mediation / Bootstrap indirekt etkiler
- Karşılaştırmalı model analizi
- Çok dilli (TR/EN) tam destek
