
from typing import Any, Dict, List, Optional
from utils.p_value_formatter import format_p_value, format_statistic, format_df
from utils.effect_size_interpreter import interpret_effect_size

def _fmt(val, decimals=2): return f"{val:.{decimals}f}"

class ApaStatisticsReportService:

    def independent_t(self, test_name, group1, group2, t, df, p, d, mean1, mean2, sd1, sd2, n1, n2):
        p_str = format_p_value(p)
        d_tr = interpret_effect_size("cohen_d", d)["label_tr"]
        d_en = interpret_effect_size("cohen_d", d)["label_en"]
        sig_tr = "anlamlı bir fark bulunmuştur" if p<0.05 else "anlamlı bir fark bulunamamıştır"
        sig_en = "a statistically significant difference was found" if p<0.05 else "no statistically significant difference was found"
        tr = (f"Bağımsız örneklem t-testi sonucunda {group1} ve {group2} grupları arasında istatistiksel olarak {sig_tr}, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, Cohen's d = {format_statistic(d)} ({d_tr}).")
        en = (f"An independent-samples t-test indicated that {sig_en} between the {group1} and {group2} groups, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, Cohen's d = {format_statistic(d)} ({d_en}).")
        return {"tr": tr, "en": en}

    def paired_t(self, group1, group2, t, df, p, d, n):
        p_str = format_p_value(p)
        d_tr = interpret_effect_size("cohen_d", d)["label_tr"]
        sig_tr = "anlamlı bir fark bulunmuştur" if p<0.05 else "anlamlı bir fark bulunamamıştır"
        sig_en = "a statistically significant difference was found" if p<0.05 else "no statistically significant difference was found"
        tr = (f"Eşleştirilmiş örneklem t-testi sonucunda {group1} ve {group2} ölçümleri arasında istatistiksel olarak {sig_tr}, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, Cohen's d = {format_statistic(d)} ({d_tr}). n={n} çift.")
        en = (f"A paired-samples t-test indicated that {sig_en} between {group1} and {group2}, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, Cohen's d = {format_statistic(d)}. n={n} pairs.")
        return {"tr": tr, "en": en}

    def one_sample_t(self, variable, mu, t, df, p, d, mean, sd, n):
        p_str = format_p_value(p)
        d_tr = interpret_effect_size("cohen_d", d)["label_tr"]
        sig_tr = "anlamlı biçimde farklılaşmaktadır" if p<0.05 else "anlamlı biçimde farklılaşmamaktadır"
        tr = (f"Tek örneklem t-testi sonucunda {variable} (M={_fmt(mean)}, SS={_fmt(sd)}, n={n}) "
              f"referans değerden (μ={mu}) istatistiksel olarak {sig_tr}, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, d = {format_statistic(d)} ({d_tr}).")
        en = (f"A one-sample t-test indicated that {variable} (M={_fmt(mean)}, SD={_fmt(sd)}, n={n}) "
              f"was {'significantly' if p<0.05 else 'not significantly'} different from μ={mu}, "
              f"t({format_df(df)}) = {format_statistic(t)}, {p_str}, d = {format_statistic(d)}.")
        return {"tr": tr, "en": en}

    def one_way_anova(self, dv, iv, F, df1, df2, p, eta_sq):
        p_str = format_p_value(p)
        eta_tr = interpret_effect_size("eta_squared", eta_sq)["label_tr"]
        sig_tr = "anlamlı bir fark saptanmıştır" if p<0.05 else "anlamlı bir fark saptanamamıştır"
        sig_en = "a statistically significant difference was found" if p<0.05 else "no statistically significant difference was found"
        tr = (f"Tek yönlü ANOVA sonucunda gruplar arasında {sig_tr}, "
              f"F({df1}, {df2}) = {format_statistic(F)}, {p_str}, η² = {format_statistic(eta_sq,3)} ({eta_tr}).")
        en = (f"A one-way ANOVA indicated that {sig_en} among groups, "
              f"F({df1}, {df2}) = {format_statistic(F)}, {p_str}, η² = {format_statistic(eta_sq,3)}.")
        return {"tr": tr, "en": en}

    def ancova(self, dv, iv, covariates, F, p, partial_eta):
        p_str = format_p_value(p)
        eta_tr = interpret_effect_size("partial_eta_squared", partial_eta)["label_tr"]
        sig_tr = "anlamlı bulunmuştur" if p<0.05 else "anlamlı bulunamamıştır"
        tr = (f"ANCOVA sonucunda {", ".join(covariates)} kontrol edildikten sonra {iv} etkisi {sig_tr}, "
              f"F = {format_statistic(F)}, {p_str}, η²p = {format_statistic(partial_eta,3)} ({eta_tr}).")
        en = (f"ANCOVA indicated that the effect of {iv} was {'significant' if p<0.05 else 'not significant'} "
              f"after controlling for {", ".join(covariates)}, F = {format_statistic(F)}, {p_str}.")
        return {"tr": tr, "en": en}

    def mann_whitney(self, group1, group2, U, z, p, r, n1, n2):
        p_str = format_p_value(p)
        r_tr = interpret_effect_size("rank_biserial", r)["label_tr"]
        sig_tr = "anlamlı bir fark bulunmuştur" if p<0.05 else "anlamlı bir fark bulunamamıştır"
        tr = (f"Mann-Whitney U testi sonucunda {group1} (n={n1}) ve {group2} (n={n2}) arasında {sig_tr}, "
              f"U = {format_statistic(U,0)}, z = {format_statistic(z)}, {p_str}, r = {format_statistic(r,3)} ({r_tr}).")
        en = (f"A Mann-Whitney U test indicated {'a significant' if p<0.05 else 'no significant'} difference "
              f"between {group1} (n={n1}) and {group2} (n={n2}), "
              f"U = {format_statistic(U,0)}, z = {format_statistic(z)}, {p_str}, r = {format_statistic(r,3)}.")
        return {"tr": tr, "en": en}

    def wilcoxon(self, group1, group2, W, p, r, n):
        p_str = format_p_value(p)
        r_tr = interpret_effect_size("rank_biserial", r)["label_tr"]
        sig_tr = "anlamlı bir fark bulunmuştur" if p<0.05 else "anlamlı bir fark bulunamamıştır"
        tr = (f"Wilcoxon işaretli sıra testi sonucunda {group1} ve {group2} arasında {sig_tr}, "
              f"W = {format_statistic(W,0)}, {p_str}, r = {format_statistic(r,3)} ({r_tr}). n={n} çift.")
        en = (f"A Wilcoxon signed-rank test indicated {'a significant' if p<0.05 else 'no significant'} difference "
              f"between {group1} and {group2}, W = {format_statistic(W,0)}, {p_str}, r = {format_statistic(r,3)}.")
        return {"tr": tr, "en": en}

    def kruskal_wallis(self, dv, iv, H, df, p, eta_sq):
        p_str = format_p_value(p)
        eta_tr = interpret_effect_size("eta_squared", eta_sq)["label_tr"]
        sig_tr = "anlamlı bir fark saptanmıştır" if p<0.05 else "anlamlı bir fark saptanamamıştır"
        tr = (f"Kruskal-Wallis H testi sonucunda gruplar arasında {sig_tr}, "
              f"H({df}) = {format_statistic(H)}, {p_str}, η² = {format_statistic(eta_sq,3)} ({eta_tr}).")
        en = (f"A Kruskal-Wallis H test indicated {'a significant' if p<0.05 else 'no significant'} difference, "
              f"H({df}) = {format_statistic(H)}, {p_str}, η² = {format_statistic(eta_sq,3)}.")
        return {"tr": tr, "en": en}

    def friedman(self, dv, iv, chi2, df, p, W, n, k):
        p_str = format_p_value(p)
        sig_tr = "anlamlı bir fark saptanmıştır" if p<0.05 else "anlamlı bir fark saptanamamıştır"
        tr = (f"Friedman testi sonucunda {k} tekrarlı ölçümde {sig_tr}, "
              f"χ²({df}, n={n}) = {format_statistic(chi2)}, {p_str}, Kendall's W = {format_statistic(W,3)}.")
        en = (f"A Friedman test indicated {'a significant' if p<0.05 else 'no significant'} difference across {k} measurements, "
              f"χ²({df}, n={n}) = {format_statistic(chi2)}, {p_str}, Kendall's W = {format_statistic(W,3)}.")
        return {"tr": tr, "en": en}

    def correlation(self, method, pairs):
        if not pairs: return {"tr": "Korelasyon analizi tamamlandı.", "en": "Correlation analysis completed."}
        lines_tr, lines_en = [], []
        for p_info in pairs:
            r, p = p_info["r"], p_info["p"]
            v1, v2, df_val = p_info["var1"], p_info["var2"], p_info["df"]
            r_tr = interpret_effect_size("r", r)["label_tr"]
            p_str = format_p_value(p)
            sig = "anlamlı" if p<0.05 else "anlamlı olmayan"
            lines_tr.append(f"{v1} ile {v2} arasında {sig} ilişki: r({df_val}) = {format_statistic(r,3)}, {p_str} ({r_tr}).")
            lines_en.append(f"{'Significant' if p<0.05 else 'Non-significant'} correlation between {v1} and {v2}: r({df_val}) = {format_statistic(r,3)}, {p_str}.")
        return {"tr": " ".join(lines_tr), "en": " ".join(lines_en)}

    def linear_regression(self, dv, ivs, r2, adj_r2, F, p_F, n, coef_table):
        p_str = format_p_value(p_F)
        k = len(ivs)
        sig_tr = "anlamlı" if p_F<0.05 else "anlamlı olmayan"
        tr = (f"{'Çoklu' if k>1 else 'Basit'} doğrusal regresyon modeli istatistiksel olarak {sig_tr} bulunmuştur, "
              f"F({k}, {n-k-1}) = {format_statistic(F)}, {p_str}, R² = {format_statistic(r2,3)}, düz. R² = {format_statistic(adj_r2,3)}. "
              f"Model varyansın %{round(r2*100,1)}'ini açıklamaktadır.")
        en = (f"The {'multiple' if k>1 else 'simple'} linear regression model was statistically {'significant' if p_F<0.05 else 'not significant'}, "
              f"F({k}, {n-k-1}) = {format_statistic(F)}, {p_str}, R² = {format_statistic(r2,3)}, adj. R² = {format_statistic(adj_r2,3)}. "
              f"The model explained {round(r2*100,1)}% of the variance.")
        return {"tr": tr, "en": en}

apa_report_service = ApaStatisticsReportService()
