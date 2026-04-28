# ============================================================
# ScaleMind AI — FastAPI Backend
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
import sys
import math as _math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.python.normality import compute_normality
from services.python.report_generator import generate_pdf_report
from services.python.ai_interpret import get_ai_interpretation
from services.python.item_analysis import compute_item_analysis
from services.python.reliability import compute_reliability
from services.python.content_validity import compute_content_validity
from services.r_bridge.r_runner import run_r_script

app = FastAPI(title="ScaleMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Statistics Extension
from routes.statistics_router import router as statistics_router
app.include_router(statistics_router)

# ------ Yardımcı ------
def df_from_payload(data, variables):
    return pd.DataFrame({v: data[v] for v in variables if v in data})

def clean_data(data, keys):
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
    return pd.DataFrame(cleaned)

# ------ Modeller ------
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
    ratings: dict
    scale: int = 2

class EFARequest(BaseModel):
    data: dict
    items: list[str]
    options: dict

class CFARequest(BaseModel):
    data: dict
    model: dict

# ------ Endpointler ------
@app.post("/parse")
async def parse_file(file: UploadFile = File(...)):
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
    stats = []
    for col in df.columns:
        vals = df[col].dropna()
        entry = {"name": col, "missingRate": round(float(df[col].isna().mean()), 4),
                 "unique": int(df[col].nunique()), "dtype": str(df[col].dtype)}
        if pd.api.types.is_numeric_dtype(df[col]):
            entry.update({"mean": round(float(vals.mean()), 3), "sd": round(float(vals.std()), 3),
                           "min": float(vals.min()), "max": float(vals.max())})
        stats.append(entry)
    return {"rows": len(df), "cols": len(df.columns), "columns": stats,
            "data": {col: df[col].where(df[col].notna(), None).tolist() for col in df.columns}}

@app.post("/normality")
def normality(req: NormalityRequest):
    df = clean_data(req.data, req.variables if req.variables else list(req.data.keys()))
    return {"success": True, "result": compute_normality(df)}

@app.post("/item-analysis")
def item_analysis(req: ItemAnalysisRequest):
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    for item in req.reversedItems:
        if item in df.columns:
            df[item] = df[item].max() + df[item].min() - df[item]
    return {"success": True, "result": compute_item_analysis(df)}

@app.post("/reliability")
def reliability(req: ReliabilityRequest):
    df = clean_data(req.data, req.items if req.items else list(req.data.keys()))
    try:
        result = run_r_script("reliability.R", {"data": df.to_dict(orient="list"),
                                                 "items": req.items, "subscales": req.subscales or {}})
    except Exception:
        result = compute_reliability(df)
    return {"success": True, "result": result}

@app.post("/content-validity")
def content_validity(req: ContentValidityRequest):
    return {"success": True, "result": compute_content_validity(req.expertCount, req.ratings, req.scale)}

@app.post("/efa")
def efa(req: EFARequest):
    all_keys = list(req.data.keys())
    items = req.items if req.items else all_keys
    df = clean_data(req.data, items)
    valid_items = [i for i in items if i in df.columns]
    if not valid_items:
        valid_items = list(df.columns)
    
    # Türkçe/özel karakterli isimleri R uyumlu kısa kodlara çevir
    item_map = {item: f"V{i+1}" for i, item in enumerate(valid_items)}
    reverse_map = {v: k for k, v in item_map.items()}
    
    r_data = {item_map[item]: df[item].tolist() for item in valid_items}
    r_items = list(item_map.values())
    
    result = run_r_script("efa.R", {"data": r_data, "items": r_items, "options": req.options})
    
    # Sonuçlarda V1, V2... isimlerini orijinal isimlere geri çevir
    if "loadings" in result:
        result["loadings"] = {reverse_map.get(k, k): v for k, v in result["loadings"].items()}
    if "communalities" in result and isinstance(result["communalities"], list):
        pass  # liste olduğunda indeks bazlı, değiştirmeye gerek yok
    if "alphaIfDeleted" in result:
        result["alphaIfDeleted"] = {reverse_map.get(k, k): v for k, v in result["alphaIfDeleted"].items()}
    if "factorItemMap" in result:
        result["factorItemMap"] = {
            factor: [reverse_map.get(item, item) for item in items]
            for factor, items in result["factorItemMap"].items()
        }
    if "variableNames" in result:
        result["variableNames"] = [reverse_map.get(v, v) for v in result["variableNames"]]
    
    return {"success": True, "result": result}

@app.post("/cfa")
def cfa(req: CFARequest):
    # Türkçe/özel karakterli kolon adlarını R uyumlu kısa kodlara çevir
    all_items = list(req.data.keys())
    item_map = {item: f"V{i+1}" for i, item in enumerate(all_items)}
    reverse_map = {v: k for k, v in item_map.items()}
    
    r_data = {item_map[item]: req.data[item] for item in all_items}
    
    # Model yapısını dönüştür: {factors: [{name, items}], ...} veya {name: [items]} formatını destekle
    raw_model = req.model
    r_model = {}
    
    if isinstance(raw_model, dict) and "factors" in raw_model:
        # Frontend formatı: {factors: [{name, items}, ...], ...}
        for factor_def in raw_model["factors"]:
            if isinstance(factor_def, dict):
                fname = factor_def.get("name", "F1")
                fitems = factor_def.get("items", [])
                r_model[fname] = [item_map.get(item, f"V{all_items.index(item)+1}" if item in all_items else item) for item in fitems]
    else:
        # Basit format: {factorName: [items]}
        for factor, items in raw_model.items():
            if isinstance(items, list):
                r_model[factor] = [item_map.get(item, item) for item in items]
    
    # R script {factors:[{name,items}], correlatedFactors, estimator} formatı bekliyor
    r_factors = [{"name": fname, "items": fitems} for fname, fitems in r_model.items()]
    r_model_final = {
        "factors": r_factors,
        "correlatedFactors": raw_model.get("correlatedFactors", True) if isinstance(raw_model, dict) else True,
        "estimator": raw_model.get("estimator", "MLR") if isinstance(raw_model, dict) else "MLR",
    }
    result = run_r_script("cfa.R", {"data": r_data, "model": r_model_final})
    
    # Sonuçlarda V1, V2... isimlerini orijinal isimlere geri çevir
    if "loadings" in result and isinstance(result["loadings"], dict):
        result["loadings"] = {reverse_map.get(k, k): v for k, v in result["loadings"].items()}
    
    return {"success": True, "result": result}

@app.post("/interpret")
def ai_interpret(req: dict):
    try:
        text = get_ai_interpretation(req.get("module","normality"), req.get("data",{}), req.get("lang","en"))
        return {"success": True, "interpretation": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/report/pdf")
def report_pdf(data: dict):
    try:
        pdf_bytes = generate_pdf_report(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=scalemind_report.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
