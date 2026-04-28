
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats
from schemas.statistics_schema import AnalysisResponse, TTestRequest, AnovaRequest, AncovaRequest, TestCategory, EffectSizeResult, PostHocResult
from utils.p_value_formatter import format_p_value, format_statistic, interpret_significance
from utils.effect_size_interpreter import interpret_effect_size, cohen_d, hedges_g
from services.statistics.descriptive_service import descriptive_service
from services.statistics.assumption_service import assumption_service
from services.statistics.apa_statistics_report_service import apa_report_service

def _welch_df(g1,g2):
    v1,v2,n1,n2 = g1.var(ddof=1),g2.var(ddof=1),len(g1),len(g2)
    if n1==0 or n2==0: return 0.0
    num = (v1/n1+v2/n2)**2
    den = (v1/n1)**2/(n1-1)+(v2/n2)**2/(n2-1)
    return num/den if den>0 else 0.0

class ParametricService:
    def t_test(self, df, req):
        if req.test_type in ("independent","welch"): return self._independent_t(df, req, welch=req.test_type=="welch")
        elif req.test_type == "paired": return self._paired_t(df, req)
        elif req.test_type == "one_sample": return self._one_sample_t(df, req)
        raise ValueError(f"Bilinmeyen test: {req.test_type}")

    def _independent_t(self, df, req, welch=False):
        dv,gv,alpha = req.dependent_variable, req.group_variable, req.alpha
        warnings = []
        assumptions = assumption_service.run_all(df, dv, gv, alpha)
        if not gv or gv not in df.columns:
            return AnalysisResponse(success=False, analysis_name="t-Testi", test_used="independent_t",
                test_family=TestCategory.PARAMETRIC, warnings=["Grup değişkeni gereklidir."])
        groups = df.groupby(gv)[dv].apply(lambda x: x.dropna())
        group_names = list(groups.index)
        if len(group_names) != 2:
            return AnalysisResponse(success=False, analysis_name="t-Testi", test_used="independent_t",
                test_family=TestCategory.PARAMETRIC, warnings=[f"2 grup gerekli, {len(group_names)} bulundu."])
        g1,g2 = groups.iloc[0],groups.iloc[1]
        n1,n2 = len(g1),len(g2)
        t_stat,p_val = stats.ttest_ind(g1,g2,equal_var=not welch)
        t_stat,p_val = float(t_stat),float(p_val)
        df_val = n1+n2-2 if not welch else _welch_df(g1,g2)
        d = cohen_d(g1.mean(),g2.mean(),g1.std(),g2.std(),n1,n2)
        g = hedges_g(g1.mean(),g2.mean(),g1.std(),g2.std(),n1,n2)
        d_interp = interpret_effect_size("cohen_d",d)
        sig = interpret_significance(p_val,alpha)
        desc = descriptive_service.compute(df,[dv],group_by=gv)
        apa = apa_report_service.independent_t("t-Testi",group_names[0],group_names[1],
            t_stat,df_val,p_val,d,g1.mean(),g2.mean(),g1.std(),g2.std(),n1,n2)
        return AnalysisResponse(success=True,
            analysis_name="Welch t-Testi" if welch else "Bağımsız Örneklem t-Testi",
            test_used="welch_t" if welch else "independent_t",
            test_family=TestCategory.PARAMETRIC,
            descriptive_statistics=desc.results, assumption_tests=assumptions,
            main_results={"t":round(t_stat,4),"df":round(df_val,2),"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],
                "groups":{str(group_names[0]):{"n":n1,"mean":round(float(g1.mean()),4),"sd":round(float(g1.std()),4)},
                          str(group_names[1]):{"n":n2,"mean":round(float(g2.mean()),4),"sd":round(float(g2.std()),4)}}},
            effect_size=[EffectSizeResult(name="Cohen's d",value=round(d,4),interpretation=d_interp["label_tr"]),
                         EffectSizeResult(name="Hedges' g",value=round(g,4),interpretation=interpret_effect_size("hedges_g",g)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"], warnings=warnings)

    def _paired_t(self, df, req):
        dv,gv,alpha = req.dependent_variable, req.group_variable, req.alpha
        assumptions = assumption_service.run_all(df, dv, gv, alpha)
        groups = df.groupby(gv)[dv].apply(lambda x: x.dropna())
        group_names = list(groups.index)
        if len(group_names) < 2:
            return AnalysisResponse(success=False, analysis_name="Eşleştirilmiş t-Testi",
                test_used="paired_t", test_family=TestCategory.PARAMETRIC, warnings=["2 grup gerekli."])
        g1 = groups.iloc[0].reset_index(drop=True)
        g2 = groups.iloc[1].reset_index(drop=True)
        min_n = min(len(g1),len(g2))
        g1,g2 = g1[:min_n],g2[:min_n]
        t_stat,p_val = stats.ttest_rel(g1,g2)
        t_stat,p_val = float(t_stat),float(p_val)
        df_val = min_n-1
        diffs = g1-g2
        d = float(diffs.mean()/diffs.std(ddof=1)) if diffs.std(ddof=1)>0 else 0.0
        sig = interpret_significance(p_val,alpha)
        apa = apa_report_service.paired_t(str(group_names[0]),str(group_names[1]),t_stat,df_val,p_val,d,min_n)
        return AnalysisResponse(success=True, analysis_name="Eşleştirilmiş Örneklem t-Testi",
            test_used="paired_t", test_family=TestCategory.PARAMETRIC, assumption_tests=assumptions,
            main_results={"t":round(t_stat,4),"df":df_val,"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],"n_pairs":min_n},
            effect_size=[EffectSizeResult(name="Cohen's d",value=round(d,4),
                interpretation=interpret_effect_size("cohen_d",d)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def _one_sample_t(self, df, req):
        dv,alpha = req.dependent_variable, req.alpha
        mu = req.mu or 0.0
        series = df[dv].dropna()
        n = len(series)
        assumptions = assumption_service.run_all(df, dv, None, alpha)
        t_stat,p_val = stats.ttest_1samp(series, popmean=mu)
        t_stat,p_val = float(t_stat),float(p_val)
        df_val = n-1
        d = float((series.mean()-mu)/series.std(ddof=1)) if series.std(ddof=1)>0 else 0.0
        sig = interpret_significance(p_val,alpha)
        apa = apa_report_service.one_sample_t(dv,mu,t_stat,df_val,p_val,d,float(series.mean()),float(series.std()),n)
        return AnalysisResponse(success=True, analysis_name="Tek Örneklem t-Testi",
            test_used="one_sample_t", test_family=TestCategory.PARAMETRIC, assumption_tests=assumptions,
            main_results={"t":round(t_stat,4),"df":df_val,"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],
                "sample_mean":round(float(series.mean()),4),"test_value":mu,"n":n},
            effect_size=[EffectSizeResult(name="Cohen's d",value=round(d,4),
                interpretation=interpret_effect_size("cohen_d",d)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def anova(self, df, req):
        dv,gv,alpha = req.dependent_variable, req.group_variable, req.alpha
        if not gv:
            return AnalysisResponse(success=False, analysis_name="ANOVA", test_used="anova",
                test_family=TestCategory.ANOVA, warnings=["Grup değişkeni gereklidir."])
        assumptions = assumption_service.run_all(df, dv, gv, alpha)
        groups = [g.dropna() for _,g in df.groupby(gv)[dv]]
        f_stat,p_val = stats.f_oneway(*groups)
        f_stat,p_val = float(f_stat),float(p_val)
        grand_mean = df[dv].mean()
        ss_between = sum(len(g)*(g.mean()-grand_mean)**2 for g in groups)
        ss_total = sum((df[dv].dropna()-grand_mean)**2)
        eta_sq = float(ss_between/ss_total) if ss_total>0 else 0.0
        df1,df2 = len(groups)-1, sum(len(g)-1 for g in groups)
        posthoc = self._tukey(df,dv,gv)
        desc = descriptive_service.compute(df,[dv],group_by=gv)
        sig = interpret_significance(p_val,alpha)
        apa = apa_report_service.one_way_anova(dv,gv,f_stat,df1,df2,p_val,eta_sq)
        return AnalysisResponse(success=True, analysis_name="Tek Yönlü ANOVA",
            test_used="one_way_anova", test_family=TestCategory.ANOVA,
            descriptive_statistics=desc.results, assumption_tests=assumptions,
            main_results={"F":round(f_stat,4),"df_between":df1,"df_within":df2,"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],"group_count":len(groups)},
            effect_size=[EffectSizeResult(name="Eta Squared (η²)",value=round(eta_sq,4),
                interpretation=interpret_effect_size("eta_squared",eta_sq)["label_tr"])],
            posthoc_results=posthoc,
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def _tukey(self, df, dv, gv):
        try:
            from statsmodels.stats.multicomp import pairwise_tukeyhsd
            result = pairwise_tukeyhsd(df[dv].dropna(), df[gv].dropna())
            return [PostHocResult(group1=str(r[0]),group2=str(r[1]),mean_diff=round(float(r[2]),4),
                p_value=round(float(r[3]),4),p_adjusted=round(float(r[3]),4),significant=bool(r[5]))
                for r in result.summary().data[1:]]
        except: return []

    def ancova(self, df, req):
        try:
            from statsmodels.formula.api import ols
            from statsmodels.stats.anova import anova_lm
        except:
            return AnalysisResponse(success=False, analysis_name="ANCOVA", test_used="ancova",
                test_family=TestCategory.ANOVA, warnings=["statsmodels gereklidir."])
        dv,gv,covs = req.dependent_variable, req.group_variable, req.covariates
        if not gv:
            return AnalysisResponse(success=False, analysis_name="ANCOVA", test_used="ancova",
                test_family=TestCategory.ANOVA, warnings=["Grup değişkeni gereklidir."])
        cov_str = " + ".join(covs) if covs else "1"
        formula = f"{dv} ~ C({gv}) + {cov_str}"
        try:
            model = ols(formula, data=df.dropna(subset=[dv,gv]+covs)).fit()
            table = anova_lm(model, typ=2)
            row = table.loc[f"C({gv})"]
            f_stat,p_val = float(row["F"]),float(row["PR(>F)"])
            ss_g = float(row["sum_sq"])
            ss_r = float(table.loc["Residual","sum_sq"])
            partial_eta = ss_g/(ss_g+ss_r)
            sig = interpret_significance(p_val, req.alpha)
            apa = apa_report_service.ancova(dv,gv,covs,f_stat,p_val,partial_eta)
            return AnalysisResponse(success=True, analysis_name="ANCOVA", test_used="ancova",
                test_family=TestCategory.ANOVA,
                main_results={"F":round(f_stat,4),"p":round(p_val,4),"p_formatted":format_p_value(p_val),
                    "significant":sig["significant"],"covariates":covs},
                effect_size=[EffectSizeResult(name="Partial Eta Squared (η²p)",value=round(partial_eta,4),
                    interpretation=interpret_effect_size("partial_eta_squared",partial_eta)["label_tr"])],
                interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])
        except Exception as e:
            return AnalysisResponse(success=False, analysis_name="ANCOVA", test_used="ancova",
                test_family=TestCategory.ANOVA, warnings=[f"Hata: {str(e)}"])

parametric_service = ParametricService()
