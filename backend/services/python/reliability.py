
import math as _math

def _san(v):
    if isinstance(v, float) and (_math.isnan(v) or _math.isinf(v)):
        return None
    if isinstance(v, dict):
        return {k: _san(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_san(x) for x in v]
    return v

# ============================================================
# ScaleMind AI — Güvenirlik Servisi (Python fallback)
# R yokken çalışır: Cronbach alpha + split-half
# Tam omega hesabı için r_scripts/reliability.R kullanılır
# ============================================================

import numpy as np
import pandas as pd
from scipy import stats


def _alpha(df: pd.DataFrame) -> float:
    k = df.shape[1]
    if k < 2:
        return float("nan")
    item_vars = df.var(ddof=1).sum()
    total_var = df.sum(axis=1).var(ddof=1)
    if total_var == 0 or k <= 1:
        return float("nan")
    if item_vars == 0:
        return float("nan")
    return round(float((k / (k - 1)) * (1 - item_vars / total_var)), 3)


def compute_reliability(df: pd.DataFrame) -> dict:
    df_clean = df.dropna()
    n = len(df_clean)
    k = df_clean.shape[1]
    items = df_clean.columns.tolist()

    ca = _alpha(df_clean)

    # CI (basit yaklaşım)
    ase = round(np.sqrt((2 * k * (1 - ca)**2) / ((k - 1) * n)) if (k - 1) * n > 0 else 0, 3)
    ca_lo = round(max(0, ca - 1.96 * ase), 3)
    ca_hi = round(min(1, ca + 1.96 * ase), 3)

    # Split-half
    n_half = k // 2
    half1 = df_clean.iloc[:, :n_half].sum(axis=1)
    half2 = df_clean.iloc[:, n_half:].sum(axis=1)
    sh_r = round(float(np.corrcoef(half1, half2)[0, 1]), 3)
    sb = round(2 * sh_r / (1 + sh_r), 3)

    # Inter-item korelasyon
    corr_mat = df_clean.corr()
    off_diag = corr_mat.values[np.triu_indices(k, k=1)]
    mean_iic = round(float(np.mean(off_diag)), 3)

    # Alpha if deleted
    alpha_if_del = {}
    for item in items:
        dropped = df_clean.drop(columns=[item])
        alpha_if_del[item] = _alpha(dropped)

    interpretation = (
        "Mükemmel (≥.90)" if ca >= 0.90 else
        "İyi (.80–.89)" if ca >= 0.80 else
        "Kabul edilebilir (.70–.79)" if ca >= 0.70 else
        "Zayıf (.60–.69)" if ca >= 0.60 else
        "Kabul edilemez (<.60)"
    )

    warnings = [
        "NOT: Bu sonuçlar Python fallback motoruyla hesaplandı. "
        "McDonald omega için R kurulumu gereklidir."
    ]
    if ca < 0.70:
        warnings.append(f"Cronbach alpha ({ca}) .70 altında — güvenirlik düşük.")

    import math

    def safe(v):
        if v is None: return None
        try:
            return None if math.isnan(v) or math.isinf(v) else v
        except: return None

    return _san({
        "n": n,
        "nItems": k,
        "cronbachAlpha": safe(ca),
        "cronbachAlphaCI": [safe(ca_lo), safe(ca_hi)],
        "mcdonaldOmegaTotal": None,
        "mcdonaldOmegaHierarchical": None,
        "splitHalf": safe(sh_r),
        "spearmanBrown": safe(sb),
        "meanInterItemCorr": safe(mean_iic),
        "alphaIfDeleted": {k: safe(v) for k, v in alpha_if_del.items()},
        "interpretation": interpretation,
        "subscales": [],
        "warnings": warnings,
    })