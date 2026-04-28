
from typing import Any, Dict, List, Optional
from schemas.statistics_schema import VariableType, MeasurementLevel, TestRecommendationRequest, TestRecommendationResponse

class StatisticalDecisionEngine:
    def recommend(self, req):
        test_id, reason_tr, reason_en, warnings = self._decide(req)
        names = {
            "independent_t":"Bağımsız Örneklem t-Testi","welch_t":"Welch t-Testi",
            "paired_t":"Eşleştirilmiş t-Testi","one_sample_t":"Tek Örneklem t-Testi",
            "one_way_anova":"Tek Yönlü ANOVA","welch_anova":"Welch ANOVA",
            "repeated_measures_anova":"Tekrarlı Ölçümler ANOVA","ancova":"ANCOVA",
            "manova":"MANOVA","mann_whitney":"Mann-Whitney U","wilcoxon":"Wilcoxon",
            "kruskal_wallis":"Kruskal-Wallis H","friedman":"Friedman",
            "pearson":"Pearson Korelasyon","spearman":"Spearman Korelasyon",
            "simple_regression":"Basit Regresyon","multiple_regression":"Çoklu Regresyon",
            "chi_square":"Ki-Kare","fisher_exact":"Fisher Kesin Testi",
        }
        alts = {"independent_t":["welch_t","mann_whitney"],"welch_t":["independent_t","mann_whitney"],
                "paired_t":["wilcoxon"],"one_way_anova":["welch_anova","kruskal_wallis"],
                "welch_anova":["one_way_anova","kruskal_wallis"],"kruskal_wallis":["one_way_anova"],
                "pearson":["spearman"],"spearman":["pearson"],"chi_square":["fisher_exact"]}
        posthoc = test_id in ("one_way_anova","welch_anova","kruskal_wallis","friedman","manova","repeated_measures_anova")
        score = 0.5
        if req.normality_ok is not None: score += 0.2
        if req.homogeneity_ok is not None: score += 0.15
        if req.group_count: score += 0.10
        if req.n: score += 0.05
        return TestRecommendationResponse(
            recommended_test=names.get(test_id, test_id),
            recommended_test_id=test_id,
            alternative_tests=[names.get(a,a) for a in alts.get(test_id,[])],
            reason_tr=reason_tr, reason_en=reason_en,
            assumptions_to_check=["normality","homogeneity"],
            effect_size_required=True, posthoc_required=posthoc,
            apa_template_tr="Test sonuçları APA 7 formatında raporlanacaktır.",
            apa_template_en="Results will be reported in APA 7 format.",
            warnings=warnings, confidence=min(score,1.0),
        )

    def _decide(self, req):
        w = []
        n_dv = len(req.dependent_variables)
        n = req.n or 0
        normal = req.normality_ok
        homo = req.homogeneity_ok
        groups = req.group_count or 0
        paired = req.measurement == MeasurementLevel.PAIRED
        repeated = req.measurement == MeasurementLevel.REPEATED
        dep = req.dependent_type
        ind = req.independent_type
        if n and n < 30: w.append(f"n={n} küçük örneklem.")
        # Kategorik ~ Kategorik
        if dep in (VariableType.BINARY,VariableType.NOMINAL) and ind in (VariableType.BINARY,VariableType.NOMINAL):
            return ("fisher_exact" if n<40 else "chi_square",
                    "İki kategorik değişken; Ki-Kare veya Fisher testi önerilir.",
                    "Two categorical variables; Chi-Square or Fisher test recommended.", w)
        # MANOVA
        if n_dv >= 2 and groups >= 2:
            return ("manova","Birden fazla bağımlı değişken; MANOVA önerilir.","Multiple DVs; MANOVA recommended.",w)
        # 2 grup
        if groups == 2 or (req.independent_variable and groups <= 2):
            if paired or repeated:
                if normal is not False: return ("paired_t","Eşleştirilmiş t-Testi önerilir.","Paired t-test recommended.",w)
                return ("wilcoxon","Wilcoxon testi önerilir.","Wilcoxon test recommended.",w)
            if req.covariates: return ("ancova","Kovaryant var; ANCOVA önerilir.","Covariate present; ANCOVA recommended.",w)
            if normal is False: return ("mann_whitney","Normallik ihlali; Mann-Whitney önerilir.","Normality violated; Mann-Whitney recommended.",w)
            if homo is False: return ("welch_t","Homojenlik ihlali; Welch t önerilir.","Homogeneity violated; Welch t-test recommended.",w)
            return ("independent_t","Bağımsız t-Testi önerilir.","Independent t-test recommended.",w)
        # 3+ grup
        if groups >= 3:
            if repeated:
                if normal is not False: return ("repeated_measures_anova","Tekrarlı ANOVA önerilir.","Repeated ANOVA recommended.",w)
                return ("friedman","Friedman testi önerilir.","Friedman test recommended.",w)
            if req.covariates: return ("ancova","Kovaryant var; ANCOVA önerilir.","Covariate present; ANCOVA recommended.",w)
            if normal is False: return ("kruskal_wallis","Kruskal-Wallis önerilir.","Kruskal-Wallis recommended.",w)
            if homo is False: return ("welch_anova","Welch ANOVA önerilir.","Welch ANOVA recommended.",w)
            return ("one_way_anova","Tek Yönlü ANOVA önerilir.","One-Way ANOVA recommended.",w)
        # Default
        if normal is not False: return ("pearson","Pearson korelasyon önerilir.","Pearson correlation recommended.",w)
        return ("spearman","Spearman korelasyon önerilir.","Spearman correlation recommended.",w)

decision_engine = StatisticalDecisionEngine()
