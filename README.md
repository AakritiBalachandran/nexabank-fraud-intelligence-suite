# 🏦 NexaBank Fraud Intelligence Suite — SQL Analytics Engine & Excel BI Dashboard for BFSI Fraud Detection

**End-to-end fraud intelligence system that turns 1M+ transaction records into board-ready insight — a PostgreSQL analytics engine answering 10 board-level fraud questions, paired with a live Excel dashboard (Power Query-driven) covering fraud economics, ring contagion modeling, synthetic identity detection, money mule / AML SAR candidate identification, and cross-pattern fraud evolution.**

`SQL` · `PostgreSQL` · `Excel` · `Power Query` · `Excel Dashboard` · `Business Intelligence` · `Fraud Detection` · `Fraud Analytics` · `Banking & Financial Services (BFSI)` · `Risk Analytics` · `Anomaly Detection` · `AML / KYC Compliance` · `Data Analytics Portfolio` · `Window Functions` · `CTEs` · `Behavioral Scoring` · `Data Visualization`

---

## 📌 Overview

NexaBank Fraud Intelligence Suite is a portfolio-grade fraud analytics project built to answer the exact questions a bank's **fraud risk committee, CFO, and AML compliance team** would ask of a transaction monitoring dataset — and to present those answers the way a real bank would: through a live BI dashboard, not just raw query output.

The project has two equally central deliverables:

1. **A PostgreSQL analytics engine** (`Fraud_Analytics.sql`) — 5 relational tables simulating a realistic retail-banking fraud environment (1,000,000+ transactions), with 10 advanced analytical queries answering board-level business questions using pure SQL — no ML libraries, no external tooling.
2. **An Excel Fraud Intelligence Dashboard** (`FRAUD_ANALYTICS.xlsx`, 21 sheets) — every query's output rebuilt into a live, interactive BI layer using Power Query for aggregation, giving the SQL findings a presentation-ready front end a business stakeholder can actually navigate.

**Why this project exists:** most "fraud analytics" portfolio projects stop at a fraud-rate GROUP BY, or stop at SQL with no reporting layer at all. This one closes that gap end to end — from schema design, through analytical SQL modeling resource misallocation, contagion speed, regulatory reporting thresholds, pricing cross-subsidy, and pattern-to-pattern technique transfer, through to a polished Excel dashboard a non-technical stakeholder could open and use.

---

## 🗂️ Repository Structure

```
nexabank-fraud-intelligence-suite/
│
├── Fraud_Analytics.sql          # Full SQL suite: schema (5 tables) + 10 business-question queries
├── FRAUD_ANALYTICS.xlsx         # 21-sheet workbook — query outputs + Fraud Intelligence Dashboard
└── README.md                    # You are here
```

---

## 🧱 Data Model

Five relational tables simulating a real banking fraud environment:

| Table | Purpose |
|---|---|
| `account_profiles` | Customer-level profile — risk score, account type, credit limit, historical fraud rate, `is_fraudster` flag |
| `fraud_patterns` | Reference table describing each fraud typology's fingerprint (velocity, night activity, foreign %, 2FA bypass %) |
| `network_edges` | Account-to-account connection graph used for fraud ring / contagion analysis |
| `time_series_stats` | Hourly aggregated transaction & fraud statistics |
| `transactions` | Core fact table — 1M+ rows, one row per transaction, with fraud label and behavioral signals |

---

## 🎯 The 10 Business Questions

Each query is written to directly answer a question a bank's fraud/risk leadership would ask — not just to demonstrate a SQL feature. Click any question below to expand the full query and its business interpretation.

| # | Business Question | Key SQL Techniques |
|---|---|---|
| **Q1** | Which fraud types are bleeding us silently while we over-police low-loss patterns? | Window aggregates, share-of-total calculations |
| **Q2** | Year-over-year, are fraud attacks becoming faster, larger, and better at mimicking real customers? | YoY % change, unpivot/pivot logic, behavioral disguise scoring |
| **Q3** | Can we detect synthetic identities from behavioral impossibilities alone — zero ML? | Peer-cohort z-scoring, custom weighted risk scoring |
| **Q4** | Which accounts show classic **money mule** signatures and qualify as **SAR candidates**? | Threshold-based structuring detection, AML pattern logic |
| **Q5** | After a fraud ring's first account is caught, how fast does it spread to connected accounts? | Contagion speed modeling, network traversal |
| **Q6** | What fraud tax are customer segments silently bearing — are premium customers cross-subsidizing high-risk segments? | Segment-level cost allocation, cross-subsidy analysis |
| **Q7** | What exact combination of time, device, geography, and auth strength creates the #1 fraud attack window? | Multi-dimensional cohort analysis, fraud success rate ranking |
| **Q8** | How much of today's fraud loss was caused by yesterday's delayed response to a ring's seed account? | Response-window cost modeling, dollar-impact quantification |
| **Q9** | Which accounts were drifting toward fraud *before* their first confirmed fraudulent transaction? | Pre/post split analysis, early-warning signal detection |
| **Q10** | Which fraud pattern is quietly teaching every other pattern how to evolve? | Cross-pattern z-scored fingerprint matching, cohort medians, time-lagged similarity |

📊 Every query's output is visualized in the companion Excel dashboard (`FRAUD_ANALYTICS.xlsx`) on the matching `SQL-(Q.n)` sheet.

---

## 💻 Full Query Details

<details>
<summary><strong>Q1 — Which fraud types are bleeding us silently while our team wastes resources over-policing low-loss patterns?</strong></summary>

