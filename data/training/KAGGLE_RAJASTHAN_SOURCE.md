# Kaggle Rajasthan Heatwave Source

- Dataset: [Heatwave Dataset (Rajasthan, India, 2006-2025)](https://www.kaggle.com/datasets/rupsarroy/heatwave-dataset-rajasthan-india-2006-2025)
- File: `Rajasthan_Heatwave_2006_2025.csv`
- Source basis stated by uploader: ERA5 reanalysis
- Coverage: March-June, 2006-2025
- Records: 21,960
- Districts: 9 Rajasthan districts
- Target: `HEATWAVE`, 0 normal day and 1 heatwave event
- License: CC BY-SA 4.0

The target is a heatwave classification label, not an observed mortality or
hospitalization outcome. The trained artifact is therefore a heatwave classifier
and is not a health-impact model.

## Accuracy interpretation

The artifact reports a default logistic-regression threshold, a threshold
selected on the 2019-2021 validation period, and a learned `TMAX` threshold
baseline. The selected logistic threshold is evaluated on the untouched
2022-2025 test period. The `TMAX` threshold baseline reaches 1.0000 because the
uploaded `HEATWAVE` labels are almost perfectly separated by `TMAX` in this
file. This is a reconstruction of the dataset's label rule, not evidence of an
independent predictive signal. Precision, recall, F1, and the confusion matrix
remain the important diagnostics.