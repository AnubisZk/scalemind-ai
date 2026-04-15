
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
# ScaleMind AI — Kapsam Geçerliliği Servisi (Python)
# I-CVI, S-CVI/Ave, S-CVI/UA
# ============================================================

def compute_content_validity(
    expert_count: int,
    ratings: dict,  # item -> [puan listesi]
    scale: int = 2  # 1=ikili, 2=4'lü Likert
) -> dict:
    """
    Kapsam Geçerlilik İndeksi hesabı.

    İkili ölçek (0/1): Uygun=1, Uygun değil=0
    4'lü Likert: 3 ve 4 = kapsamla ilgili (uygun kabul edilir)

    Lynn (1986) ve Polit & Beck (2006) kriterlerine göre:
    - I-CVI ≥ 0.78 (3+ uzman) veya 1.00 (1-2 uzman)
    - S-CVI/Ave ≥ 0.90
    - S-CVI/UA ≥ 0.80
    """
    items = list(ratings.keys())
    n_experts = expert_count

    # Uzman sayısına göre I-CVI eşiği (Lynn, 1986)
    if n_experts <= 2:
        i_cvi_threshold = 1.00
    elif n_experts == 3:
        i_cvi_threshold = 0.83
    elif n_experts <= 5:
        i_cvi_threshold = 0.80
    else:
        i_cvi_threshold = 0.78

    icvi_results = []
    n_adequate = 0

    for item in items:
        scores = ratings[item]
        if scale == 1:
            # İkili: 1 = uygun
            relevant = sum(1 for s in scores if s == 1)
        else:
            # 4'lü Likert: 3 veya 4 = uygun
            relevant = sum(1 for s in scores if s >= 3)

        i_cvi = relevant / n_experts if n_experts > 0 else 0
        adequate = i_cvi >= i_cvi_threshold
        if adequate:
            n_adequate += 1

        icvi_results.append({
            "item": item,
            "value": round(i_cvi, 3),
            "adequate": adequate,
            "relevantExperts": relevant,
            "totalExperts": n_experts,
        })

    # S-CVI/Ave: Tüm I-CVI değerlerinin ortalaması
    scvi_ave = round(
        sum(r["value"] for r in icvi_results) / len(items), 3
    ) if items else 0

    # S-CVI/UA: Tüm uzmanların uygun bulduğu madde oranı
    # (tüm uzmanların 3/4 verdiği maddeler)
    all_relevant_items = 0
    for item in items:
        scores = ratings[item]
        if scale == 1:
            all_rel = all(s == 1 for s in scores)
        else:
            all_rel = all(s >= 3 for s in scores)
        if all_rel:
            all_relevant_items += 1

    scvi_ua = round(all_relevant_items / len(items), 3) if items else 0

    # Sorunlu maddeler
    problematic = [r["item"] for r in icvi_results if not r["adequate"]]
    borderline = [
        r["item"] for r in icvi_results
        if r["adequate"] and r["value"] < i_cvi_threshold + 0.10
    ]

    # Öneriler
    recommendations = []
    if scvi_ave >= 0.90:
        recommendations.append(
            f"S-CVI/Ave = {scvi_ave} — Ölçeğin genel kapsam geçerliliği yeterlidir (≥.90)."
        )
    else:
        recommendations.append(
            f"S-CVI/Ave = {scvi_ave} — Yeterli değil (≥.90 olmalı). Sorunlu maddeler revize edilmeli."
        )

    if scvi_ua >= 0.80:
        recommendations.append(
            f"S-CVI/UA = {scvi_ua} — Uzman uyumu güçlüdür (≥.80)."
        )
    else:
        recommendations.append(
            f"S-CVI/UA = {scvi_ua} — Uzmanlar arası uyum yetersiz. Madde ifadeleri gözden geçirilmeli."
        )

    for item in problematic:
        val = next(r["value"] for r in icvi_results if r["item"] == item)
        recommendations.append(
            f"'{item}' maddesi düşük I-CVI ({val}) — Bu madde çıkarılmalı veya köklü biçimde revize edilmelidir."
        )

    for item in borderline:
        val = next(r["value"] for r in icvi_results if r["item"] == item)
        recommendations.append(
            f"'{item}' maddesi sınırda I-CVI ({val}) — Uzman görüşleri dikkate alınarak revize edilebilir."
        )

    return _san({
        "icvi": icvi_results,
        "scviAve": scvi_ave,
        "scviUa": scvi_ua,
        "expertCount": n_experts,
        "threshold": i_cvi_threshold,
        "problematicItems": problematic,
        "borderlineItems": borderline,
        "recommendations": recommendations,
        "nAdequateItems": n_adequate,
        "nTotalItems": len(items),
    })