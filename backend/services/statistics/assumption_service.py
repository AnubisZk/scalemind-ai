
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats
from schemas.statistics_schema import NormalityResult, HomogeneityResult, OutlierResult, AssumptionResponse
from utils.p_value_formatter import format_p_value

class AssumptionService:
    def run_all(self, df, dependent_var, group_var=None, alpha=0.05):
        normality = self.normality(df, dependent_var, group_var, alpha)
        homogeneity = self.homogeneity(df, dependent_var, group_var, alpha) if group_var else None
        outliers = self.outliers(df, [dependent_var])
        warnings = []
        for r in normality:
            if r.severity == "violation":
                warnings.append(f"{r.variable} normallik varsayımı ihlali. Non-parametrik test önerilir.")
        if homogeneity:
            for h in homogeneity:
                if h.severity == "violation":
                    warnings.append(f"Varyans homojenliği ihlali. Welch düzeltmesi önerilir.")
        norm_ok = all(r.is_normal for r in normality)
        homo_ok = all(h.is_homogeneous for h in homogeneity) if homogeneity else True
        if norm_ok and homo_ok: verdict = "parametric_ok"
        elif norm_ok and not homo_ok: verdict = "use_welch"
        elif not norm_ok: verdict = "use_nonparametric"
        else: verdict = "check_manually"
        return AssumptionResponse(success=True, normality=normality, homogeneity=homogeneity,
                                  outliers=outliers, overall_verdict=verdict, warnings=warnings)

    def normality(self, df, variable, group_var=None, alpha=0.05):
        results = []
        if group_var and group_var in df.columns:
            for grp, gdf in df.groupby(group_var):
                results.append(self._norm_single(gdf[variable].dropna(), variable, str(grp), alpha))
        else:
            results.append(self._norm_single(df[variable].dropna(), variable, None, alpha))
        return results

    def _norm_single(self, series, variable, group, alpha):
        n = len(series)
        sw_stat = sw_p = ks_stat = ks_p = ad_stat = None
        skewness = float(series.skew()) if n>=3 else None
        kurtosis = float(series.kurtosis()) if n>=4 else None
        if n < 3:
            return NormalityResult(variable=variable, group=group, n=n, is_normal=True, severity="warning",
                interpretation_tr=f"n={n} çok küçük.", interpretation_en=f"n={n} too small.")
        if n <= 5000:
            try: sw_stat, sw_p = stats.shapiro(series); sw_stat,sw_p = float(sw_stat),float(sw_p)
            except: pass
        try: ks_stat, ks_p = stats.kstest(series,"norm",args=(series.mean(),series.std())); ks_stat,ks_p=float(ks_stat),float(ks_p)
        except: pass
        try: ad_stat = float(stats.anderson(series,dist="norm").statistic)
        except: pass
        primary_p = sw_p if sw_p is not None else ks_p
        is_normal = (primary_p is None) or (primary_p >= alpha)
        severity = "ok" if is_normal else ("warning" if (primary_p or 0)>=alpha/2 else "violation")
        g = f" ({group})" if group else ""
        if is_normal:
            itr = f"{variable}{g}: Normallik sağlanmaktadır" + (f" (SW={sw_stat:.3f}, {format_p_value(sw_p)})." if sw_stat else ".")
            ien = f"{variable}{g}: Normality is met" + (f" (SW={sw_stat:.3f}, {format_p_value(sw_p)})." if sw_stat else ".")
        else:
            itr = f"{variable}{g}: Normallik ihlal edilmiştir" + (f" (SW={sw_stat:.3f}, {format_p_value(sw_p)}). Non-parametrik test önerin." if sw_stat else ".")
            ien = f"{variable}{g}: Normality violated" + (f" (SW={sw_stat:.3f}, {format_p_value(sw_p)}). Consider non-parametric." if sw_stat else ".")
        return NormalityResult(variable=variable, group=group, n=n,
            shapiro_stat=round(sw_stat,4) if sw_stat else None, shapiro_p=round(sw_p,4) if sw_p else None,
            ks_stat=round(ks_stat,4) if ks_stat else None, ks_p=round(ks_p,4) if ks_p else None,
            anderson_stat=round(ad_stat,4) if ad_stat else None,
            skewness=round(skewness,4) if skewness else None, kurtosis=round(kurtosis,4) if kurtosis else None,
            is_normal=is_normal, severity=severity, interpretation_tr=itr, interpretation_en=ien)

    def homogeneity(self, df, dependent_var, group_var, alpha=0.05):
        groups = [g.dropna() for _,g in df.groupby(group_var)[dependent_var]]
        lev_stat=lev_p=bar_stat=bar_p=None
        try: lev_stat,lev_p=stats.levene(*groups); lev_stat,lev_p=float(lev_stat),float(lev_p)
        except: pass
        try: bar_stat,bar_p=stats.bartlett(*groups); bar_stat,bar_p=float(bar_stat),float(bar_p)
        except: pass
        primary_p = lev_p
        is_homo = (primary_p is None) or (primary_p>=alpha)
        severity = "ok" if is_homo else "violation"
        itr = (f"Levene: F={lev_stat:.3f}, {format_p_value(lev_p)}. " if lev_stat else "") +               ("Varyans homojenliği sağlanmaktadır." if is_homo else "Varyans homojenliği sağlanmamaktadır. Welch kullanın.")
        ien = (f"Levene: F={lev_stat:.3f}, {format_p_value(lev_p)}. " if lev_stat else "") +               ("Homogeneity met." if is_homo else "Homogeneity violated. Use Welch.")
        return [HomogeneityResult(dependent_variable=dependent_var, group_variable=group_var,
            levene_stat=round(lev_stat,4) if lev_stat else None, levene_p=round(lev_p,4) if lev_p else None,
            bartlett_stat=round(bar_stat,4) if bar_stat else None, bartlett_p=round(bar_p,4) if bar_p else None,
            is_homogeneous=is_homo, severity=severity, interpretation_tr=itr, interpretation_en=ien)]

    def outliers(self, df, variables):
        results = []
        for var in variables:
            if var not in df.columns: continue
            series = df[var].dropna()
            if not pd.api.types.is_numeric_dtype(series): continue
            q1,q3 = series.quantile(0.25),series.quantile(0.75)
            iqr = q3-q1
            idx = list(series[(series<q1-1.5*iqr)|(series>q3+1.5*iqr)].index)
            pct = round(len(idx)/len(series)*100,2)
            results.append(OutlierResult(variable=var, method="IQR", outlier_indices=idx[:20],
                outlier_count=len(idx), outlier_pct=pct,
                severity="ok" if pct==0 else ("warning" if pct<5 else "violation")))
        return results

assumption_service = AssumptionService()