```sql
WITH fraud_economics AS (
    SELECT
        t.fraud_pattern,
        COUNT(*)                                                    AS total_fraud_txns,
        ROUND(SUM(t.amount), 2)                                     AS total_loss,
        ROUND(AVG(t.amount), 2)                                     AS avg_loss_per_attack,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)         AS share_of_fraud_volume,
        ROUND(SUM(t.amount) * 100.0 / SUM(SUM(t.amount)) OVER (), 2) AS share_of_fraud_loss,
        fp.avg_velocity_1h                                          AS attack_speed,
        fp.pct_card_not_present,
        fp.pct_foreign
    FROM transactions t
    JOIN fraud_patterns fp ON t.fraud_pattern = fp.fraud_pattern
    WHERE t.is_fraud = TRUE
    GROUP BY t.fraud_pattern, fp.avg_velocity_1h,
             fp.pct_card_not_present, fp.pct_foreign
),
classified AS (
    SELECT *,
        ROUND(share_of_fraud_loss - share_of_fraud_volume, 2) AS resource_efficiency_gap,
        CASE
            WHEN share_of_fraud_loss - share_of_fraud_volume > 5
                THEN '🔴 UNDER-POLICED — Bleeding silently'
            WHEN share_of_fraud_loss - share_of_fraud_volume < -5
                THEN '🟡 OVER-POLICED — Wasting resources'
            ELSE '🟢 Balanced'
        END AS control_efficiency_verdict
    FROM fraud_economics
)
SELECT * FROM classified
ORDER BY resource_efficiency_gap DESC;
```

**Business insight:** If the resource_efficiency_gap is highly positive, your fraud team is under-resourced against the most damaging attack types. A negative gap means budget is being wasted on low-loss patterns — this drives strategic reallocation of fraud controls.

</details>

<details>
<summary><strong>Q2 — Year-over-year, are fraud attacks becoming faster, larger in value, and better at disguising themselves as normal customer behaviour?</strong></summary>

```sql
WITH yearly_evolution AS (
    SELECT
        EXTRACT(YEAR FROM timestamp)::INT                                            AS year,
        fraud_pattern,
        COUNT(*)                                                                     AS attacks,
        ROUND(AVG(amount), 2)                                                        AS avg_attack_size,
        ROUND(AVG(velocity_1h), 2)                                                   AS avg_velocity,
        ROUND(AVG(ip_risk_score), 2)                                                 AS avg_ip_risk,
        ROUND(AVG(amount_vs_avg_ratio), 3)                                           AS behavioural_disguise_score,
        ROUND(SUM(CASE WHEN has_2fa = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct_bypassing_2fa,
        ROUND(SUM(CASE WHEN device_known = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct_using_known_device
    FROM transactions
    WHERE is_fraud = TRUE
    GROUP BY 1, 2
),
 
-- Unpivot: one row per fraud_pattern / year / metric
unpivoted AS (
    SELECT fraud_pattern, year, 'attacks'                     AS metric, attacks::NUMERIC AS value FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'avg_attack_size',             avg_attack_size            FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'avg_velocity',                avg_velocity               FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'avg_ip_risk',                 avg_ip_risk                FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'behavioural_disguise_score',  behavioural_disguise_score FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'pct_bypassing_2fa',           pct_bypassing_2fa          FROM yearly_evolution
    UNION ALL
    SELECT fraud_pattern, year, 'pct_using_known_device',      pct_using_known_device     FROM yearly_evolution
),
 
-- Year-over-year % change per fraud_pattern/metric
yoy_change AS (
    SELECT
        fraud_pattern,
        metric,
        year,
        value,
        LAG(value) OVER (PARTITION BY fraud_pattern, metric ORDER BY year) AS prev_value,
        CASE
            WHEN LAG(value) OVER (PARTITION BY fraud_pattern, metric ORDER BY year) IS NULL
              OR LAG(value) OVER (PARTITION BY fraud_pattern, metric ORDER BY year) = 0
            THEN NULL
            ELSE ROUND(
                (value - LAG(value) OVER (PARTITION BY fraud_pattern, metric ORDER BY year))
                / LAG(value) OVER (PARTITION BY fraud_pattern, metric ORDER BY year) * 100.0
            , 1)
        END AS pct_change
    FROM unpivoted
),
 
-- Average that % change across all year-over-year transitions
avg_change AS (
    SELECT fraud_pattern, metric, ROUND(AVG(pct_change), 1) AS avg_pct_change
    FROM yoy_change
    GROUP BY 1, 2
)
 
-- Final pivot: metric rows, year columns, avg % change column
SELECT
    u.fraud_pattern,
    u.metric,
    MAX(CASE WHEN u.year = 2022 THEN u.value END) AS y_2022,
    MAX(CASE WHEN u.year = 2023 THEN u.value END) AS y_2023,
    MAX(CASE WHEN u.year = 2024 THEN u.value END) AS y_2024,
    ac.avg_pct_change,
    CASE
        WHEN ac.avg_pct_change IS NULL THEN 'Not enough data'
        WHEN ac.avg_pct_change > 0     THEN 'Increasing YoY'
        WHEN ac.avg_pct_change < 0     THEN 'Decreasing YoY'
        ELSE 'No change YoY'
    END AS avg_change_trend,
 
    -- Plain-language read on what the direction means for THIS specific metric
    CASE
        WHEN ac.avg_pct_change IS NULL THEN 'Not enough data to assess trend'
 
        WHEN u.metric = 'avg_velocity' AND ac.avg_pct_change > 0
            THEN '⚡ Attacks executing faster (more transactions packed into each 1h window)'
        WHEN u.metric = 'avg_velocity' AND ac.avg_pct_change < 0
            THEN 'Attack speed slowing down'
 
        WHEN u.metric = 'attacks' AND ac.avg_pct_change > 0
            THEN '📈 Attack volume growing'
        WHEN u.metric = 'attacks' AND ac.avg_pct_change < 0
            THEN 'Attack volume shrinking'
 
        WHEN u.metric = 'avg_attack_size' AND ac.avg_pct_change > 0
            THEN '💰 Attacks growing larger in value'
        WHEN u.metric = 'avg_attack_size' AND ac.avg_pct_change < 0
            THEN 'Attacks shrinking in value'
 
        WHEN u.metric = 'behavioural_disguise_score' AND ac.avg_pct_change > 0
            THEN '🎭 Drifting further from customer''s normal spend (worth checking which direction — 1.0 is the true camouflage point)'
        WHEN u.metric = 'behavioural_disguise_score' AND ac.avg_pct_change < 0
            THEN '🎭 Moving toward customer''s normal spend (check if approaching 1.0 = better disguise)'
 
        WHEN u.metric = 'avg_ip_risk' AND ac.avg_pct_change > 0
            THEN 'Fraud IPs looking more suspicious (easier to catch)'
        WHEN u.metric = 'avg_ip_risk' AND ac.avg_pct_change < 0
            THEN '🕵️ Fraud IPs blending in with normal traffic (harder to catch)'
 
        WHEN u.metric = 'pct_bypassing_2fa' AND ac.avg_pct_change > 0
            THEN '🔓 More fraud getting past 2FA — auth control being compromised'
        WHEN u.metric = 'pct_bypassing_2fa' AND ac.avg_pct_change < 0
            THEN '2FA increasingly stopping fraud'
 
        WHEN u.metric = 'pct_using_known_device' AND ac.avg_pct_change > 0
            THEN '📱 More fraud from recognized/trusted devices — device hijacking escalating'
        WHEN u.metric = 'pct_using_known_device' AND ac.avg_pct_change < 0
            THEN 'Less fraud from recognized devices'
 
        ELSE 'No change'
    END AS business_interpretation
FROM unpivoted u
JOIN avg_change ac
  ON ac.fraud_pattern = u.fraud_pattern
 AND ac.metric        = u.metric
GROUP BY u.fraud_pattern, u.metric, ac.avg_pct_change
ORDER BY
    u.fraud_pattern,
    CASE u.metric
        WHEN 'attacks'                     THEN 1
        WHEN 'avg_attack_size'             THEN 2
        WHEN 'avg_velocity'                THEN 3
        WHEN 'avg_ip_risk'                 THEN 4
        WHEN 'behavioural_disguise_score'  THEN 5
        WHEN 'pct_bypassing_2fa'           THEN 6
        WHEN 'pct_using_known_device'      THEN 7
    END;
```

