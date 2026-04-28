
from typing import Any, Dict, List, Optional
import pandas as pd
import numpy as np
from scipy import stats
from schemas.statistics_schema import DescriptiveStats, DescriptiveResponse

class DescriptiveService:
    def compute(self, df, variables, group_by=None, confidence_level=0.95, include_frequency=False):
        results = []
        freq_tables = {}
        for var in variables:
            if var not in df.columns: continue
            if group_by and group_by in df.columns:
                for grp, gdf in df.groupby(group_by):
                    results.append(self._single(gdf[var].dropna(), var, str(grp), confidence_level))
            else:
                results.append(self._single(df[var].dropna(), var, None, confidence_level))
            if include_frequency and pd.api.types.is_object_dtype(df[var]):
                counts = df[var].value_counts()
                total = len(df[var].dropna())
                freq_tables[var] = {str(k):{"count":int(v),"percent":round(v/total*100,2)} for k,v in counts.items()}
        return DescriptiveResponse(success=True, results=results, frequency_tables=freq_tables or None)

    def _single(self, series, var, group, ci_level):
        n = len(series)
        if n == 0: return DescriptiveStats(variable=var, group=group, n=0)
        if not pd.api.types.is_numeric_dtype(series): return DescriptiveStats(variable=var, group=group, n=n)
        mean = float(series.mean())
        std = float(series.std(ddof=1)) if n>1 else 0.0
        se = std/np.sqrt(n)
        if n>1:
            t_crit = stats.t.ppf((1+ci_level)/2, df=n-1)
            ci_lower, ci_upper = mean-t_crit*se, mean+t_crit*se
        else:
            ci_lower = ci_upper = mean
        mode_r = series.mode()
        mode_val = float(mode_r.iloc[0]) if len(mode_r)>0 else None
        return DescriptiveStats(
            variable=var, group=group, n=n,
            mean=round(mean,4), std=round(std,4), se=round(se,4),
            median=round(float(series.median()),4),
            mode=round(mode_val,4) if mode_val is not None else None,
            min=round(float(series.min()),4), max=round(float(series.max()),4),
            variance=round(float(series.var(ddof=1)),4) if n>1 else 0.0,
            skewness=round(float(series.skew()),4) if n>=3 else None,
            kurtosis=round(float(series.kurtosis()),4) if n>=4 else None,
            ci_lower=round(ci_lower,4), ci_upper=round(ci_upper,4),
            q1=round(float(series.quantile(0.25)),4), q3=round(float(series.quantile(0.75)),4),
        )

descriptive_service = DescriptiveService()
