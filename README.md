<div align="center">

# NexaBank Analytics

### Financial Crime & Fraud Intelligence System

*10 PostgreSQL fraud investigations, rendered as an interactive case file — not a slide deck.*

<br>

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-000000?style=for-the-badge&logo=githubpages&logoColor=white)](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)
[![Author](https://img.shields.io/badge/AUTHOR-Aakriti_Balachandran-555555?style=for-the-badge)](https://github.com/AakritiBalachandran)
[![Email](https://img.shields.io/badge/EMAIL-aakriti.9703%40gmail.com-1A73E8?style=for-the-badge&logo=gmail&logoColor=white)](mailto:aakriti.9703@gmail.com)

<br>

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

</div>

<br>

A dark, "security operations" style dashboard that turns 10 SQL fraud-analytics
investigations (`FRAUD_ANALYTICS.sql`) into an interactive, filterable website —
KPI cards, charts, and full searchable/sortable/paginated tables for every query,
plus a global filter across all 7 fraud types (`account_takeover`,
`card_not_present`, `card_present_stolen`, `friendly_fraud`, `atm_fraud`,
`money_laundering`, `identity_theft`).

It's a **static site** — plain HTML/CSS/JS, no build step, no framework. It reads
the query-output CSVs directly at runtime via [PapaParse](https://www.papaparse.com/)
and renders charts with [Chart.js](https://www.chartjs.org/), both loaded from a CDN.

**🔗 [Launch the Live Dashboard →](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)**

---

## Table of Contents

- [Screenshots](#screenshots)
- [Live Dashboard](#live-dashboard)
- [What's Inside](#whats-inside)
- [Sections](#sections)
- [Getting Started](#getting-started)
- [Customizing](#customizing)
- [Author](#author)

---

## Screenshots

> Screenshots of the live dashboard aren't in the repo yet — this section is wired
> up and ready to go. Drop images into an `assets/` folder at the repo root using
> the filenames below, and they'll render automatically on this page.

| View | File |
|---|---|
| Overview — portfolio KPIs, loss-share donut, attack heatmap | `assets/screenshot-overview.png` |
| Q5 — Ring Contagion, spread speed & response priority | `assets/screenshot-q5-ring-contagion.png` |
| Q3 — Synthetic Identity, 50,000 scored accounts | `assets/screenshot-q3-synthetic-identity.png` |

```markdown
![Overview — portfolio KPIs, loss-share donut, attack heatmap](assets/screenshot-overview.png)
![Q5 — Ring Contagion, spread speed and response priority](assets/screenshot-q5-ring-contagion.png)
![Q3 — Synthetic Identity, 50,000 scored accounts](assets/screenshot-q3-synthetic-identity.png)
```

## Live Dashboard

**[aakritibalachandran.github.io/nexabank-fraud-intelligence-suite](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)**

The 10 SQL queries in `FRAUD_ANALYTICS.sql` are published as an interactive
**"Fraud Intel" case file** — built on 1,000,000 transactions across 50,000
accounts (2022–2024), covering resourcing, contagion speed, cross-subsidy, and
early-warning signals across all 7 fraud patterns.

**Key features:**
- **Overview briefing** — portfolio KPIs, fraud loss-share donut, hour × day-of-week
  attack heatmap, fraud pattern reference table, and a jump-to-query index
- **10 case queries (Q1–Q10)**, each with a business-insight callout, one or more
  charts, and a full searchable/sortable/paginated result table
- **Global fraud-type filter** — narrows Overview, Q1, Q2, and Q10 to a single
  pattern at a time
- Renders entirely client-side from the query-output CSVs — no backend or
  database connection needed to explore the results

## What's Inside

```
index.html            Page structure — sidebar nav, topbar filter, 11 sections
css/style.css          Design system (dark navy "ops console" theme, verdict chips)
js/app.js              Data loading, filtering, chart rendering, table components
data/                  The 10 query-output CSVs + fraud_patterns.csv + a small
                        precomputed hourly-heatmap JSON (from time_series_stats.csv)
FRAUD_ANALYTICS.sql    The original SQL, included for reference (not used at runtime)
```

> The live dashboard is hosted via GitHub Pages, built on this same
> `index.html` / `css` / `js` / `data` structure.

## Sections

| # | Investigation | What it answers |
|---|---|---|
| — | **Overview** | Portfolio KPIs, loss-share donut, hour × day-of-week attack heatmap, fraud pattern reference table |
| Q1 | Resource Allocation | Which fraud types are under- or over-policed |
| Q2 | YoY Evolution | Attack size, speed, and disguise trending year over year |
| Q3 | Synthetic Identity | 50,000 accounts scored, suspicion histogram, searchable table |
| Q4 | Money Mule / AML | 45,700 accounts scored, SAR candidates, searchable table |
| Q5 | Ring Contagion | 200 fraud rings, spread speed, response priority |
| Q6 | Cross-Subsidy | Implied fraud tax by customer segment |
| Q7 | Attack Window | Top 25 highest-risk time / device / geography intersections |
| Q8 | Response Lag Cost | Dollar cost of missing the 5-day quarantine window |
| Q9 | Pre-Crime Drift | 6,200 accounts that drifted before their first fraud event |
| Q10 | Pattern Evolution | Which fraud pattern predicts the next |

The **fraud-type filter** in the top bar narrows the Overview, Q1, Q2, and Q10
sections (the queries with a `fraud_pattern` dimension) to a single pattern at a time.

## Getting Started

### Run it locally with VS Code

1. Clone or download this repository and open the folder in VS Code:
   `File → Open Folder…`
2. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
   extension (Extensions panel → search "Live Server" → Install), if you don't
   already have it.
3. Right-click `index.html` in the file explorer → **Open with Live Server**
   (or click "Go Live" in the bottom-right status bar).
4. Your browser opens automatically at something like `http://127.0.0.1:5500`.

That's it — the dashboard loads all 10 query result sets and renders everything
client-side.

### Why not just double-click `index.html`?

Opening the file directly (`file://...`) breaks the CSV loading — browsers block
`fetch`/XHR requests to local files under the `file://` protocol for security
reasons. It needs to be served over `http://`, which is exactly what Live Server
(or any static server) does. If you'd rather not use VS Code, any of these work
from this folder too:

```bash
# Python (already on macOS)
python3 -m http.server 8000
# then open http://localhost:8000

# Node, if you have it
npx serve .
```

## Customizing

- Colors, fonts, and spacing are all CSS custom properties at the top of
  `css/style.css` — change `--v-critical`, `--accent`, etc. in one place.
- Fraud-type colors and the verdict → color mapping live at the top of
  `js/app.js` (`FRAUD_COLORS`, `VERDICT_COLORS`).
- To swap in fresh query output, replace the matching CSV in `data/` — column
  names must stay the same, since `js/app.js` reads specific keys.

## Author

<div align="center">

**Aakriti Balachandran**

[![GitHub](https://img.shields.io/badge/GitHub-AakritiBalachandran-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AakritiBalachandran)
[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-Fraud_Intel_Case_File-000000?style=for-the-badge&logo=githubpages&logoColor=white)](https://aakritibalachandran.github.io/nexabank-fraud-intelligence-suite/)
[![Email](https://img.shields.io/badge/Email-aakriti.9703%40gmail.com-1A73E8?style=for-the-badge&logo=gmail&logoColor=white)](mailto:aakriti.9703@gmail.com)

</div>
