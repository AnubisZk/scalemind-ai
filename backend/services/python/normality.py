import numpy as np
import pandas as pd
from scipy import stats
import math

def _san(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, dict):
        return {k: _san(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_san(x) for x in v]
    return v

def _skewness(x):
    return float(stats.skew(x, nan_policy="omit"))

def _kurtosis(x):
    return float(stats.kurtosis(x, nan_policy="omit"))

def _shapiro(x):
    n = len(x)
    if n < 3:
        return None
    if n > 5000:
        x = np.random.choice(x, 5000, replace=False)
    try:
        return float(stats.shapiro(x).pvalue)
    except:
        return None

def _ks(x):
    try:
        mu, sigma = np.mean(x), np.std(x)
        return float(stats.kstest(x, "norm", args=(mu, sigma)).pvalue)
    except:
        return None

def mardia_test(df):
    X = df.dropna().values.astype(float)
    n, p = X.shape
    if n < p + 1:
        return None
    mu = X.mean(axis=0)
    X_c = X - mu
    S = np.cov(X_c.T, bias=False)
    try:
        S_inv = np.linalg.inv(S)
    except:
        return None
    D = X_c @ S_inv @ X_c.T
    mah_diag = np.diag(D)
    b1p = float(np.sum(D ** 3) / (n ** 2))
    k_skew = n * b1p / 6
    df_skew = p * (p + 1) * (p + 2) / 6
    p_skew = float(1 - stats.chi2.cdf(k_skew, df_skew))
    b2p = float(np.sum(mah_diag ** 2) / n)
    expected_b2p = p * (p + 2)
    z_kurt = (b2p - expected_b2p) / max(np.sqrt(8 * p * (p + 2) / n), 1e-10)
    p_kurt = float(2 * (1 - stats.norm.cdf(abs(z_kurt))))
    threshold = stats.chi2.ppf(0.999, df=p)
    outlier_indices = [int(i) for i, d in enumerate(mah_diag) if d > threshold]
    is_mv_normal = p_skew > 0.05 and p_kurt > 0.05
    return {
        "mardiaSkewness": round(b1p, 4),
        "mardiaSkewnessPValue": round(p_skew, 4),
        "mardiaKurtosis": round(b2p, 4),
        "mardiaKurtosisPValue": round(p_kurt, 4),
        "isMultivariateNormal": is_mv_normal,
        "mahalanobisOutliers": outlier_indices,
        "nOutliers": len(outlier_indices),
        "threshold": round(float(threshold), 3),
    }

def compute_normality(df):
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    df_num = df[numeric_cols].dropna()
    univariate = []
    any_non_normal = False
    for col in numeric_cols:
        x = df_num[col].dropna().values
        if len(x) < 3:
            continue
        sk = _skewness(x)
        ku = _kurtosis(x)
        sw_p = _shapiro(x)
        ks_p = _ks(x)
        is_normal = abs(sk) < 2 and abs(ku) < 7
        if not is_normal:
            any_non_normal = True
        univariate.append({
            "variable": col,
            "mean": round(float(np.mean(x)), 3),
            "sd": round(float(np.std(x)), 3),
            "skewness": round(sk, 3),
            "kurtosis": round(ku, 3),
            "swPValue": round(sw_p, 4) if sw_p is not None else None,
            "ksPValue": round(ks_p, 4) if ks_p is not None else None,
            "isNormal": is_normal,
        })
    multivariate = None
    if len(numeric_cols) >= 3:
        multivariate = mardia_test(df_num)
    mv_normal = multivariate.get("isMultivariateNormal", False) if multivariate else False
    n = len(df_num)
    if mv_normal and not any_non_normal:
        recommendation = "ml"
        reason = "Multivariate normality satisfied. ML estimator recommended."
    elif any_non_normal and n >= 200:
        recommendation = "mlr"
        reason = "Normality violated. MLR (Robust ML) recommended."
    elif n < 200:
        recommendation = "bootstrap"
        reason = "Small sample (n<200). Bootstrap or WLSMV recommended."
    else:
        recommendation = "wlsmv"
        reason = "Ordinal/Likert data. WLSMV recommended."
    result = {
        "univariate": univariate,
        "multivariate": multivariate,
        "recommendation": recommendation,
        "recommendationReason": reason,
        "n": n,
        "nVariables": len(numeric_cols),
    }
    return _san(result)
