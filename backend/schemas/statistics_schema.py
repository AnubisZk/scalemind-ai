
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field
from enum import Enum

class VariableType(str, Enum):
    CONTINUOUS = "continuous"; NOMINAL = "nominal"; ORDINAL = "ordinal"
    BINARY = "binary"; DATE = "date"; TEXT = "text"

class MeasurementLevel(str, Enum):
    INDEPENDENT = "independent"; PAIRED = "paired"; REPEATED = "repeated"

class LanguageCode(str, Enum):
    TR = "tr"; EN = "en"; BOTH = "both"

class ExportFormat(str, Enum):
    WORD = "word"; PDF = "pdf"; EXCEL = "excel"; JSON = "json"

class TestCategory(str, Enum):
    PARAMETRIC = "parametric"; NONPARAMETRIC = "nonparametric"
    ANOVA = "anova"; CORRELATION = "correlation"
    REGRESSION = "regression"; CATEGORICAL = "categorical"; DESCRIPTIVE = "descriptive"

class VariableInfo(BaseModel):
    name: str; type: VariableType; unique_count: int
    missing_count: int; missing_pct: float
    sample_values: List[Any] = []; suggested_role: Optional[str] = None

class DataPreviewResponse(BaseModel):
    success: bool; rows: int; columns: int
    variables: List[VariableInfo]
    preview_rows: List[Dict[str, Any]]
    missing_summary: Dict[str, Any]; warnings: List[str] = []

class SubscaleDefinition(BaseModel):
    name: str; items: List[str]; reversed_items: List[str] = []
    max_score_per_item: Optional[float] = None

class ScaleScoreRequest(BaseModel):
    subscales: List[SubscaleDefinition]
    compute_total: bool = True; compute_mean: bool = True

class ScaleScoreResult(BaseModel):
    subscale_name: str; total_col: str; mean_col: str
    item_count: int; missing_pct: float

class ScaleScoreResponse(BaseModel):
    success: bool; results: List[ScaleScoreResult]
    new_columns: List[str]; message: str

class DescriptiveRequest(BaseModel):
    variables: List[str]; group_by: Optional[str] = None
    confidence_level: float = Field(default=0.95, ge=0.80, le=0.99)
    include_frequency: bool = False

class DescriptiveStats(BaseModel):
    variable: str; group: Optional[str] = None; n: int
    mean: Optional[float]=None; std: Optional[float]=None; se: Optional[float]=None
    median: Optional[float]=None; mode: Optional[Any]=None
    min: Optional[float]=None; max: Optional[float]=None
    variance: Optional[float]=None; skewness: Optional[float]=None; kurtosis: Optional[float]=None
    ci_lower: Optional[float]=None; ci_upper: Optional[float]=None
    q1: Optional[float]=None; q3: Optional[float]=None

class DescriptiveResponse(BaseModel):
    success: bool; results: List[DescriptiveStats]
    frequency_tables: Optional[Dict[str, Any]] = None

class NormalityResult(BaseModel):
    variable: str; group: Optional[str]=None; n: int
    shapiro_stat: Optional[float]=None; shapiro_p: Optional[float]=None
    ks_stat: Optional[float]=None; ks_p: Optional[float]=None
    anderson_stat: Optional[float]=None; skewness: Optional[float]=None; kurtosis: Optional[float]=None
    is_normal: bool; severity: Literal["ok","warning","violation"]
    interpretation_tr: str; interpretation_en: str

class HomogeneityResult(BaseModel):
    dependent_variable: str; group_variable: str
    levene_stat: Optional[float]=None; levene_p: Optional[float]=None
    bartlett_stat: Optional[float]=None; bartlett_p: Optional[float]=None
    is_homogeneous: bool; severity: Literal["ok","warning","violation"]
    interpretation_tr: str; interpretation_en: str

class OutlierResult(BaseModel):
    variable: str; method: str; outlier_indices: List[int]
    outlier_count: int; outlier_pct: float; severity: Literal["ok","warning","violation"]

class AssumptionResponse(BaseModel):
    success: bool; normality: List[NormalityResult]
    homogeneity: Optional[List[HomogeneityResult]]=None
    outliers: Optional[List[OutlierResult]]=None
    multicollinearity: Optional[Dict[str,Any]]=None
    overall_verdict: Literal["parametric_ok","use_welch","use_nonparametric","check_manually"]
    warnings: List[str]=[]