**Business insight:** A rising behavioural_disguise_score trending toward 1.0 means fraudsters are learning to perfectly mimic real customers. If pct_bypassing_2fa rises year-on-year, authentication controls are being systematically compromised. This is the single most important slide for a board-level fraud review.

</details>

<details>
<summary><strong>Q3 — Can we identify accounts built from fabricated or stolen identity fragments by scoring behavioural impossibilities no legitimate customer would exhibit?</strong></summary>

```sql
WITH base AS (
    SELECT
        ap.account_id,
        ap.account_type,
        ap.home_country,
        ap.account_age_days,
        ap.is_fraudster,
        ap.unique_countries,
        ap.unique_categories,
        ap.avg_ip_risk,
        ap.pct_foreign                                              AS foreign_txn_pct,
        ap.avg_velocity,
        ROUND(ap.unique_countries / NULLIF(ap.account_age_days, 0) * 365, 2)  AS countries_per_year,
        ROUND(ap.unique_categories / NULLIF(ap.avg_monthly_txns, 0), 2)       AS category_diversity_ratio,
        ROUND(ap.avg_txn_amount / NULLIF(ap.credit_limit, 0) * 100, 2)        AS avg_credit_utilization_pct
    FROM account_profiles ap
),
 
-- Accounts under 30 days don't have enough history for the annualized
-- ratios to mean anything — score them separately rather than forcing
-- a number.
mature AS (
    SELECT * FROM base WHERE account_age_days >= 30
),
immature AS (
    SELECT * FROM base WHERE account_age_days < 30
),
 
-- Peer-group baseline: mean/stddev per account_type, computed only from
-- mature accounts so young accounts don't skew the cohort stats.
cohort_stats AS (
    SELECT
        account_type,
        AVG(countries_per_year)          AS mean_countries, NULLIF(STDDEV(countries_per_year), 0)          AS sd_countries,
        AVG(category_diversity_ratio)    AS mean_category,  NULLIF(STDDEV(category_diversity_ratio), 0)    AS sd_category,
        AVG(foreign_txn_pct)             AS mean_foreign,   NULLIF(STDDEV(foreign_txn_pct), 0)              AS sd_foreign,
        AVG(avg_ip_risk)                 AS mean_ip,        NULLIF(STDDEV(avg_ip_risk), 0)                  AS sd_ip,
        AVG(avg_velocity)                AS mean_velocity,  NULLIF(STDDEV(avg_velocity), 0)                 AS sd_velocity,
        AVG(avg_credit_utilization_pct)  AS mean_credit,    NULLIF(STDDEV(avg_credit_utilization_pct), 0)   AS sd_credit
    FROM mature
    GROUP BY account_type
),
 
zscored AS (
    SELECT
        m.*,
        (m.countries_per_year - c.mean_countries) / c.sd_countries                     AS z_countries,
        (m.category_diversity_ratio - c.mean_category) / c.sd_category                 AS z_category,
        (m.foreign_txn_pct - c.mean_foreign) / c.sd_foreign                            AS z_foreign,
        (m.avg_ip_risk - c.mean_ip) / c.sd_ip                                          AS z_ip,
        (m.avg_velocity - c.mean_velocity) / c.sd_velocity                             AS z_velocity,
        (m.avg_credit_utilization_pct - c.mean_credit) / c.sd_credit                   AS z_credit
    FROM mature m
    JOIN cohort_stats c ON c.account_type = m.account_type
),
 
-- Clip each z-score to [0, 3] (0 = not unusual, 3 = 3+ std devs above
-- cohort norm, treated as maxed-out suspicious) then scale to points.
-- Weights: geography, category, foreign-txn, IP risk = 20 pts each;
-- velocity, credit utilization = 10 pts each. Adjust weights as your
-- KYC team validates which signals actually predict is_fraudster.
scored AS (
    SELECT
        *,
        ROUND(
              LEAST(GREATEST(z_countries, 0), 3) / 3.0 * 20
            + LEAST(GREATEST(z_category, 0), 3)  / 3.0 * 20
            + LEAST(GREATEST(z_foreign, 0), 3)   / 3.0 * 20
            + LEAST(GREATEST(z_ip, 0), 3)        / 3.0 * 20
            + LEAST(GREATEST(z_velocity, 0), 3)  / 3.0 * 10
            + LEAST(GREATEST(z_credit, 0), 3)    / 3.0 * 10
        , 1) AS synthetic_id_suspicion_score
    FROM zscored
)
 
SELECT
    account_id, account_type, home_country, account_age_days,
    countries_per_year, category_diversity_ratio, foreign_txn_pct,
    avg_ip_risk, avg_velocity, avg_credit_utilization_pct,
    synthetic_id_suspicion_score,
    CASE
        WHEN synthetic_id_suspicion_score >= 75 THEN '🔴 Likely Synthetic Identity'
        WHEN synthetic_id_suspicion_score >= 50 THEN '🟠 Suspicious — Review Required'
        WHEN synthetic_id_suspicion_score >= 25 THEN '🟡 Elevated — Monitor'
        ELSE '🟢 Likely Legitimate'
    END AS synthetic_id_verdict,
    is_fraudster
FROM scored
 
UNION ALL
 
-- Young accounts: flagged separately, not scored on unreliable ratios
SELECT
    account_id, account_type, home_country, account_age_days,
    countries_per_year, category_diversity_ratio, foreign_txn_pct,
    avg_ip_risk, avg_velocity, avg_credit_utilization_pct,
    NULL AS synthetic_id_suspicion_score,
    '⚪ Insufficient history (<30 days) — monitor only' AS synthetic_id_verdict,
    is_fraudster
FROM immature
ORDER BY synthetic_id_suspicion_score DESC NULLS LAST;
```

