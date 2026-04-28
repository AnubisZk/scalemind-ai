
import io
from typing import Any, Dict, List, Optional
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from schemas.statistics_schema import (
    AnovaRequest, AncovaRequest, CorrelationRequest, ExportRequest,
    NonParametricRequest, RegressionRequest, ScaleScoreRequest,
    TTestRequest, TestRecommendationRequest, DescriptiveRequest,
)
from services.statistics.variable_detector_service import variable_detector_service
from services.statistics.scale_score_service import scale_score_service
from services.statistics.descriptive_service import descriptive_service
from services.statistics.assumption_service import assumption_service
from services.statistics.decision_engine import decision_engine
from services.statistics.parametric_service import parametric_service
from services.statistics.nonparametric_service import nonparametric_service
from services.statistics.correlation_regression_service import correlation_regression_service
from services.statistics.export_statistics_service import export_statistics_service

router = APIRouter(prefix="/statistics", tags=["Statistics Extension"])
_data_store: Dict[str, pd.DataFrame] = {}

def _read_upload(file):
    content = file.file.read()
    fname = file.filename or ""
    if fname.endswith(".csv"): return pd.read_csv(io.BytesIO(content))
    elif fname.endswith((".xlsx",".xls")): return pd.read_excel(io.BytesIO(content))
    else:
        try: return pd.read_csv(io.BytesIO(content))
        except: raise HTTPException(400,"CSV veya Excel yükleyin.")

def _get_df(session_id):
    df = _data_store.get(session_id)
    if df is None: raise HTTPException(404,f"Oturum '{session_id}' bulunamadı. Önce upload yapın.")
    return df

@router.post("/upload-preview")
async def upload_preview(file: UploadFile=File(...), session_id: str=Query(default="default")):
    try:
        df = _read_upload(file); _data_store[session_id]=df
        return variable_detector_service.analyze(df)
    except HTTPException: raise
    except Exception as e: raise HTTPException(500,str(e))

@router.post("/compute-scale-scores")
async def compute_scale_scores(req: ScaleScoreRequest, session_id: str=Query(default="default")):
    df = _get_df(session_id)
    updated_df, response = scale_score_service.compute_scores(df, req)
    _data_store[session_id] = updated_df
    return response

@router.post("/descriptive")
async def descriptive(req: DescriptiveRequest, session_id: str=Query(default="default")):
    df = _get_df(session_id)
    return descriptive_service.compute(df, req.variables, req.group_by, req.confidence_level, req.include_frequency)

@router.post("/assumptions")
async def assumptions(dependent_variable: str, group_variable: Optional[str]=None,
                      alpha: float=0.05, session_id: str=Query(default="default")):
    df = _get_df(session_id)
    return assumption_service.run_all(df, dependent_variable, group_variable, alpha)

@router.post("/normality")
async def normality_test(variable: str, group_variable: Optional[str]=None,
                         alpha: float=0.05, session_id: str=Query(default="default")):
    df = _get_df(session_id)
    return {"success":True,"normality":assumption_service.normality(df,variable,group_variable,alpha)}

@router.post("/homogeneity")
async def homogeneity_test(dependent_variable: str, group_variable: str,
                           alpha: float=0.05, session_id: str=Query(default="default")):
    df = _get_df(session_id)
    return {"success":True,"homogeneity":assumption_service.homogeneity(df,dependent_variable,group_variable,alpha)}

@router.post("/recommend-test")
async def recommend_test(req: TestRecommendationRequest):
    return decision_engine.recommend(req)

@router.post("/t-test")
async def t_test(req: TTestRequest, session_id: str=Query(default="default")):
    return parametric_service.t_test(_get_df(session_id), req)

@router.post("/anova")
async def anova(req: AnovaRequest, session_id: str=Query(default="default")):
    return parametric_service.anova(_get_df(session_id), req)

@router.post("/ancova")
async def ancova(req: AncovaRequest, session_id: str=Query(default="default")):
    return parametric_service.ancova(_get_df(session_id), req)

@router.post("/nonparametric")
async def nonparametric(req: NonParametricRequest, session_id: str=Query(default="default")):
    return nonparametric_service.run(_get_df(session_id), req)

@router.post("/correlation")
async def correlation(req: CorrelationRequest, session_id: str=Query(default="default")):
    return correlation_regression_service.correlation(_get_df(session_id), req)

@router.post("/regression")
async def regression(req: RegressionRequest, session_id: str=Query(default="default")):
    return correlation_regression_service.regression(_get_df(session_id), req)

@router.post("/export-word")
async def export_word(req: ExportRequest, language: str=Query(default="tr")):
    try:
        content = export_statistics_service.export_word(req.analysis_result, language)
        return Response(content=content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition":"attachment; filename=scalemind_report.docx"})
    except Exception as e: raise HTTPException(500,str(e))

@router.post("/export-excel")
async def export_excel(req: ExportRequest):
    try:
        content = export_statistics_service.export_excel(req.analysis_result)
        return Response(content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition":"attachment; filename=scalemind_statistics.xlsx"})
    except Exception as e: raise HTTPException(500,str(e))

@router.post("/export-pdf")
async def export_pdf(req: ExportRequest, language: str=Query(default="tr")):
    try:
        content = export_statistics_service.export_pdf(req.analysis_result, language)
        return Response(content=content, media_type="application/pdf",
            headers={"Content-Disposition":"attachment; filename=scalemind_report.pdf"})
    except Exception as e: raise HTTPException(500,str(e))

@router.get("/health")
async def health():
    return {"status":"ok","module":"ScaleMind-AI Statistics Extension","version":"1.0.0"}
