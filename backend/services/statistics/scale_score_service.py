
from typing import List, Tuple
import pandas as pd
from schemas.statistics_schema import ScaleScoreRequest, ScaleScoreResponse, ScaleScoreResult

class ScaleScoreService:
    def compute_scores(self, df, req):
        results = []
        new_columns = []
        df_out = df.copy()
        for sub in req.subscales:
            items = [i for i in sub.items if i in df.columns]
            if not items: continue
            sub_df = df_out[items].copy()
            if sub.reversed_items and sub.max_score_per_item:
                for ri in sub.reversed_items:
                    if ri in sub_df.columns:
                        sub_df[ri] = sub.max_score_per_item + 1 - sub_df[ri]
            missing_pct = round(sub_df.isnull().values.mean()*100,2)
            if req.compute_total:
                col = f"{sub.name}_total"
                df_out[col] = sub_df.sum(axis=1, skipna=True)
                new_columns.append(col)
            if req.compute_mean:
                col = f"{sub.name}_mean"
                df_out[col] = sub_df.mean(axis=1, skipna=True)
                new_columns.append(col)
            results.append(ScaleScoreResult(
                subscale_name=sub.name,
                total_col=f"{sub.name}_total" if req.compute_total else "",
                mean_col=f"{sub.name}_mean" if req.compute_mean else "",
                item_count=len(items), missing_pct=missing_pct))
        total_cols = [r.total_col for r in results if r.total_col]
        if total_cols:
            df_out["scale_total_score"] = df_out[total_cols].sum(axis=1)
            df_out["scale_mean_score"] = df_out[total_cols].mean(axis=1)
            new_columns += ["scale_total_score","scale_mean_score"]
        return df_out, ScaleScoreResponse(success=True, results=results,
            new_columns=new_columns, message=f"{len(results)} alt boyut hesaplandı.")

scale_score_service = ScaleScoreService()
