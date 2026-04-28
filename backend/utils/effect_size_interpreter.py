
from typing import Dict, Tuple
import math

THRESHOLDS = {
    "cohen_d":            {"small":(0.20,0.49),"medium":(0.50,0.79),"large":(0.80,9999)},
    "hedges_g":           {"small":(0.20,0.49),"medium":(0.50,0.79),"large":(0.80,9999)},
    "eta_squared":        {"small":(0.01,0.05),"medium":(0.06,0.13),"large":(0.14,9999)},
    "partial_eta_squared":{"small":(0.01,0.05),"medium":(0.06,0.13),"large":(0.14,9999)},
    "omega_squared":      {"small":(0.01,0.05),"medium":(0.06,0.13),"large":(0.14,9999)},
    "r":                  {"small":(0.10,0.29),"medium":(0.30,0.49),"large":(0.50,9999)},
    "r_squared":          {"small":(0.01,0.08),"medium":(0.09,0.24),"large":(0.25,9999)},
    "cramers_v":          {"small":(0.10,0.29),"medium":(0.30,0.49),"large":(0.50,9999)},
    "rank_biserial":      {"small":(0.10,0.29),"medium":(0.30,0.49),"large":(0.50,9999)},
}
TR = {"negligible":"Önemsiz","small":"Küçük etki","medium":"Orta düzey etki","large":"Büyük etki"}
EN = {"negligible":"Negligible","small":"Small effect","medium":"Medium effect","large":"Large effect"}

def interpret_effect_size(measure: str, value: float) -> dict:
    abs_val = abs(value)
    t = THRESHOLDS.get(measure)
    if not t: return {"category":"unknown","label_tr":"Yorum yapılamadı","label_en":"Cannot interpret","apa_note":""}
    cat = "negligible"
    for c in ("small","medium","large"):
        lo, hi = t[c]
        if abs_val >= lo: cat = c
    return {"category":cat,"label_tr":TR[cat],"label_en":EN[cat],"apa_note":f"{measure}={value:.2f}({cat})"}

def cohen_d(mean1,mean2,std1,std2,n1,n2):
    pooled = math.sqrt(((n1-1)*std1**2+(n2-1)*std2**2)/(n1+n2-2))
    return (mean1-mean2)/pooled if pooled else 0.0

def hedges_g(mean1,mean2,std1,std2,n1,n2):
    d = cohen_d(mean1,mean2,std1,std2,n1,n2)
    return d*(1-3/(4*(n1+n2-2)-1))

def rank_biserial_correlation(U,n1,n2):
    return 1-(2*U)/(n1*n2)
