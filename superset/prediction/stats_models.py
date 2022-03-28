import pandas as pd
from bioinfokit.analys import stat
from scipy.stats import shapiro
from scipy import stats
from statsmodels.graphics.gofplots import ProbPlot

class IncorrectNumberOfTreatments(ValueError):
    pass

def anova_task(df: pd.DataFrame, treatments: list, outcome: str):

    """
    ANOVA TASK
    """

    # detect whether it's a one-way or two-way ANOVA
    one_way_p = True
    if len(treatments) == 2:
        one_way_p = False
    elif len(treatments) != 1:
        raise IncorrectNumberOfTreatments()

    results = {}
    res = stat()
    if one_way_p:
        anova_model = f"{outcome} ~ C({treatments[0]})"
    else:
        anova_model = f"{outcome} ~ C({treatments[0]}) + C({treatments[1]}) + C({treatments[0]}):C({treatments[1]})"
    # data for ANOVA table
    res.anova_stat(df=df, res_var=outcome, anova_model=anova_model)
    results["table"] = df.to_dict()
    results["anova_summary"] = res.anova_summary.reset_index().to_dict("records")
    # data for multiple comparison
    results["tukey_summary"] = {}
    if one_way_p:
        res.tukey_hsd(
            df=df,
            res_var=outcome,
            xfac_var=treatments[0],
            anova_model=anova_model,
        )
        results["tukey_summary"][treatments[0]] = res.tukey_summary.reset_index().to_dict("records")
    else:
        for treatment in treatments:
            res.tukey_hsd(
                df=df,
                res_var=outcome,
                xfac_var=treatment,
                anova_model=anova_model,
            )
            results["tukey_summary"][treatment] = res.tukey_summary.reset_index().to_dict("records")
        
        # add interaction but only if data is complete
        t1 = df[treatments[0]].unique()
        t2 = df[treatments[1]].unique()
        treatment_value_df = pd.MultiIndex.from_product([t1, t2]).to_frame(index=False)
        treatment_value_df.columns = treatments
        df = df.merge(treatment_value_df, on=treatments, how="right")
        if len(df[df[outcome].isnull()])==0:
            res.tukey_hsd(
                df=df,
                res_var=outcome,
                xfac_var=treatments,
                anova_model=anova_model,
            )
            results["tukey_summary"][treatments[0]+"_"+treatments[1]] = res.tukey_summary.reset_index().to_dict("records")

    # data for QQ-plot
    results["anova_std_residuals"] = res.anova_std_residuals.values
    probplot = ProbPlot(
        data=results["anova_std_residuals"], 
        dist=stats.norm, 
        distargs=(), 
        fit=False, 
        a=0, 
        loc=0, 
        scale=1
    )
    results["anova_theoretical_quantiles"] = probplot.theoretical_quantiles
    results["anova_sample_quantiles"] = probplot.sample_quantiles
    # data for histogram plot
    results["anova_model_out_resid"] = res.anova_model_out.resid.values
    # data for Shapiro-Wilk test
    w, pvalue = shapiro(res.anova_model_out.resid)
    results["shapiro_wilk_summary"] = {"test_statistics": w, "p_value": pvalue}

    # data for Bartlett's test
    if one_way_p:
        res.bartlett(df=df, res_var=outcome, xfac_var=treatments[0])
        results["bartlett_summary"] = res.bartlett_summary.to_dict("records")
    else:
        res.bartlett(df=df, res_var=outcome, xfac_var=treatments)
        results["bartlett_summary"] = res.bartlett_summary.to_dict("records")
    # data for Levene's test
    if one_way_p:
        res.levene(df=df, res_var=outcome, xfac_var=treatments[0])
        results["levene_summary"] = res.levene_summary.to_dict("records")
    else:
        res.levene(df=df, res_var=outcome, xfac_var=treatments)
        results["levene_summary"] = res.levene_summary.to_dict("records")
    return results