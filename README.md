# Fraud Intel — SQL Case File Dashboard

[![SQL](https://img.shields.io/badge/SQL-PostgreSQL-336791?logo=postgresql&logoColor=white)](#whats-inside)
[![JS](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-F7DF1E?logo=javascript&logoColor=black)](#whats-inside)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Fraud%20Intel%20Case%20File-black?logo=githubpages&logoColor=white)](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)

A dark, "security operations" style dashboard that showcases 10 SQL fraud-analytics
queries (`FRAUD_ANALYTICS.sql`) as an interactive, filterable website — KPI cards,
charts, and full searchable/sortable/paginated tables for every query, plus a global
filter across the 7 fraud types (`account_takeover`, `card_not_present`,
`card_present_stolen`, `friendly_fraud`, `atm_fraud`, `money_laundering`,
`identity_theft`).

🔗 **[Launch the Live Dashboard →](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)**

It's a **static site** — plain HTML/CSS/JS, no build step, no framework. It reads
the query-output CSVs directly at runtime (via [PapaParse](https://www.papaparse.com/))
and renders charts with [Chart.js](https://www.chartjs.org/). Both are loaded from a
CDN, so you need an internet connection the first time each browser session loads it.

---

## 📑 Table of Contents

- [Live Dashboard](#-live-dashboard)
- [Run it on your MacBook with VS Code](#run-it-on-your-macbook-with-vs-code)
- [What's inside](#whats-inside)
- [Sections](#sections)
- [Customizing](#customizing)

---

## 🖥️ Live Dashboard

**[aakritibalachandran.github.io/nexabank-fraud-intelligence-suite](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)**

The 10 SQL queries in `FRAUD_ANALYTICS.sql` are published as an interactive
**"Fraud Intel" case file** — built on 1,000,000 transactions across 50,000 accounts
(2022–2024), covering resourcing, contagion speed, cross-subsidy, and early-warning
signals across all 7 fraud patterns.

<!--
📸 Add screenshots here — export a few key screens from the live dashboard
(Overview, a chart-heavy query like Q5 Ring Contagion, and a data table like Q3)
and drop the image files into an `assets/` folder in this repo, then update the
paths below. GitHub renders these inline once the files exist in the repo.

![Overview — portfolio KPIs, loss-share donut, attack heatmap](assets/screenshot-overview.png)
![Case 05 — Ring Contagion, spread speed and response priority](assets/screenshot-q5-ring-contagion.png)
![Case 03 — Synthetic Identity, 50,000 scored accounts](assets/screenshot-q3-synthetic-identity.png)
-->

**Key features:**
- **Overview briefing** — portfolio KPIs, fraud loss-share donut, hour × day-of-week
  attack heatmap, fraud pattern reference table, and a jump-to-query index
- **10 case queries (Q1–Q10)**, each with a business-insight callout, one or more
  charts, and a full searchable/sortable/paginated result table
- **Global fraud-type filter** — narrows Overview, Q1, Q2, and Q10 to a single
  pattern at a time
- Renders entirely client-side from the query-output CSVs — no backend, no database
  connection needed to explore the results

The dashboard is a lightweight, dependency-free way to explore the same analysis in
`FRAUD_ANALYTICS.sql` without running PostgreSQL locally.

---

## Run it on your MacBook with VS Code

1. Unzip this folder and open it in VS Code: `File → Open Folder…`
2. Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel,
   if you don't already have it.
3. Right-click `index.html` in the file explorer → **Open with Live Server**
   (or click "Go Live" in the bottom-right status bar).
4. Your browser opens automatically at something like `http://127.0.0.1:5500`.

That's it — the dashboard loads all 10 query result sets and renders everything
client-side.

### Why not just double-click `index.html`?

Opening the file directly (`file://...`) will break the CSV loading — browsers
block `fetch`/XHR requests to local files under the `file://` protocol for security
reasons. You need it served over `http://`, which is exactly what Live Server (or
any static server) does. If you don't want to use VS Code, any of these work from
this folder too:

```bash
# Python (already on macOS)
python3 -m http.server 8000
# then open http://localhost:8000

# Node, if you have it
npx serve .
```

## What's inside

```
index.html            Page structure — sidebar nav, topbar filter, 11 sections
css/style.css          Design system (dark navy "ops console" theme, verdict chips)
js/app.js              Data loading, filtering, chart rendering, table components
data/                  The 10 query-output CSVs + fraud_patterns.csv + a small
                        precomputed hourly-heatmap JSON (from time_series_stats.csv)
FRAUD_ANALYTICS.sql    Your original SQL, included for reference (not used at runtime)
```

> The live dashboard above is hosted separately via GitHub Pages, built on this
> same `index.html` / `css` / `js` / `data` structure.

## Sections

- **Overview** — portfolio KPIs, loss-share donut, hour × day-of-week attack heatmap,
  fraud pattern reference table, jump-to-query index
- **Q1** Resource Allocation — under/over-policed fraud types
- **Q2** YoY Evolution — attack size, speed, and disguise trending by year
- **Q3** Synthetic Identity — 50,000 accounts scored, suspicion histogram, searchable table
- **Q4** Money Mule / AML — 45,700 accounts scored, SAR candidates, searchable table
- **Q5** Ring Contagion — 200 fraud rings, spread speed, response priority
- **Q6** Cross-Subsidy — implied fraud tax by customer segment
- **Q7** Attack Window — top 25 highest-risk time/device/geography intersections
- **Q8** Response Lag Cost — dollar cost of missing the 5-day quarantine window
- **Q9** Pre-Crime Drift — 6,200 accounts that drifted before their first fraud event
- **Q10** Pattern Evolution — which fraud pattern predicts the next

The **fraud-type filter** in the top bar narrows the Overview, Q1, Q2, and Q10
sections (the queries with a `fraud_pattern` dimension) to a single pattern at a time.

## Customizing

- Colors, fonts, and spacing are all CSS custom properties at the top of
  `css/style.css` — change `--v-critical`, `--accent`, etc. in one place.
- Fraud-type colors and the verdict → color mapping live at the top of `js/app.js`
  (`FRAUD_COLORS`, `VERDICT_COLORS`).
- To swap in fresh query output, just replace the matching CSV in `data/` — the
  column names must stay the same, since `js/app.js` reads specific keys.

---

## 👤 Author

**Aakriti Balachandran**
🔗 [GitHub](https://github.com/AakritiBalachandran)
🌐 [Live Dashboard](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)
✉️ aakriti.9703@gmail.com
