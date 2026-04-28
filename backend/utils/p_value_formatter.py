
from typing import Optional

def format_p_value(p: Optional[float], prefix: str = "p") -> str:
    if p is None: return f"{prefix} = N/A"
    if p < 0.001: return f"{prefix} < .001"
    formatted = f"{p:.3f}".lstrip("0")
    if not formatted.startswith("."): formatted = "." + formatted.split(".")[-1]
    return f"{prefix} = {formatted}"

def format_statistic(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}"

def format_df(df: float) -> str:
    return str(int(df)) if df == int(df) else f"{df:.2f}"

def interpret_significance(p: Optional[float], alpha: float = 0.05) -> dict:
    if p is None:
        return {"significant": False, "label_tr": "Hesaplanamadı", "label_en": "Could not compute", "symbol": "—"}
    if p < 0.001: return {"significant": True, "label_tr": "İleri düzeyde anlamlı", "label_en": "Highly significant", "symbol": "***"}
    elif p < 0.01: return {"significant": True, "label_tr": "Çok anlamlı", "label_en": "Very significant", "symbol": "**"}
    elif p < alpha: return {"significant": True, "label_tr": "İstatistiksel olarak anlamlı", "label_en": "Statistically significant", "symbol": "*"}
    elif p < 0.10: return {"significant": False, "label_tr": "Sınırda anlamlı", "label_en": "Marginally significant", "symbol": "†"}
    else: return {"significant": False, "label_tr": "Anlamlı değil", "label_en": "Not significant", "symbol": "ns"}