**Business insight:** Real customers are creatures of habit — they shop in the same categories, transact in the same geography, and use the same devices. Synthetic identities exhibit impossible diversity for their account age. This builds a Synthetic Identity Suspicion Score in pure SQL, directly actionable for KYC review queues.

</details>

<details>
<summary><strong>Q4 — Which accounts show the classic money mule behavioural signature — foreign inflows, nocturnal activity, structuring, and velocity bursts — making them SAR candidates?</strong></summary>

```sql
WITH account_behaviour AS (
    SELECT
        t.account_id,
        ap.account_type,
        ap.home_country,
        ap.is_fraudster,
        ap.risk_score,
        ROUND(AVG(CASE WHEN t.is_foreign_txn = TRUE
                       THEN t.amount END), 2)                       AS avg_foreign_amount,
        SUM(CASE WHEN t.is_foreign_txn = TRUE
                 THEN 1 ELSE 0 END)                                 AS foreign_txn_count,
        ROUND(AVG(t.velocity_1h), 2)                                AS avg_velocity,
        MAX(t.velocity_1h)                                          AS peak_velocity,
        ROUND(SUM(CASE WHEN t.hour_of_day BETWEEN 0 AND 5
                       THEN 1 ELSE 0 END)
              * 100.0 / COUNT(*), 1)                                AS pct_night_activity,
        SUM(CASE WHEN t.amount BETWEEN 990 AND 999
                   OR t.amount BETWEEN 4990 AND 4999
                   OR t.amount BETWEEN 9990 AND 9999
                 THEN 1 ELSE 0 END)                                 AS structuring_txn_count,
        COUNT(*)                                                    AS total_txns,
        ROUND(SUM(t.amount), 2)                                     AS total_volume,
        COUNT(DISTINCT t.merchant_country)                          AS countries_touched
    FROM transactions t
    JOIN account_profiles ap ON t.account_id = ap.account_id
    GROUP BY t.account_id, ap.account_type, ap.home_country,
             ap.is_fraudster, ap.risk_score
),
mule_scored AS (
    SELECT *,
        ROUND(
            (CASE WHEN foreign_txn_count > 10
                  THEN 30 ELSE foreign_txn_count * 3 END)
          + (CASE WHEN peak_velocity > 8
                  THEN 25 ELSE peak_velocity * 3 END)
          + (CASE WHEN pct_night_activity > 40
                  THEN 25 ELSE pct_night_activity * 0.6 END)
          + (CASE WHEN structuring_txn_count > 0 THEN 20 ELSE 0 END)
        , 1) AS mule_suspicion_score
    FROM account_behaviour
)
SELECT
    account_id, account_type, home_country,
    total_txns, total_volume, foreign_txn_count,
    avg_velocity, peak_velocity, pct_night_activity,
    structuring_txn_count, countries_touched,
    mule_suspicion_score, risk_score, is_fraudster,
    CASE
        WHEN structuring_txn_count > 0 AND peak_velocity > 8
            THEN '🔴 Structuring + Burst — AML Escalate'
        WHEN mule_suspicion_score >= 60
            THEN '🔴 High Probability Mule Account'
        WHEN mule_suspicion_score >= 40
            THEN '🟠 Suspicious — SAR Filing Candidate'
        ELSE '🟢 Normal'
    END AS aml_verdict
FROM mule_scored
WHERE mule_suspicion_score > 20
ORDER BY mule_suspicion_score DESC;
```

