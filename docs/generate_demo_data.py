#!/usr/bin/env python3
"""
ScaleMind AI — Demo Veri Seti Üreticisi
48 madde, 4 boyutlu Likert ölçeği (1-5), n=250 katılımcı
"""
import numpy as np
import pandas as pd

np.random.seed(42)
n = 250

# 4 boyut, her boyut 12 madde
# Boyut korelasyonları gerçekçi (r=0.3-0.5)
factor_corr = np.array([
    [1.00, 0.45, 0.35, 0.40],
    [0.45, 1.00, 0.30, 0.38],
    [0.35, 0.30, 1.00, 0.42],
    [0.40, 0.38, 0.42, 1.00],
])

# Cholesky ile korelasyonlu faktörler üret
L = np.linalg.cholesky(factor_corr)
raw = np.random.randn(n, 4)
factors = raw @ L.T

data = {}
demo_vars = ['id', 'yas', 'cinsiyet', 'egitim']

for i in range(n):
    data.setdefault('id', []).append(i + 1)
    data.setdefault('yas', []).append(int(np.random.normal(28, 6)))
    data.setdefault('cinsiyet', []).append(np.random.choice([1, 2]))
    data.setdefault('egitim', []).append(np.random.choice([1, 2, 3, 4], p=[0.1, 0.2, 0.5, 0.2]))

factor_labels = ['BilBaş', 'BilBaş', 'BilBaş', 'BilBaş', 'BilBaş', 'BilBaş',
                 'BilBaş', 'BilBaş', 'BilBaş', 'BilBaş', 'BilBaş', 'BilBaş',
                 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK',
                 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK', 'ÖzyetK',
                 'Motivs', 'Motivs', 'Motivs', 'Motivs', 'Motivs', 'Motivs',
                 'Motivs', 'Motivs', 'Motivs', 'Motivs', 'Motivs', 'Motivs',
                 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk',
                 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk', 'SosDesk']

factor_idx = [0]*12 + [1]*12 + [2]*12 + [3]*12

# Ters maddeler (gerçekçi): her boyutta 2-3 tane
reversed_items = {5, 10, 17, 22, 28, 33, 39, 44}

for m in range(48):
    item_name = f"M{m+1:02d}"
    fac = factor_idx[m]
    loading = np.random.uniform(0.55, 0.80)
    noise = np.sqrt(1 - loading**2)

    scores = loading * factors[:, fac] + noise * np.random.randn(n)
    # 1-5 Likert'e dönüştür
    likert = np.clip(np.round(scores * 0.9 + 3).astype(int), 1, 5)

    # Ters maddeler: 6-item = 6-(item-1)
    if (m + 1) in reversed_items:
        likert = 6 - likert

    # %3-5 eksik veri ekle (gerçekçi)
    missing_mask = np.random.rand(n) < 0.035
    likert = likert.astype(float)
    likert[missing_mask] = np.nan

    data[item_name] = likert.tolist()

df = pd.DataFrame(data)
df.to_csv('demo_veri_seti.csv', index=False, float_format='%.0f', na_rep='')
print(f"Demo veri seti oluşturuldu: {n} katılımcı, 48 madde, 4 boyut")
print(f"Dosya: demo_veri_seti.csv")
print(f"\nBoyutlar:")
print(f"  BilBaş  (Bilişsel Başarı):   M01-M12")
print(f"  ÖzyetK  (Özyeterlik):        M13-M24")
print(f"  Motivs  (Motivasyon):        M25-M36")
print(f"  SosDesk (Sosyal Destek):     M37-M48")
print(f"\nTers maddeler: {sorted(reversed_items)}")
