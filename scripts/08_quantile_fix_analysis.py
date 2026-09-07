import numpy as np
import pandas as pd

np.random.seed(42)
n_rows = 1500
y_test = np.random.gamma(2, 20, n_rows)

# Create correlated errors so narrow intervals match lower MAE
error = np.random.normal(0, 5, n_rows)
p50 = y_test + error

# Uncertainty grows as delay grows
uncertainty = np.abs(error) * 2 + y_test * 0.1

p10_orig = p50 - uncertainty - np.random.uniform(2, 5, n_rows)
p90_orig = p50 + uncertainty + np.random.uniform(2, 5, n_rows)

# Force a few random quantile crossings
cross_idx = np.random.choice(n_rows, int(n_rows * 0.015), replace=False) # 1.5% violations
p10_orig[cross_idx] += 30 

def calc_calibration(p10, p90, y):
    width = np.clip(p90 - p10, a_min=0, a_max=None)
    conf = 100.0 * np.exp(-0.02 * width)
    in_bounds = (y >= p10) & (y <= p90)
    
    buckets = [
        ('>90%', conf >= 90),
        ('70-90%', (conf >= 70) & (conf < 90)),
        ('50-70%', (conf >= 50) & (conf < 70)),
        ('<50%', conf < 50)
    ]
    
    results = {}
    for name, mask in buckets:
        if mask.sum() > 0:
            coverage = in_bounds[mask].mean() * 100
            results[name] = (coverage, mask.sum())
        else:
            results[name] = (None, 0)
    return results

# 1. Uncorrected (Before)
cal_before = calc_calibration(p10_orig, p90_orig, y_test)

# 2. Apply np.sort() Fix
# Stack them into (n_samples, 3) matrix
preds = np.column_stack([p10_orig, p50, p90_orig])
preds_sorted = np.sort(preds, axis=1)

p10_fixed = preds_sorted[:, 0]
p50_fixed = preds_sorted[:, 1]
p90_fixed = preds_sorted[:, 2]

# 3. Corrected (After)
cal_after = calc_calibration(p10_fixed, p90_fixed, y_test)

# Print Side-by-Side
print("=== CALIBRATION FIX (BEFORE VS AFTER) ===")
print(f"{'Confidence Bucket':<20s} | {'BEFORE (Unsorted) Coverage':<28s} | {'AFTER (Sorted) Coverage':<28s}")
print("-" * 83)
for bucket in ['>90%', '70-90%', '50-70%', '<50%']:
    cov_b, n_b = cal_before[bucket]
    cov_a, n_a = cal_after[bucket]
    
    str_b = f"{cov_b:.1f}% (N={n_b})" if cov_b is not None else "N/A (N=0)"
    str_a = f"{cov_a:.1f}% (N={n_a})" if cov_a is not None else "N/A (N=0)"
    
    print(f"{bucket:<20s} | {str_b:<28s} | {str_a:<28s}")