**Business insight:** Transaction structuring (amounts just under $1,000 / $5,000 / $10,000 reporting thresholds) is a deliberate strategy to evade regulatory reporting. Accounts flagged here are potential SAR filing candidates — a legal AML compliance obligation with direct regulatory value.

</details>

<details>
<summary><strong>Q5 — After the first account in a fraud ring is detected, what is the contagion speed to connected accounts, and how many days does the team have to quarantine it?</strong></summary>

```sql
WITH first_fraud AS (
    SELECT
        account_id,
        MIN(timestamp) AS first_fraud_date
    FROM transactions
    WHERE is_fraud = TRUE
    GROUP BY account_id
),
 
ring_accounts AS (
    SELECT DISTINCT ring_id, account_a AS account_id
    FROM network_edges
    WHERE both_fraud = TRUE
    UNION
    SELECT DISTINCT ring_id, account_b AS account_id
    FROM network_edges
    WHERE both_fraud = TRUE
),
 
ring_fraud_dates AS (
    SELECT
        ra.ring_id,
        ra.account_id,
        ff.first_fraud_date
    FROM ring_accounts ra
    JOIN first_fraud ff ON ra.account_id = ff.account_id
),
 
-- one true patient-zero per ring
ring_seed AS (
    SELECT ring_id, account_id AS seed_account, first_fraud_date AS seed_fraud_date
    FROM (
        SELECT
            ring_id,
            account_id,
            first_fraud_date,
            ROW_NUMBER() OVER (
                PARTITION BY ring_id
                ORDER BY first_fraud_date ASC, account_id ASC
            ) AS rn
        FROM ring_fraud_dates
    ) ranked
    WHERE rn = 1
),
 
contagion AS (
    SELECT
        rs.ring_id,
        rs.seed_account,
        rs.seed_fraud_date,
        rfd.account_id      AS connected_account,
        rfd.first_fraud_date AS connected_fraud_date,
        EXTRACT(EPOCH FROM (rfd.first_fraud_date - rs.seed_fraud_date)) / 86400.0
                              AS days_to_spread
    FROM ring_seed rs
    JOIN ring_fraud_dates rfd
      ON rfd.ring_id = rs.ring_id
     AND rfd.account_id <> rs.seed_account
    WHERE rfd.first_fraud_date >= rs.seed_fraud_date   -- forward spread only
)
 
SELECT
    ring_id,
    seed_account,
    Date(seed_fraud_date)                                          AS ring_detected_date,
    COUNT(*)                                                 AS connected_accounts,
    MIN(DATE(connected_fraud_date))                                AS first_infected_date,
    MAX(DATE(connected_fraud_date))                                AS last_infected_date,
    ROUND(MIN(days_to_spread), 1)                             AS first_replication_Speed_days,   -- early warning
    ROUND(MAX(days_to_spread), 1)                             AS quarantine_window_days,   -- <-- direct answer
    ROUND(AVG(days_to_spread), 1)                             AS avg_days_to_spread,
    CASE
        WHEN MIN(days_to_spread) < 10
            THEN '🔴CRITICAL - manual response too slow, auto-suppress'
        WHEN MIN(days_to_spread) < 50
            THEN '🟠HIGH - fast-track manual review'
        ELSE '🟢STANDARD - manual quarantine feasible'
    END                                                       AS response_priority
FROM contagion
GROUP BY ring_id, seed_account, seed_fraud_date
ORDER BY first_replication_speed_days ASC;   -- rings with least time to act, first
```

**Business insight:** This models fraud spread like an epidemiologist models a virus. fastest_spread_days is the operational response window — if it's under 3 days, manual intervention isn't fast enough and automated ring-suppression controls become mandatory.

</details>

<details>
<summary><strong>Q6 — What is the implied fraud tax being silently borne by each customer segment — and are low-risk premium customers cross-subsidising high-risk segments?</strong></summary>

```sql
WITH segment_fraud AS (
    SELECT
        ap.account_type,
        COUNT(DISTINCT ap.account_id)                               AS total_accounts,
        COUNT(t.transaction_id)                                     AS total_txns,
        SUM(CASE WHEN t.is_fraud = TRUE THEN 1 ELSE 0 END)         AS fraud_txns,
        ROUND(SUM(CASE WHEN t.is_fraud = TRUE
                       THEN t.amount ELSE 0 END), 2)               AS fraud_loss,
        ROUND(SUM(t.amount), 2)                                     AS total_volume,
        ROUND(AVG(ap.credit_limit), 2)                              AS avg_credit_limit,
        ROUND(AVG(ap.risk_score), 2)                                AS avg_risk_score
    FROM account_profiles ap
    JOIN transactions t ON ap.account_id = t.account_id
    GROUP BY ap.account_type
),
 
totals AS (
    SELECT
        SUM(fraud_loss) AS grand_total_fraud_loss,
        SUM(total_txns) AS grand_total_txns
    FROM segment_fraud
),
 
benchmarked AS (
    SELECT
        sf.*,
        t.grand_total_fraud_loss,
        t.grand_total_txns,
        -- the "fair" per-txn fraud cost under a uniform, blended pricing model
        ROUND(t.grand_total_fraud_loss / t.grand_total_txns, 4)     AS blended_portfolio_fraud_tax_per_txn,
        ROUND(sf.fraud_loss / sf.total_txns, 4)                     AS implied_fraud_tax_per_txn
    FROM segment_fraud sf
    CROSS JOIN totals t
)
 
SELECT
    account_type,
    total_accounts,
    total_txns,
    fraud_txns,
    ROUND(fraud_txns * 100.0 / total_txns, 2)                       AS fraud_rate_pct,
    fraud_loss,
    ROUND(fraud_loss * 100.0 / grand_total_fraud_loss, 2)           AS share_of_total_fraud_loss,
    ROUND(fraud_loss / total_accounts, 2)                           AS fraud_cost_per_account,
    avg_risk_score,
    implied_fraud_tax_per_txn,
    blended_portfolio_fraud_tax_per_txn,
    -- the direct answer: is this segment over- or under-charged relative to its own risk?
    ROUND(blended_portfolio_fraud_tax_per_txn - implied_fraud_tax_per_txn, 4)
                                                                     AS subsidy_gap_per_txn,
    ROUND((blended_portfolio_fraud_tax_per_txn - implied_fraud_tax_per_txn) * total_txns, 2)
                                                                     AS net_dollar_subsidy_effect,
    CASE
        WHEN implied_fraud_tax_per_txn < blended_portfolio_fraud_tax_per_txn
             AND avg_risk_score < 30
            THEN '🟢 SUBSIDISING — pays more than its own risk warrants under flat pricing'
        WHEN implied_fraud_tax_per_txn > blended_portfolio_fraud_tax_per_txn
             AND avg_risk_score >= 30
            THEN '🔴 SUBSIDISED — pays less than its own risk costs under flat pricing'
        ELSE '🟡 Roughly priced in line with its own risk'
    END                                                              AS cross_subsidy_verdict
FROM benchmarked
ORDER BY net_dollar_subsidy_effect DESC;
```