class TestRecommendationRequest(BaseModel):
    dependent_variables: List[str]
    independent_variable: Optional[str]=None; covariate: Optional[str]=None
    dependent_type: VariableType=VariableType.CONTINUOUS
    independent_type: Optional[VariableType]=None
    measurement: MeasurementLevel=MeasurementLevel.INDEPENDENT
    group_count: Optional[int]=None; normality_ok: Optional[bool]=None
    homogeneity_ok: Optional[bool]=None; n: Optional[int]=None

class TestRecommendationResponse(BaseModel):
    recommended_test: str; recommended_test_id: str
    alternative_tests: List[str]; reason_tr: str; reason_en: str
    assumptions_to_check: List[str]; effect_size_required: bool; posthoc_required: bool
    apa_template_tr: str; apa_template_en: str; warnings: List[str]=[]; confidence: float=1.0

class BaseAnalysisRequest(BaseModel):
    dependent_variable: str; group_variable: Optional[str]=None
    covariates: List[str]=[]; language: LanguageCode=LanguageCode.BOTH
    alpha: float=Field(default=0.05, ge=0.01, le=0.10)

class TTestRequest(BaseAnalysisRequest):
    test_type: Literal["independent","paired","one_sample","welch"]="independent"
    mu: Optional[float]=None

class AnovaRequest(BaseAnalysisRequest):
    test_type: Literal["one_way","two_way","repeated","mixed"]="one_way"
    between_factor: Optional[str]=None; within_factor: Optional[str]=None; subject_id: Optional[str]=None

class AncovaRequest(BaseAnalysisRequest):
    pass

class ManovaRequest(BaseModel):
    dependent_variables: List[str]=Field(min_length=2); group_variable: str
    covariates: List[str]=[]; language: LanguageCode=LanguageCode.BOTH
    alpha: float=Field(default=0.05, ge=0.01, le=0.10)

class NonParametricRequest(BaseAnalysisRequest):
    test_type: Literal["mann_whitney","wilcoxon","kruskal_wallis","friedman"]="mann_whitney"

class CorrelationRequest(BaseModel):
    variables: List[str]=Field(min_length=2)
    method: Literal["pearson","spearman","kendall"]="pearson"
    language: LanguageCode=LanguageCode.BOTH

class RegressionRequest(BaseModel):
    dependent_variable: str; independent_variables: List[str]=Field(min_length=1)
    method: Literal["linear","logistic","ordinal_logistic","multiple"]="linear"
    enter_method: Literal["enter","stepwise","forward","backward"]="enter"
    language: LanguageCode=LanguageCode.BOTH

class CategoricalRequest(BaseModel):
    variable1: str; variable2: str
    test_type: Literal["chi_square","fisher_exact","mcnemar"]="chi_square"
    language: LanguageCode=LanguageCode.BOTH

class EffectSizeResult(BaseModel):
    name: str; value: float; interpretation: str
    ci_lower: Optional[float]=None; ci_upper: Optional[float]=None

class PostHocResult(BaseModel):
    group1: str; group2: str; mean_diff: Optional[float]=None
    p_value: float; p_adjusted: Optional[float]=None
    effect_size: Optional[float]=None; significant: bool

class AnalysisResponse(BaseModel):
    success: bool; analysis_name: str; test_used: str; test_family: TestCategory
    descriptive_statistics: List[DescriptiveStats]=[]
    assumption_tests: Optional[AssumptionResponse]=None
    main_results: Dict[str,Any]={}
    effect_size: Optional[List[EffectSizeResult]]=None
    posthoc_results: List[PostHocResult]=[]
    figures: List[Dict[str,Any]]=[]; tables: List[Dict[str,Any]]=[]
    interpretation_tr: str=""; interpretation_en: str=""
    apa7_tr: str=""; apa7_en: str=""
    recommendations: List[str]=[]; warnings: List[str]=[]; export_links: Dict[str,str]={}

class ExportRequest(BaseModel):
    analysis_result: AnalysisResponse; format: ExportFormat
    language: LanguageCode=LanguageCode.BOTH; include_raw_data: bool=False
