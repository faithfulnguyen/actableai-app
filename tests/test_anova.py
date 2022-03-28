import logging
import pandas as pd
from superset.prediction.stats_models import anova_task

logger = logging.getLogger(__name__)


class TestANOVA():
    def test_one_way(self):
        df = pd.DataFrame(
            [
                {"A": 25, "B": 45, "C": 30, "D": 54},
                {"A": 30, "B": 55, "C": 29, "D": 60},
                {"A": 28, "B": 29, "C": 33, "D": 51},
                {"A": 36, "B": 56, "C": 37, "D": 62},
                {"A": 29, "B": 40, "C": 27, "D": 73},
            ]
        )
        pd_table = pd.melt(
            df.reset_index(), id_vars=["index"], value_vars=["A", "B", "C", "D"]
        )
        # replace column names
        pd_table.columns = ["index", "treatments", "value"]
        treatments = ["treatments"]
        outcome = "value"
        results = anova_task(pd_table, treatments, outcome)
        assert all(
            [
                k in results
                for k in [
                    "anova_summary",
                    "tukey_summary",
                    "anova_std_residuals",
                    "anova_model_out_resid",
                    "shapiro_wilk_summary",
                    "bartlett_summary",
                    "levene_summary",
                ]
            ]
        )

    def test_two_way(self):
        df = pd.DataFrame(
            [
                {"Genotype": "A", "1_year": 1.53, "2_year": 4.08, "3_year": 6.69},
                {"Genotype": "A", "1_year": 1.83, "2_year": 3.84, "3_year": 5.97},
                {"Genotype": "A", "1_year": 1.38, "2_year": 3.96, "3_year": 6.33},
                {"Genotype": "B", "1_year": 3.6, "2_year": 5.7, "3_year": 8.55},
                {"Genotype": "B", "1_year": 2.94, "2_year": 5.07, "3_year": 7.95},
                {"Genotype": "B", "1_year": 4.02, "2_year": 7.2, "3_year": 8.94},
                {"Genotype": "C", "1_year": 3.99, "2_year": 6.09, "3_year": 10.02},
                {"Genotype": "C", "1_year": 3.3, "2_year": 5.88, "3_year": 9.63},
                {"Genotype": "C", "1_year": 4.41, "2_year": 6.51, "3_year": 10.38},
                {"Genotype": "D", "1_year": 3.75, "2_year": 5.19, "3_year": 11.4},
                {"Genotype": "D", "1_year": 3.63, "2_year": 5.37, "3_year": 9.66},
                {"Genotype": "D", "1_year": 3.57, "2_year": 5.55, "3_year": 10.53},
                {"Genotype": "E", "1_year": 1.71, "2_year": 3.6, "3_year": 6.87},
                {"Genotype": "E", "1_year": 2.01, "2_year": 5.1, "3_year": 6.93},
                {"Genotype": "E", "1_year": 2.04, "2_year": 6.99, "3_year": 6.84},
                {"Genotype": "F", "1_year": 3.96, "2_year": 5.25, "3_year": 9.84},
                {"Genotype": "F", "1_year": 4.77, "2_year": 5.28, "3_year": 9.87},
                {"Genotype": "F", "1_year": 4.65, "2_year": 5.07, "3_year": 10.08},
            ]
        )
        pd_table = pd.melt(df, id_vars=['Genotype'], value_vars=['1_year', '2_year', '3_year'])
        # replace column names
        pd_table.columns = ['Genotype', 'years', 'value']
        treatments = ["Genotype", "years"]
        outcome = "value"
        results = anova_task(pd_table, treatments, outcome)
        assert all(
            [
                k in results
                for k in [
                    "anova_summary",
                    "tukey_summary",
                    "anova_std_residuals",
                    "anova_model_out_resid",
                    "shapiro_wilk_summary",
                    "bartlett_summary",
                    "levene_summary",
                ]
            ]
        )