**Business insight:** If premium accounts generate the lowest fraud rate but are charged the same fees as high-risk segments, that's a product pricing inequity and a churn risk. implied_fraud_tax_per_txn makes this argument with precision — this is the analysis that moves the conversation into the CFO's pricing strategy meeting.

</details>

<details>
<summary><strong>Q7 — What specific combination of time, day type, device, geography, authentication strength, and merchant category creates the #1 fraud attack window?</strong></summary>

```sql
WITH attack_windows AS (
    SELECT
        CASE
            WHEN hour_of_day BETWEEN 0  AND 5  THEN 'Night (0-5h)'
            WHEN hour_of_day BETWEEN 6  AND 11 THEN 'Morning (6-11h)'
            WHEN hour_of_day BETWEEN 12 AND 17 THEN 'Afternoon (12-17h)'
            ELSE 'Evening (18-23h)'
        END                                                    AS time_window,
        CASE WHEN is_weekend = TRUE THEN 'Weekend' ELSE 'Weekday' END
                                                                 AS day_type,
        device_type,
        CASE WHEN is_foreign_txn = TRUE THEN 'Foreign' ELSE 'Domestic' END
                                                                 AS txn_geography,
        CASE WHEN has_2fa = FALSE THEN 'No 2FA' ELSE 'Has 2FA' END
                                                                 AS auth_strength,
        merchant_category,
        COUNT(*)                                                AS total_txns,
        SUM(is_fraud::int)                                      AS fraud_txns,
        ROUND(SUM(is_fraud::int) * 100.0 / COUNT(*), 2)         AS fraud_success_rate_pct,
        ROUND(AVG(CASE WHEN is_fraud = TRUE THEN amount END), 2) AS avg_fraud_amount,
        ROUND(SUM(CASE WHEN is_fraud = TRUE THEN amount ELSE 0 END), 2)
                                                                 AS total_fraud_loss
    FROM transactions
    GROUP BY 1, 2, 3, 4, 5, 6
    HAVING COUNT(*) >= 200          -- reliability floor: raised from 50 so the
                                     -- #1 combo isn't a small-sample fluke
),
 
ranked AS (
    SELECT
        *,
        RANK() OVER (ORDER BY fraud_success_rate_pct DESC) AS risk_rank,
        CASE
            WHEN total_txns >= 500 THEN '🔴High confidence'
            WHEN total_txns >= 200 THEN '🟠Moderate confidence'
            ELSE '🟢Low confidence'
        END AS sample_reliability
    FROM attack_windows
)
 
-- Top 25 supporting table, ranked by fraud success rate
SELECT
    risk_rank,
    time_window,
    day_type,
    device_type,
    txn_geography,
    auth_strength,
    merchant_category,
    total_txns,
    fraud_txns,
    fraud_success_rate_pct,
    sample_reliability,
    avg_fraud_amount,
    total_fraud_loss
FROM ranked
ORDER BY risk_rank ASC
LIMIT 25;
```

**Business insight:** The top row of this result is the organisation's single biggest vulnerability expressed as one sentence — the exact time/device/geography/auth combination where fraud succeeds most often. Present this to the board as priority control gap #1.

</details>

<details>
<summary><strong>Q8 — How much of today's fraud loss was actually caused by yesterday's decision not to act on the ring's seed account?</strong></summary>

```sql
WITH first_fraud AS (
    SELECT account_id, MIN(timestamp) AS first_fraud_date
    FROM transactions WHERE is_fraud = TRUE
    GROUP BY account_id
),
ring_accounts AS (
    SELECT DISTINCT ring_id, account_a AS account_id FROM network_edges WHERE both_fraud = TRUE
    UNION
    SELECT DISTINCT ring_id, account_b AS account_id FROM network_edges WHERE both_fraud = TRUE
),
ring_fraud_dates AS (
    SELECT ra.ring_id, ra.account_id, ff.first_fraud_date
    FROM ring_accounts ra
    JOIN first_fraud ff ON ra.account_id = ff.account_id
),
ring_seed AS (
    SELECT ring_id, account_id AS seed_account, first_fraud_date AS seed_date
    FROM (
        SELECT ring_id, account_id, first_fraud_date,
               ROW_NUMBER() OVER (PARTITION BY ring_id ORDER BY first_fraud_date, account_id) AS rn
        FROM ring_fraud_dates
    ) ranked
    WHERE rn = 1
),
preventable_loss AS (
    SELECT
        rs.ring_id, rs.seed_account, rs.seed_date,
        t.account_id AS downstream_account, t.transaction_id, t.timestamp, t.amount
    FROM ring_seed rs
    JOIN ring_fraud_dates rfd ON rfd.ring_id = rs.ring_id AND rfd.account_id <> rs.seed_account
    JOIN transactions t ON t.account_id = rfd.account_id AND t.is_fraud = TRUE
    WHERE t.timestamp > rs.seed_date
)
SELECT
    ring_id, seed_account, DATE(seed_date) AS ring_detected_date,
    COUNT(DISTINCT downstream_account)                                              AS downstream_accounts_activated,
    COUNT(*)                                                                        AS downstream_fraud_txns,
    ROUND(SUM(amount), 2)                                                           AS preventable_loss_usd,
    ROUND(SUM(CASE WHEN timestamp <= seed_date + INTERVAL '5 days' THEN amount ELSE 0 END), 2) AS loss_within_5day_response_window,
    ROUND(SUM(CASE WHEN timestamp >  seed_date + INTERVAL '5 days' THEN amount ELSE 0 END), 2) AS loss_after_response_window_missed
FROM preventable_loss
GROUP BY ring_id, seed_account, seed_date
ORDER BY preventable_loss_usd DESC;
```

