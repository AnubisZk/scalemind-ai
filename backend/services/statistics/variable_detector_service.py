
import pandas as pd
from schemas.statistics_schema import VariableInfo, VariableType, DataPreviewResponse
from utils.data_validation import detect_variable_type, check_missing_data

class VariableDetectorService:
    def analyze(self, df, n_preview=5):
        warnings = []
        variables = []
        for col in df.columns:
            series = df[col]
            raw = detect_variable_type(series)
            mapping = {"continuous":VariableType.CONTINUOUS,"binary":VariableType.BINARY,
                       "ordinal":VariableType.ORDINAL,"nominal":VariableType.NOMINAL,"text":VariableType.TEXT}
            var_type = mapping.get(raw, VariableType.TEXT)
            role = self._role(col, series, var_type)
            missing_count = int(series.isnull().sum())
            missing_pct = round(missing_count/len(series)*100,2) if len(series)>0 else 0.0
            sample = [str(v) if not isinstance(v,(int,float,bool)) else v for v in series.dropna().head(5).tolist()]
            variables.append(VariableInfo(name=col, type=var_type, unique_count=int(series.nunique()),
                missing_count=missing_count, missing_pct=missing_pct, sample_values=sample, suggested_role=role))
            if missing_pct > 20: warnings.append(f"'{col}' sütununda eksik veri yüksek (%{missing_pct}).")
        preview = df.head(n_preview).fillna("").to_dict(orient="records")
        preview = [{k:(str(v) if not isinstance(v,(int,float,bool,type(None))) else v) for k,v in r.items()} for r in preview]
        return DataPreviewResponse(success=True, rows=df.shape[0], columns=df.shape[1],
            variables=variables, preview_rows=preview, missing_summary=check_missing_data(df), warnings=warnings)

    def _role(self, col, series, var_type):
        c = col.lower()
        if any(k in c for k in ("id","no","kod","code","sira")): return "id"
        if any(k in c for k in ("gender","cinsiyet","grup","group","sinif","class","sınıf","okul","bolum","grade")): return "grouping"
        if any(k in c for k in ("pretest","pre_test","ontest","öntest")): return "pretest"
        if any(k in c for k in ("posttest","post_test","sontest")): return "posttest"
        if any(k in c for k in ("covar","kovar","kontrol")): return "covariate"
        if var_type==VariableType.ORDINAL and any(col.lower().startswith(p) for p in ("m","item","s","i","mad")): return "scale_item"
        if var_type==VariableType.CONTINUOUS: return "dependent"
        return "independent"

variable_detector_service = VariableDetectorService()
