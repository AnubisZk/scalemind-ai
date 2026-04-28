
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np

def detect_variable_type(series: pd.Series) -> str:
    clean = series.dropna()
    if len(clean)==0: return "text"
    nunique = clean.nunique()
    if pd.api.types.is_numeric_dtype(clean):
        if nunique==2: return "binary"
        elif nunique<=10: return "ordinal"
        else: return "continuous"
    else:
        if nunique==2: return "binary"
        elif nunique<=20: return "nominal"
        else: return "text"

def check_missing_data(df: pd.DataFrame) -> Dict[str,Any]:
    total = df.shape[0]*df.shape[1]
    mp = df.isnull().sum()
    return {
        "total_missing": int(df.isnull().sum().sum()),
        "total_missing_pct": round(df.isnull().sum().sum()/total*100,2),
        "per_column": {col:{"count":int(mp[col]),"pct":round(mp[col]/df.shape[0]*100,2)} for col in df.columns},
        "rows_with_any_missing": int(df.isnull().any(axis=1).sum()),
        "complete_rows": int(df.dropna().shape[0]),
    }

def detect_outliers_iqr(series: pd.Series) -> List[int]:
    q1,q3 = series.quantile(0.25),series.quantile(0.75)
    iqr = q3-q1
    mask = (series<q1-1.5*iqr)|(series>q3+1.5*iqr)
    return list(series[mask].index)
