
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
# ScaleMind AI — Madde Analizi Servisi (Python)
# ============================================================

import numpy as np
import pandas as pd
from scipy import stats


def _corrected_item_total(df: pd.DataFrame, item: str) -> float:
    """Düzeltilmiş madde-toplam korelasyonu (madde çıkarıldıktan sonraki toplam)."""
    rest = df.drop(columns=[item]).sum(axis=1)
    r, _ = stats.pearsonr(df[item].dropna(), rest[df[item].notna()])
    return round(float(r), 3)

def _alpha(df: pd.DataFrame) -> float:
    """Cronbach alpha hesabı."""
    k = df.shape[1]
    if k < 2:
        return float("nan")
    item_vars = df.var(ddof=1).sum()
    total_var = df.sum(axis=1).var(ddof=1)
    if total_var == 0:
        return float("nan")
    return round(float((k / (k - 1)) * (1 - item_vars / total_var)), 3)

def compute_item_analysis(df: pd.DataFrame) -> dict:
    """
    Her madde için betimsel istatistikler,
    madde-toplam korelasyonları ve alpha değerleri.
    """
    df_clean = df.dropna()
    n = len(df_clean)
    items = df_clean.columns.tolist()
    base_alpha = _alpha(df_clean)

    item_stats = []
    for item in items:
        x = df_clean[item].values
        mean_val = float(np.mean(x))
        sd_val = float(np.std(x, ddof=1))
        min_val = float(np.min(x))
        max_val = float(np.max(x))

        # Taban/tavan etkisi (>%20 uç değerde)
        unique_vals = sorted(df_clean[item].unique())
        floor_rate = float((x == min(unique_vals)).mean())
        ceiling_rate = float((x == max(unique_vals)).mean())

        # Madde-toplam korelasyonu (düzeltilmemiş)
        total = df_clean.sum(axis=1)
        r_total, _ = stats.pearsonr(x, total)

        # Düzeltilmiş madde-toplam
        corr_item_total = _corrected_item_total(df_clean, item)

        # Alpha if deleted
        df_dropped = df_clean.drop(columns=[item])
        alpha_if_del = _alpha(df_dropped) if len(items) > 2 else float("nan")

        sk = float(stats.skew(x))
        ku = float(stats.kurtosis(x))

        item_stats.append({
            "name": item,
            "mean": round(mean_val, 3),
            "sd": round(sd_val, 3),
            "min": round(min_val, 3),
            "max": round(max_val, 3),
            "skewness": round(sk, 3),
            "kurtosis": round(ku, 3),
            "itemTotalCorr": round(float(r_total), 3),
            "correctedItemTotalCorr": corr_item_total,
            "alphaIfDeleted": round(alpha_if_del, 3) if not np.isnan(alpha_if_del) else None,
            "floorEffect": floor_rate > 0.20,
            "ceilingEffect": ceiling_rate > 0.20,
            "floorRate": round(floor_rate, 3),
            "ceilingRate": round(ceiling_rate, 3),
        })

    # Korelasyon matrisi
    corr_matrix = df_clean.corr(method="pearson").round(3).values.tolist()

    # Zayıf maddeler (düzeltilmiş r < 0.30)
    weak_items = [
        s["name"] for s in item_stats
        if s["correctedItemTotalCorr"] is not None and s["correctedItemTotalCorr"] < 0.30
    ]

    # Yüksek korelasyonlu çiftler (r > 0.85 — çok yüksek benzerlik uyarısı)
    redundant_pairs = []
    corr_df = df_clean.corr(method="pearson")
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            r = corr_df.iloc[i, j]
            if abs(r) > 0.85:
                redundant_pairs.append([items[i], items[j], round(float(r), 3)])

    # Öneriler
    recommendations = []
    if weak_items:
        recommendations.append(
            f"{len(weak_items)} madde düşük madde-toplam korelasyonuna sahip (r<.30): {', '.join(weak_items)}. Bu maddeler revize edilmeli veya çıkarılmalıdır."
        )
    if redundant_pairs:
        pairs_str = "; ".join([f"{p[0]}–{p[1]} (r={p[2]})" for p in redundant_pairs])
        recommendations.append(
            f"Yüksek korelasyonlu madde çiftleri tespit edildi: {pairs_str}. Bu maddeler fazlalık içeriyor olabilir."
        )
    tavan_items = [s["name"] for s in item_stats if s["ceilingEffect"]]
    taban_items = [s["name"] for s in item_stats if s["floorEffect"]]
    if tavan_items:
        recommendations.append(f"Tavan etkisi: {', '.join(tavan_items)} — Katılımcılar bu maddelerde yığılma gösteriyor.")
    if taban_items:
        recommendations.append(f"Taban etkisi: {', '.join(taban_items)} — Katılımcılar bu maddelerde yığılma gösteriyor.")

    return _san({
        "n": n,
        "nItems": len(items),
        "baseAlpha": base_alpha,
        "items": item_stats,
        "correlationMatrix": corr_matrix,
        "variableNames": items,
        "weakItems": weak_items,
        "redundantPairs": redundant_pairs,
        "recommendations": recommendations,
    })