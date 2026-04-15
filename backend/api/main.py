# ============================================================
# ScaleMind AI — FastAPI Backend
# Python + R köprüsü ile psikometrik analiz API'si
# ============================================================

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
import io
import os

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.python.normality import compute_normality
from services.python.report_generator import generate_pdf_report
from services.python.ai_interpret import get_ai_interpretation
from services.python.ai_interpret import get_ai_interpretation
from services.python.item_analysis import compute_item_analysis
from services.python.reliability import compute_reliability
from services.python.content_validity import compute_content_validity
from services.r_bridge.r_runner import run_r_script

app = FastAPI(title="ScaleMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production'da Cloudflare Worker URL'i ile kısıtla
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------ Yardımcı ------

def df_from_payload(data: dict, variables: list[str]) -> pd.DataFrame:
    return pd.DataFrame({v: data[v] for v in variables if v in data})

# ------ Modeller ------

class PreprocessRequest(BaseModel):
    data: dict
    variables: list[str]

class NormalityRequest(BaseModel):
    data: dict
    variables: list[str]

class ItemAnalysisRequest(BaseModel):
    data: dict
    items: list[str]
    reversedItems: list[str] = []

class ReliabilityRequest(BaseModel):
    data: dict
    items: list[str]
    subscales: Optional[dict] = None

class ContentValidityRequest(BaseModel):
    expertCount: int
    ratings: dict   # item -> [puan listesi]
    scale: int = 2  # 1=ikili, 2=dörtlü

class EFARequest(BaseModel):
    data: dict
    items: list[str]
    options: dict

class CFARequest(BaseModel):
    data: dict
    model: dict

# ------ Endpoint'ler ------

@app.post("/parse")
async def parse_file(file: UploadFile = File(...)):
    """CSV veya XLSX dosyasını ayrıştır."""
    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Desteklenmeyen format")
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Temel istatistikler
    stats = []
    for col in df.columns:
        vals = df[col].dropna()
        missing_rate = df[col].isna().mean()
        unique = df[col].nunique()
        entry = {
            "name": col,
            "missingRate": round(float(missing_rate), 4),
            "unique": int(unique),
            "dtype": str(df[col].dtype),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            entry.update({
                "mean": round(float(vals.mean()), 3),
                "sd": round(float(vals.std()), 3),
                "min": float(vals.min()),
                "max": float(vals.max()),
            })
        stats.append(entry)

    return {
        "rows": len(df),
        "cols": len(df.columns),
        "columns": stats,
        "data": {col: df[col].where(df[col].notna(), None).tolist() for col in df.columns},
    }

@app.post("/normality")
def normality(req: NormalityRequest):
    df = clean_data(req.data, req.variables if req.variables else list(req.data.keys()))
    result = compute_normality(df)
    return {"success": True, "result": result}

def _normality_old(req: NormalityRequest):
    """Tek ve çok değişkenli normallik testleri."""
    df = df_from_payload(req.data, req.variables)
    result = compute_normality(df)
    return {"success": True, "result": result}

@app.post("/item-analysis")
def item_analysis(req: ItemAnalysisRequest):
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    req_data = df.to_dict(orient="list")
    """Madde analizi: istatistikler, korelasyonlar, madde-toplam."""
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    # Ters maddeleri yeniden kodla
    for item in req.reversedItems:
        if item in df.columns:
            max_val = df[item].max()
            min_val = df[item].min()
            df[item] = max_val + min_val - df[item]
    result = compute_item_analysis(df)
    return {"success": True, "result": result}

@app.post("/reliability")
def reliability(req: ReliabilityRequest):
    """Cronbach alpha, McDonald omega ve alt boyut güvenirliği."""
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    try:
        # R varsa omega da hesaplanır
        result = run_r_script("reliability.R", {
            "data": df.to_dict(orient="list"),
            "items": req.items,
            "subscales": req.subscales or {},
        })
    except Exception as e:
        import logging
        logging.error(f"R reliability hatasi: {e}")
        # R yoksa Python fallback (alpha + split-half)
        result = compute_reliability(df)
    return {"success": True, "result": result}

@app.post("/content-validity")
def content_validity(req: ContentValidityRequest):
    """I-CVI, S-CVI/Ave, S-CVI/UA hesabı."""
    result = compute_content_validity(req.expertCount, req.ratings, req.scale)
    return {"success": True, "result": result}

@app.post("/efa")
def efa(req: EFARequest):
    """Açımlayıcı Faktör Analizi — R psych paketi."""
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    result = run_r_script("efa.R", {
        "data": df.to_dict(orient="list"),
        "items": req.items,
        "options": req.options,
    })
    return {"success": True, "result": result}

@app.post("/cfa")
def cfa(req: CFARequest):
    """Doğrulayıcı Faktör Analizi — R lavaan paketi."""
    result = run_r_script("cfa.R", {
        "data": req.data,
        "model": req.model,
    })
    return {"success": True, "result": result}

@app.post("/report/pdf")
def report_pdf(data: dict):
    """Tum analiz sonuclarindan PDF raporu uret."""
    try:
        pdf_bytes = generate_pdf_report(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=scalemind_report.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import math as _math

def clean_data(data: dict, keys: list):
    """Tum array leri esit uzunluga getirir, NaN sanitize yapar."""
    cleaned = {}
    for k in keys:
        vals = data.get(k, [])
        cleaned[k] = [float(v) if v is not None and not (isinstance(v, float) and _math.isnan(v)) else float("nan") for v in vals]
    lengths = [len(v) for v in cleaned.values()]
    if len(set(lengths)) > 1:
        max_len = max(lengths)
        for k in cleaned:
            while len(cleaned[k]) < max_len:
                cleaned[k].append(float("nan"))
    import pandas as pd
    return pd.DataFrame(cleaned)

@app.post("/interpret")
def ai_interpret(req: dict):
    module = req.get("module", "normality")
    data = req.get("data", {})
    lang = req.get("lang", "en")
    try:
        text = get_ai_interpretation(module, data, lang)
        return {"success": True, "interpretation": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interpret")
def ai_interpret(req: dict):
    module = req.get("module", "normality")
    data = req.get("data", {})
    lang = req.get("lang", "en")
    try:
        text = get_ai_interpretation(module, data, lang)
        return {"success": True, "interpretation": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "service": "ScaleMind AI Backend"}