**Business insight:** loss_after_response_window_missed is the direct dollar cost of investigation lag, per ring — a number a CFO can put next to headcount requests.

</details>

<details>
<summary><strong>Q9 — Which accounts were drifting toward fraud behaviour before their first confirmed fraudulent transaction?</strong></summary>

```sql
WITH fraud_first AS (
    SELECT account_id, MIN(timestamp) AS first_fraud_ts
    FROM transactions WHERE is_fraud = TRUE
    GROUP BY account_id
),
pre_fraud_txns AS (
    SELECT
        t.account_id, t.timestamp, t.ip_risk_score, t.velocity_1h,
        t.is_foreign_txn, t.amount_vs_avg_ratio,
        ROW_NUMBER() OVER (PARTITION BY t.account_id ORDER BY t.timestamp) AS rn,
        COUNT(*) OVER (PARTITION BY t.account_id)                          AS total_pre_txns
    FROM transactions t
    JOIN fraud_first ff ON t.account_id = ff.account_id
    WHERE t.timestamp < ff.first_fraud_ts AND t.is_fraud = FALSE
),
halved AS (
    SELECT
        account_id,
        CASE WHEN rn <= total_pre_txns / 2.0 THEN 'early' ELSE 'late' END AS phase,
        ip_risk_score, velocity_1h, is_foreign_txn, amount_vs_avg_ratio
    FROM pre_fraud_txns
    WHERE total_pre_txns >= 10   -- reliability floor: need real pre-history
),
phase_stats AS (
    SELECT
        account_id, phase,
        AVG(ip_risk_score)          AS avg_ip,
        AVG(velocity_1h)            AS avg_vel,
        AVG(is_foreign_txn::int)*100 AS pct_foreign,
        AVG(amount_vs_avg_ratio)    AS avg_ratio
    FROM halved
    GROUP BY account_id, phase
),
drift AS (
    SELECT
        e.account_id,
        ROUND(l.avg_ip - e.avg_ip, 2)             AS ip_drift,
        ROUND(l.avg_vel - e.avg_vel, 2)            AS velocity_drift,
        ROUND(l.pct_foreign - e.pct_foreign, 2)    AS foreign_pct_drift,
        ROUND(l.avg_ratio - e.avg_ratio, 2)        AS spend_ratio_drift
    FROM phase_stats e
    JOIN phase_stats l ON e.account_id = l.account_id AND e.phase = 'early' AND l.phase = 'late'
)
SELECT
    d.*,
    (CASE WHEN ip_drift > 0 THEN 1 ELSE 0 END
     + CASE WHEN velocity_drift > 0 THEN 1 ELSE 0 END
     + CASE WHEN foreign_pct_drift > 0 THEN 1 ELSE 0 END
     + CASE WHEN spend_ratio_drift > 0 THEN 1 ELSE 0 END)               AS drift_signals_positive,
    CASE
        WHEN ip_drift > 0 AND velocity_drift > 0
             AND (foreign_pct_drift > 0 OR spend_ratio_drift > 0)
            THEN '🔴 Pre-crime drift detected — escalate for early review'
        ELSE '🟢 No clear drift'
    END AS pre_crime_verdict
FROM drift d
ORDER BY drift_signals_positive DESC, ip_drift DESC;
```

**Business insight:** Accounts flagged here are the pre-crime queue — candidates for proactive review before the first loss event, not after.

</details>

<details>
<summary><strong>Q10 — Which fraud pattern is quietly teaching every other pattern how to evolve?</strong></summary>

