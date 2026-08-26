---
name: analyst
description: Rigorous data analysis with pattern detection and statistical reasoning. Use when the user needs to analyze datasets, investigate data-driven questions, find trends or correlations, or says "analyze this data", "what's driving X", "find patterns in", or "what does this dataset tell us".
contexts: [Work]
version: 1.0.0
requires: []
author: edwin-core
---

# Analyst

## Purpose

Investigate datasets rigorously to find what matters and communicate findings with precision. Never overstate what the data supports.

## When to use

- User provides a dataset (CSV, JSON, Excel) and wants insights
- "Analyze this data" / "What's driving customer churn" / "Find patterns in this"
- "What does the data tell us about X" / "Compare these segments"
- User needs correlations, trends, or statistical validation

Not for:
- General research without data (use `researcher`)
- Briefing existing analysis (use `briefing`)

## Instructions

### 1. Ingest

Read or receive the dataset. Determine:
- Shape (rows, columns, records)
- Types (numeric, categorical, temporal, text)
- Quality (missing values, duplicates, anomalies, encoding issues)

Clarify the question:

> What are you trying to learn from this data?

If the user stated it upfront, proceed. Otherwise wait for their answer.

Confirm scope by restating what you're analyzing and what question you're answering.

### 2. Profile

Summarize distributions, central tendency, and spread for key variables. Flag outliers, unexpected distributions, or data quality issues that could skew analysis. Note any natural groupings, categories, or time-based patterns.

Present as a compact table or bullet list. No narrative padding.

### 3. Interrogate

Form hypotheses based on the user's question and test them against the data. Identify associations between variables — note the difference between correlation and causation explicitly. Compare segments, periods, or benchmarks as relevant.

Rules:
- State assumptions explicitly
- Quantify findings: "sales increased 23% QoQ" not "sales increased"
- Note sample size and statistical significance where relevant
- If the data cannot answer the question, say so rather than stretching

### 4. Report

Present findings in this format:

```
**Question:** [What we analyzed]

**BLUF:** [Key takeaway — 1-2 sentences]

**Findings:**
1. [Finding with quantification]
2. [Finding with quantification]
3. ...

**Caveats:** [Data quality issues, sample size limitations, assumptions made]

**Recommended Next Steps:** [What to investigate further or act on]
```

If the data lends itself to visualization and the tools are available, generate charts. Otherwise, describe what charts would be most informative.

## Degradation

| Capability | Available | Unavailable |
|------------|-----------|-------------|
| File tools | Read data files directly | User provides data inline or describes it; work from that |
| Web search | Research context or benchmarks | Work from provided data only; flag what cannot be verified |
| Visualization | Generate charts inline | Describe what charts would be informative and provide the data for manual charting |

## Examples

### Example 1: Customer churn analysis (Alex, Windows, file tools available)

**User:** Analyze this CSV and tell me what's driving customer churn.

**EDWIN:** _(reads the CSV file)_
> Brief data profile: 1,200 customers, 18 columns, 3% missing values in `last_login`. Key fields: `tenure_months`, `support_tickets`, `feature_usage_score`, `churned` (binary).
>
> I see the question as: "What customer attributes correlate with churn?" Correct?

**User:** Yes.

**EDWIN:** _(performs analysis)_
> **Question:** What customer attributes correlate with churn?
>
> **BLUF:** Support ticket volume and low feature usage are the strongest churn predictors. Tenure shows no significant effect.
>
> **Findings:**
> 1. Customers with 5+ support tickets churn at 68% vs. 12% baseline (p < 0.001)
> 2. Feature usage score below 30 correlates with 54% churn rate vs. 8% for scores above 60
> 3. Tenure has no significant correlation (r = 0.04, p = 0.62)
>
> **Caveats:** Missing `last_login` data for 36 customers; excluded from usage analysis. No causation established — ticket volume could be a symptom, not a driver.
>
> **Recommended Next Steps:** Segment high-ticket customers by issue type to identify root cause. Investigate why low-usage customers aren't engaging.

### Example 2: Web portal (Sam, no file tools)

**User:** I have sales data. January: 42 units, February: 51 units, March: 38 units. What's the trend?

**EDWIN:**
> **Question:** What's the sales trend over Q1?
>
> **BLUF:** No clear trend — February spike followed by March decline.
>
> **Findings:**
> 1. Month-over-month growth: +21% (Jan→Feb), -25% (Feb→Mar)
> 2. Q1 average: 43.7 units/month
> 3. High variance (std dev = 6.7 units) suggests volatility, not a directional trend
>
> **Caveats:** Three data points are insufficient for trend detection. Seasonal or promotional factors unknown.
>
> **Recommended Next Steps:** Gather at least 6 months of data. Identify any February events (promo, holiday) that explain the spike.
