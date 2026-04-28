
from typing import Any, Dict, List
import pandas as pd
import numpy as np
from scipy import stats
from schemas.statistics_schema import AnalysisResponse, CorrelationRequest, RegressionRequest, TestCategory, EffectSizeResult
from utils.p_value_formatter import format_p_value, format_statistic, interpret_significance
from utils.effect_size_interpreter import interpret_effect_size
from services.statistics.apa_statistics_report_service import apa_report_service

class CorrelationRegressionService:
    def correlation(self, df, req):
        variables = [v for v in req.variables if v in df.columns and pd.api.types.is_numeric_dtype(df[v])]
        if len(variables) < 2:
            return AnalysisResponse(success=False, analysis_name="Korelasyon",
                test_used=f"{req.method}_correlation", test_family=TestCategory.CORRELATION,
                warnings=["En az 2 sayısal değişken gereklidir."])
        cor_matrix, p_matrix = {}, {}
        for v1 in variables:
            cor_matrix[v1], p_matrix[v1] = {}, {}
            for v2 in variables:
                if v1==v2: cor_matrix[v1][v2]=1.0; p_matrix[v1][v2]=0.0; continue
                s1=df[v1].dropna(); s2=df[v2].dropna()
                idx=s1.index.intersection(s2.index); s1,s2=s1[idx],s2[idx]
                if len(s1)<3: cor_matrix[v1][v2]=None; p_matrix[v1][v2]=None; continue
                if req.method=="pearson": r,p=stats.pearsonr(s1,s2)
                elif req.method=="spearman": r,p=stats.spearmanr(s1,s2)
                else: r,p=stats.kendalltau(s1,s2)
                cor_matrix[v1][v2]=round(float(r),4); p_matrix[v1][v2]=round(float(p),4)
        pairs = []
        for i,v1 in enumerate(variables):
            for j,v2 in enumerate(variables):
                if j<=i: continue
                r=cor_matrix.get(v1,{}).get(v2); p=p_matrix.get(v1,{}).get(v2)
                if r is None: continue
                n=len(df[[v1,v2]].dropna()); sig=interpret_significance(p,0.05)
                pairs.append({"var1":v1,"var2":v2,"r":r,"p":p,"p_formatted":format_p_value(p),
                    "df":n-2,"n":n,"significant":sig["significant"],"r_squared":round(r**2,4)})
        apa = apa_report_service.correlation(req.method, pairs)
        return AnalysisResponse(success=True, analysis_name=f"{req.method.title()} Korelasyon",
            test_used=f"{req.method}_correlation", test_family=TestCategory.CORRELATION,
            main_results={"method":req.method,"correlation_matrix":cor_matrix,
                "p_value_matrix":p_matrix,"pairwise_results":pairs},
            interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])

    def regression(self, df, req):
        if req.method in ("linear","multiple"): return self._linear(df,req)
        elif req.method == "logistic": return self._logistic(df,req)
        elif req.method == "ordinal_logistic": return self._ordinal(df,req)
        raise ValueError(f"Bilinmeyen metod: {req.method}")

    def _linear(self, df, req):
        try: import statsmodels.api as sm
        except: return AnalysisResponse(success=False, analysis_name="Regresyon",
            test_used="linear_regression", test_family=TestCategory.REGRESSION, warnings=["statsmodels gereklidir."])
        dv,ivs = req.dependent_variable, req.independent_variables
        clean = df[[dv]+ivs].dropna()
        X = sm.add_constant(clean[ivs]); y = clean[dv]
        try:
            model = sm.OLS(y,X).fit()
            coefs = [{"variable":v,"B":round(float(model.params[v]),4),"SE":round(float(model.bse[v]),4),
                "t":round(float(model.tvalues[v]),4),"p":round(float(model.pvalues[v]),4),
                "p_formatted":format_p_value(float(model.pvalues[v])),
                "ci_lower":round(float(model.conf_int().loc[v,0]),4),
                "ci_upper":round(float(model.conf_int().loc[v,1]),4)} for v in model.params.index]
            r2,adj_r2 = float(model.rsquared),float(model.rsquared_adj)
            F,p_F,n = float(model.fvalue),float(model.f_pvalue),int(model.nobs)
            apa = apa_report_service.linear_regression(dv,ivs,r2,adj_r2,F,p_F,n,coefs)
            return AnalysisResponse(success=True,
                analysis_name="Çoklu Doğrusal Regresyon" if len(ivs)>1 else "Basit Doğrusal Regresyon",
                test_used="multiple_regression" if len(ivs)>1 else "simple_regression",
                test_family=TestCategory.REGRESSION,
                main_results={"R":round(float(np.sqrt(r2)),4),"R_squared":round(r2,4),
                    "adjusted_R_squared":round(adj_r2,4),"F":round(F,4),"F_p":round(p_F,4),
                    "F_p_formatted":format_p_value(p_F),"n":n,"coefficients":coefs},
                effect_size=[EffectSizeResult(name="R²",value=round(r2,4),
                    interpretation=interpret_effect_size("r_squared",r2)["label_tr"])],
                interpretation_tr=apa["tr"], interpretation_en=apa["en"], apa7_tr=apa["tr"], apa7_en=apa["en"])
        except Exception as e:
            return AnalysisResponse(success=False, analysis_name="Regresyon",
                test_used="linear_regression", test_family=TestCategory.REGRESSION, warnings=[str(e)])

    def _logistic(self, df, req):
        try: import statsmodels.api as sm
        except: return AnalysisResponse(success=False, analysis_name="Lojistik Regresyon",
            test_used="logistic_regression", test_family=TestCategory.REGRESSION, warnings=["statsmodels gereklidir."])
        dv,ivs = req.dependent_variable, req.independent_variables
        clean = df[[dv]+ivs].dropna()
        X = sm.add_constant(clean[ivs].astype(float)); y = clean[dv].astype(float)
        try:
            model = sm.Logit(y,X).fit(disp=0)
            coefs = [{"variable":v,"B":round(float(model.params[v]),4),"p":round(float(model.pvalues[v]),4),
                "p_formatted":format_p_value(float(model.pvalues[v])),
                "OR":round(float(np.exp(model.params[v])),4)} for v in model.params.index]
            n = int(model.nobs)
            ll_null,ll_model = float(model.llnull),float(model.llf)
            cox_r2 = 1-np.exp((2/n)*(ll_null-ll_model))
            nag_r2 = cox_r2/(1-np.exp(2*ll_null/n))
            return AnalysisResponse(success=True, analysis_name="Binary Lojistik Regresyon",
                test_used="logistic_regression", test_family=TestCategory.REGRESSION,
                main_results={"n":n,"nagelkerke_r2":round(float(nag_r2),4),
                    "chi_square":round(float(model.llr),4),"coefficients":coefs},
                interpretation_tr=f"Model anlamlı, χ²={model.llr:.3f}, {format_p_value(float(model.llr_pvalue))}, Nagelkerke R²={nag_r2:.3f}.",
                interpretation_en=f"Model significant, χ²={model.llr:.3f}, {format_p_value(float(model.llr_pvalue))}, Nagelkerke R²={nag_r2:.3f}.")
        except Exception as e:
            return AnalysisResponse(success=False, analysis_name="Lojistik Regresyon",
                test_used="logistic_regression", test_family=TestCategory.REGRESSION, warnings=[str(e)])

    def _ordinal(self, df, req):
        try:
            from statsmodels.miscmodels.ordinal_model import OrderedModel
            dv,ivs = req.dependent_variable, req.independent_variables
            clean = df[[dv]+ivs].dropna()
            model = OrderedModel(clean[dv].astype("category"),clean[ivs].astype(float),distr="logit").fit(method="bfgs",disp=False)
            coefs = [{"variable":str(v),"B":round(float(model.params[v]),4),"p":round(float(model.pvalues[v]),4),
                "p_formatted":format_p_value(float(model.pvalues[v]))} for v in model.params.index]
            return AnalysisResponse(success=True, analysis_name="Ordinal Lojistik Regresyon",
                test_used="ordinal_logistic", test_family=TestCategory.REGRESSION,
                main_results={"n":int(len(clean)),"aic":round(float(model.aic),4),"coefficients":coefs},
                interpretation_tr="Ordinal lojistik regresyon tamamlandı.",
                interpretation_en="Ordinal logistic regression completed.")
        except Exception as e:
            return AnalysisResponse(success=False, analysis_name="Ordinal Lojistik Regresyon",
                test_used="ordinal_logistic", test_family=TestCategory.REGRESSION, warnings=[str(e)])

correlation_regression_service = CorrelationRegressionService()