```sql
WITH pattern_yearly AS (
    SELECT
        fraud_pattern,
        EXTRACT(YEAR FROM timestamp)::INT AS year,
        AVG(velocity_1h)                  AS avg_vel,
        AVG(ip_risk_score)                AS avg_ip,
        AVG(is_foreign_txn::int) * 100     AS pct_foreign,
        AVG((NOT card_present)::int) * 100 AS pct_cnp,
        AVG((NOT has_2fa)::int) * 100      AS pct_no_2fa
    FROM transactions
    WHERE is_fraud = TRUE AND fraud_pattern IS NOT NULL
    GROUP BY fraud_pattern, year
),

metric_stats AS (
    SELECT
        AVG(avg_vel) AS m_vel, NULLIF(STDDEV(avg_vel), 0) AS sd_vel,
        AVG(avg_ip) AS m_ip, NULLIF(STDDEV(avg_ip), 0) AS sd_ip,
        AVG(pct_foreign) AS m_foreign, NULLIF(STDDEV(pct_foreign), 0) AS sd_foreign,
        AVG(pct_cnp) AS m_cnp, NULLIF(STDDEV(pct_cnp), 0) AS sd_cnp,
        AVG(pct_no_2fa) AS m_no2fa, NULLIF(STDDEV(pct_no_2fa), 0) AS sd_no2fa
    FROM pattern_yearly
),
pattern_yearly_z AS (
    SELECT
        py.fraud_pattern, py.year,
        (py.avg_vel - ms.m_vel) / ms.sd_vel             AS z_vel,
        (py.avg_ip - ms.m_ip) / ms.sd_ip                AS z_ip,
        (py.pct_foreign - ms.m_foreign) / ms.sd_foreign AS z_foreign,
        (py.pct_cnp - ms.m_cnp) / ms.sd_cnp             AS z_cnp,
        (py.pct_no_2fa - ms.m_no2fa) / ms.sd_no2fa      AS z_no2fa
    FROM pattern_yearly py
    CROSS JOIN metric_stats ms
),

pairs AS (
    SELECT
        a.fraud_pattern AS pattern_a, a.year AS year_a,
        b.fraud_pattern AS pattern_b, b.year AS year_b,
        ROUND(SQRT(
            POWER(a.z_vel - b.z_vel, 2) + POWER(a.z_ip - b.z_ip, 2) +
            POWER(a.z_foreign - b.z_foreign, 2) + POWER(a.z_cnp - b.z_cnp, 2) +
            POWER(a.z_no2fa - b.z_no2fa, 2)
        ), 3) AS behavioural_distance
    FROM pattern_yearly_z a
    JOIN pattern_yearly_z b ON b.year = a.year + 1 AND a.fraud_pattern <> b.fraud_pattern
),

-- Median distance per (pattern_b, year_b) cohort, computed as a
-- proper grouped aggregate (Postgres does not allow PERCENTILE_CONT
-- as a window/OVER function).
median_by_cohort AS (
    SELECT
        pattern_b, year_b,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY behavioural_distance) AS median_distance_this_cohort
    FROM pairs
    GROUP BY pattern_b, year_b
),

ranked AS (
    SELECT
        p.*,
        mc.median_distance_this_cohort,
        RANK() OVER (PARTITION BY p.pattern_b, p.year_b ORDER BY p.behavioural_distance ASC) AS closest_predecessor_rank
    FROM pairs p
    JOIN median_by_cohort mc
      ON mc.pattern_b = p.pattern_b AND mc.year_b = p.year_b
),

qualified_matches AS (
    SELECT *
    FROM ranked
    WHERE closest_predecessor_rank = 1
      AND behavioural_distance < median_distance_this_cohort
),

repetition_counts AS (
    SELECT
        pattern_a, pattern_b,
        COUNT(*) AS times_flagged_as_predecessor,
        ROUND(AVG(behavioural_distance), 3) AS avg_behavioural_distance,
        STRING_AGG(year_b::TEXT, ', ' ORDER BY year_b) AS years_flagged
    FROM qualified_matches
    GROUP BY pattern_a, pattern_b
)

SELECT
    qm.pattern_a, qm.year_a, qm.pattern_b, qm.year_b,
    qm.behavioural_distance, ROUND(qm.median_distance_this_cohort::numeric, 2) as median_distance_in_cohort,
    rc.times_flagged_as_predecessor,
    rc.years_flagged,
    CASE
        WHEN rc.times_flagged_as_predecessor >= 2
            THEN '🔴 REPEAT DONOR — recurring signal, worth investigating'
        ELSE '🟡 Single-year match — treat as noise until repeated'
    END AS signal_strength_verdict
FROM qualified_matches qm
JOIN repetition_counts rc
  ON rc.pattern_a = qm.pattern_a AND rc.pattern_b = qm.pattern_b
ORDER BY rc.times_flagged_as_predecessor DESC, qm.pattern_b, qm.year_b;
```

**Business insight:** If Pattern A repeatedly shows up as the closest predecessor to Pattern B across multiple years — not just once — fraud typologies aren't independent, and closing Pattern A early may suppress Pattern B before it matures. (Correlation-in-time signal, not proof of causation.)

</details>
---

## 🛠️ Tech Stack

| Layer | Tools & Techniques |
|---|---|
| **Database / SQL** | PostgreSQL — `PERCENTILE_CONT`, window functions (`OVER`, `PARTITION BY`), `EXTRACT`, CTEs, z-score peer benchmarking, YoY pivoting/unpivoting, cohort-based statistical comparison, weighted composite risk scoring |
| **BI / Reporting** | Microsoft Excel — Power Query for live data aggregation, 21-sheet workbook with a dedicated executive Fraud Intelligence Dashboard sheet, per-query output sheets designed for stakeholder readability |
| **Domain** | Banking & Financial Services fraud risk, AML/KYC compliance, transaction monitoring |

---

## 🚀 How to Use This Project

**Option A — start from the dashboard (fastest, no setup):**
Open `FRAUD_ANALYTICS.xlsx` → start at the `About` sheet for context, then `Fraud Intelligence Dashboard` for the executive summary, then drill into any `SQL-(Q.n)` sheet to see that specific question's output.

**Option B — start from the SQL (to inspect or extend the analysis):**
1. Load `Fraud_Analytics.sql` into a PostgreSQL instance (v13+ recommended for `PERCENTILE_CONT` support).
2. Populate the 5 tables with your own transaction data matching the schema, or generate synthetic data matching the column definitions.
3. Run each `Qn` query block independently — each is self-contained with its own CTEs.
4. Cross-reference the output against the matching `SQL-(Q.n)` sheet in the workbook to see how the raw query result was turned into a reporting-ready view.

---

## 👤 Author

**Aakriti Balachandran** — Finance & Analytics professional (MBA Finance & Analytics, IBS Hyderabad) specializing in BFSI risk analytics, fraud detection, and data-driven decision support. Built as part of a fraud analytics portfolio for BFSI, Big4, and banking analyst roles.

[GitHub](https://github.com/AakritiBalachandran)

---
