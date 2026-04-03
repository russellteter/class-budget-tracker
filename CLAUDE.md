# CLAUDE.md — Class 2026 Marketing Budget Tracker

## FIRST: Read These Two Documents

1. **`docs/product-vision.md`** — Russell's detailed vision in his own words. Covers the calendar/timeline view, actuals vs forecast distinction, Q4 carryover argument, scenario planner, software savings narrative, audience filtering, and UI/UX requirements. This is the north star.
2. **`docs/session-context.md`** — Complete conversation history: all decisions, the $35K gap analysis, vendor savings data, headcount details, and prioritized next steps.

Read both before writing any code.

## Project Overview

Interactive web application for tracking, reconciling, and managing the 2026 Class Technologies marketing budget ($446,914 envelope). Multi-file HTML/CSS/JS app backed by Google Sheets for persistence. Hosted on GitHub Pages.

## Current State

- `index.html` — HTML shell with CDN links, semantic structure for all 6 tabs, modal, drill-down panel, toast container
- `styles.css` — Complete design system: CSS variables, 3 themes (light/dark/high-contrast), glassmorphic chrome, data-dense tables, KPI cards, charts, modals, presentation mode, print stylesheet
- `app.js` — Full application logic: Google OAuth, Sheets API (batchGet/write/append), computation engine, audience filtering (full/cfo/team), 6 tab renderers, Chart.js charts, drill-down panel, scenario planner, CSV export
- `v1-reference.html` — Archived v1 dashboard for design reference
- `docs/` — Architecture, data model, design system, Sheets API setup, product vision, and full session context

## Implemented Features

- **6 tabs**: Dashboard, Calendar, Transactions, Scenario, Reconciliation, Savings
- **Google Sheets API**: OAuth sign-in, batchGet for reads, PUT/POST for writes, fallback data for demo
- **3 themes**: Light (default), Dark, High Contrast via `data-theme` attribute
- **Audience filtering**: Full/CFO/Team with DOM-level data exclusion
- **Charts**: Programs waterfall, category doughnut, monthly trend, vendor cost comparison (Chart.js v4)
- **Presentation mode**: larger fonts, no edit controls, Escape to exit
- **Drill-down**: click any aggregated number to see constituent transactions
- **Calendar**: 15-month grid (Q4 2025 + 2026), groupable by category/vendor/GL
- **Scenario planner**: "Can I spend $X?" with impact table and copyable summary
- **Reconciliation**: bridge walkdown from Brian's $85,309 to adjusted actuals
- **Savings**: vendor-by-vendor comparison with company impact visualization

## Next Steps

- Configure GitHub Pages deployment (enable in repo settings)
- Add authorized origin `https://russellteter.github.io` in Google Cloud Console
- Build NetSuite sync runbook for automated data refresh
- Full QA: edge cases, error states, keyboard navigation

## Business Context

Russell Teter is VP Marketing at Class Technologies. This tool helps him:
1. Track $446K marketing budget (Headcount $336K + Programs $90K + T&E $20K)
2. Reconcile with CFO Brian's cash-basis view ($85K Q1 vs Russell's accrual view)
3. Model vendor savings ($213K marketing SW savings = 24.5% of company-wide $871K)
4. Scenario plan new spend requests with auto-generated CFO talking points
5. Manage audience-filtered views (Full/CFO/Team)

## Key People
- **Russell Teter** — VP Marketing, primary user, full access
- **Brian** — CFO, sees cash-basis reconciliation view (no salary detail)
- **Kate Bertram** — PT contractor, rolled into salary totals but labeled as contractor with NO loaded-cost calculations
- **Dalton Mullins** — SDR (FTE), reduced salary from $7.5K to ~$2K/mo as of Jan 2026
- **Kendall Woodard** — Creative & Brand (FTE), $4,583/mo
- **Roxana Nabavian** — Mktg Ops contractor, ~$5K/mo avg

## Technical Stack
- Single-file HTML/JS/CSS
- Chart.js v4 (CDN)
- Google Sheets API v4
- Google Identity Services (OAuth)
- Inter font (Google Fonts)
- No build tools, no npm, no frameworks
- GitHub Pages hosting

## Brand Colors
- Navy: `#0A1849`
- Purple: `#4739E7`
- Gold/Accent: `#FFBA00`
- Light purple bg: `#EDECFD`
- Card bg: `#FFFFFF`
- Border: `#DAD7FA`
- Primary bg: `#F6F6FE`

## File Structure
```
class-budget-tracker/
├── index.html              # HTML shell + CDN links
├── styles.css              # Full design system (light/dark/high-contrast)
├── app.js                  # Application logic (~2100 lines)
├── v1-reference.html       # Archived v1 design reference
├── CLAUDE.md               # This file
├── README.md               # Project readme
└── docs/
    ├── product-vision.md   # Russell's detailed vision (START HERE)
    ├── session-context.md  # Full conversation history & decisions
    ├── architecture.md     # App architecture & data flow
    ├── data-model.md       # Google Sheets schema (all 5 tabs)
    ├── design-system.md    # Complete CSS design system from v1
    └── sheets-setup.md     # Google API credentials setup guide
```

## Commands
- No build step. Open `index.html` in browser.
- For local dev with Sheets API, serve via `python3 -m http.server 8000` (OAuth requires http/https origin)
- Deploy: push to main, GitHub Pages serves index.html

## Important Constraints
- No localStorage or sessionStorage — all state in memory (JS objects)
- Multi-file architecture: `index.html` + `styles.css` + `app.js` (no build tools, no npm)
- Amounts display as `$XX,XXX.XX`, negatives in red
- Kate Bertram: contractor, no fully-loaded cost multiplier
- "Outside Envelope" items (SW subs, prepaid) tracked but NOT counted against budget
- Q4 2025 data is included for carryover context but isn't part of 2026 budget tracking
- Team View: headcount data excluded from DOM entirely, not hidden by CSS
- OAuth required for write access; fallback data used for demo/read-only mode
