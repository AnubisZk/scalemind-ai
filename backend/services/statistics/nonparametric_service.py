
from typing import List
import pandas as pd
import numpy as np
from scipy import stats
from schemas.statistics_schema import AnalysisResponse, NonParametricRequest, TestCategory, EffectSizeResult, PostHocResult
from utils.p_value_formatter import format_p_value, interpret_significance
from utils.effect_size_interpreter import interpret_effect_size, rank_biserial_correlation
from services.statistics.descriptive_service import descriptive_service
from services.statistics.apa_statistics_report_service import apa_report_service

class NonParametricService:
    def run(self, df, req):
        if req.test_type == "mann_whitney": return self._mann_whitney(df, req)
        elif req.test_type == "wilcoxon": return self._wilcoxon(df, req)
        elif req.test_type == "kruskal_wallis": return self._kruskal_wallis(df, req)
        elif req.test_type == "friedman": return self._friedman(df, req)
        raise ValueError(f"Bilinmeyen test: {req.test_type}")

    def _mann_whitney(self, df, req):
        dv,gv = req.dependent_variable, req.group_variable
        if not gv or gv not in df.columns:
            return AnalysisResponse(success=False, analysis_name="Mann-Whitney U",
                test_used="mann_whitney", test_family=TestCategory.NONPARAMETRIC, warnings=["Grup değişkeni gereklidir."])
        groups = df.groupby(gv)[dv].apply(lambda x: x.dropna())
        gnames = list(groups.index)
        if len(gnames) != 2:
            return AnalysisResponse(success=False, analysis_name="Mann-Whitney U",
                test_used="mann_whitney", test_family=TestCategory.NONPARAMETRIC, warnings=["2 grup gerekli."])
        g1,g2 = groups.iloc[0],groups.iloc[1]
        n1,n2 = len(g1),len(g2)
        U,p_val = stats.mannwhitneyu(g1,g2,alternative="two-sided")
        U,p_val = float(U),float(p_val)
        mu_U = n1*n2/2
        sigma_U = np.sqrt(n1*n2*(n1+n2+1)/12)
        z = float((U-mu_U)/sigma_U) if sigma_U>0 else 0.0
        r = rank_biserial_correlation(U,n1,n2)
        sig = interpret_significance(p_val,req.alpha)
        desc = descriptive_service.compute(df,[dv],group_by=gv)
        apa = apa_report_service.mann_whitney(str(gnames[0]),str(gnames[1]),U,z,p_val,r,n1,n2)
        return AnalysisResponse(success=True, analysis_name="Mann-Whitney U Testi",
            test_used="mann_whitney", test_family=TestCategory.NONPARAMETRIC,
            descriptive_statistics=desc.results,
            main_results={"U":round(U,4),"z":round(z,4),"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],"n1":n1,"n2":n2},
            effect_size=[EffectSizeResult(name="Rank-Biserial r",value=round(r,4),
                interpretation=interpret_effect_size("rank_biserial",r)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def _wilcoxon(self, df, req):
        dv,gv = req.dependent_variable, req.group_variable
        if not gv or gv not in df.columns:
            return AnalysisResponse(success=False, analysis_name="Wilcoxon",
                test_used="wilcoxon", test_family=TestCategory.NONPARAMETRIC, warnings=["Grup değişkeni gereklidir."])
        groups = df.groupby(gv)[dv].apply(lambda x: x.dropna())
        gnames = list(groups.index)
        g1 = groups.iloc[0].reset_index(drop=True)
        g2 = groups.iloc[1].reset_index(drop=True)
        min_n = min(len(g1),len(g2))
        g1,g2 = g1[:min_n],g2[:min_n]
        W,p_val = stats.wilcoxon(g1,g2)
        W,p_val = float(W),float(p_val)
        z = stats.norm.ppf(p_val/2)
        r = abs(z)/np.sqrt(min_n)
        sig = interpret_significance(p_val,req.alpha)
        apa = apa_report_service.wilcoxon(str(gnames[0]),str(gnames[1]),W,p_val,r,min_n)
        return AnalysisResponse(success=True, analysis_name="Wilcoxon İşaretli Sıra Testi",
            test_used="wilcoxon", test_family=TestCategory.NONPARAMETRIC,
            main_results={"W":round(W,4),"p":round(p_val,4),"p_formatted":format_p_value(p_val),
                "significant":sig["significant"],"n_pairs":min_n},
            effect_size=[EffectSizeResult(name="r",value=round(r,4),
                interpretation=interpret_effect_size("rank_biserial",r)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def _kruskal_wallis(self, df, req):
        dv,gv = req.dependent_variable, req.group_variable
        if not gv:
            return AnalysisResponse(success=False, analysis_name="Kruskal-Wallis",
                test_used="kruskal_wallis", test_family=TestCategory.NONPARAMETRIC, warnings=["Grup değişkeni gereklidir."])
        groups_dict = {str(k):g.dropna() for k,g in df.groupby(gv)[dv]}
        groups = list(groups_dict.values())
        H,p_val = stats.kruskal(*groups)
        H,p_val = float(H),float(p_val)
        df_val = len(groups)-1
        N = sum(len(g) for g in groups)
        eta_sq = float(H/(N-1)) if N>1 else 0.0
        sig = interpret_significance(p_val,req.alpha)
        posthoc = self._dunn(df,dv,gv)
        desc = descriptive_service.compute(df,[dv],group_by=gv)
        apa = apa_report_service.kruskal_wallis(dv,gv,H,df_val,p_val,eta_sq)
        return AnalysisResponse(success=True, analysis_name="Kruskal-Wallis H Testi",
            test_used="kruskal_wallis", test_family=TestCategory.NONPARAMETRIC,
            descriptive_statistics=desc.results,
            main_results={"H":round(H,4),"df":df_val,"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],"N":N},
            effect_size=[EffectSizeResult(name="Eta Squared (η²)",value=round(eta_sq,4),
                interpretation=interpret_effect_size("eta_squared",eta_sq)["label_tr"])],
            posthoc_results=posthoc,
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def _dunn(self, df, dv, gv):
        try:
            import scikit_posthocs as sp
            result = sp.posthoc_dunn(df[[dv,gv]].dropna(),val_col=dv,group_col=gv,p_adjust="bonferroni")
            posthoc = []
            gs = result.columns.tolist()
            for i,g1 in enumerate(gs):
                for j,g2 in enumerate(gs):
                    if j>i:
                        p = float(result.loc[g1,g2])
                        posthoc.append(PostHocResult(group1=str(g1),group2=str(g2),
                            p_value=round(p,4),p_adjusted=round(p,4),significant=p<0.05))
            return posthoc
        except: return []

    def _friedman(self, df, req):
        dv,gv = req.dependent_variable, req.group_variable
        if not gv or gv not in df.columns:
            return AnalysisResponse(success=False, analysis_name="Friedman",
                test_used="friedman", test_family=TestCategory.NONPARAMETRIC, warnings=["Grup değişkeni gereklidir."])
        pivot = df.pivot(columns=gv,values=dv).dropna()
        chi2,p_val = stats.friedmanchisquare(*[pivot[col] for col in pivot.columns])
        chi2,p_val = float(chi2),float(p_val)
        k,n = pivot.shape[1],pivot.shape[0]
        W = chi2/(n*(k-1))
        sig = interpret_significance(p_val,req.alpha)
        apa = apa_report_service.friedman(dv,gv,chi2,k-1,p_val,W,n,k)
        return AnalysisResponse(success=True, analysis_name="Friedman Testi",
            test_used="friedman", test_family=TestCategory.NONPARAMETRIC,
            main_results={"chi2":round(chi2,4),"df":k-1,"p":round(p_val,4),
                "p_formatted":format_p_value(p_val),"significant":sig["significant"],"n":n,"k":k},
            effect_size=[EffectSizeResult(name="Kendall's W",value=round(W,4),
                interpretation=interpret_effect_size("r",W)["label_tr"])],
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

nonparametric_service = NonParametricService()
