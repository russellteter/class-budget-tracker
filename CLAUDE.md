# CLAUDE.md — Class 2026 Marketing Budget Tracker

## Project Overview

Interactive web application for tracking the 2026 Class Technologies marketing budget ($446,914 envelope). Three-tab app (Dashboard, Budget, Expenses) backed by Google Sheets for persistence, hosted on GitHub Pages.

**Live:** https://russellteter.github.io/class-budget-tracker/

## Current State (v6)

- `index.html` — HTML shell (105 lines). 3-tab structure with ARIA tablist/tab/tabpanel roles, modal, drill-down panel, toast container. Favicon is Class logo.
- `styles.css` — Design system (~1420 lines). CSS variables for all colors/spacing, 3 themes (light/dark/high-contrast), quarterly detail table styles, status chips, print stylesheet (110+ lines for financial reports), dark theme coverage for all components.
- `app.js` — Application logic (~2670 lines). Google OAuth with identity-based access control, Sheets API (batchGet/write/append/batchUpdate), computation engine, quarterly detail view, committed events editing with Sheets persistence, Chart.js charts, inline cell editing, CSV export.
- `favicon.png` — Class Technologies logo for browser tab.
- `docs/ux-audit.md` — UX research audit from frontend polish sprint.

## Tabs

| Tab | Purpose |
|-----|---------|
| **Dashboard** | KPI cards (Programs Available, Spent YTD, T&E, Headcount, SW Savings) + 4 Chart.js charts (Quarterly Spend, Cumulative vs Pace, Subcategory breakdown, Monthly Actual vs Forecast) |
| **Budget** | Quarterly Detail view (default): Category > Subcategory > Transaction hierarchy with expand/collapse. Quarter selector (Q1-Q4, YTD, Full Year). Toggle to Monthly Summary (vendor×month grid). Inline editing for actuals, modal editing for committed/recurring items. |
| **Expenses** | Full transaction list with subcategory grouping, quarter button filter, search, category/status filters, expand/collapse, sortable columns, CSV export, + Add modal. Shows committed events as planned rows with status chips. |

## Authentication & Access Control

- **Not signed in**: All tabs show "Sign in to view budget data". No data loads.
- **Admin users** (Russell): Full view — all headcount/salary details visible, audience filter dropdown shown for manual override.
- **Other users**: Team view — no headcount data, no audience dropdown.
- **Admin emails**: Configured in `CONFIG.ADMIN_EMAILS` — `russell.teter@class.com`, `russellteter@gmail.com`, `russell@classtechnologies.com`.
- **Auth flow**: `handleAuthResponse()` → `fetchUserEmail()` (sets audience) → `updateAuthUI()` → `fetchAllSheets()`. Email must resolve before data loads to avoid race condition.
- **Sign out**: Clears all data from memory, re-renders empty state.

## Data Architecture

### Sources of Truth
- **Actual transactions**: Google Sheets `Transactions` tab → `appState.transactions[]`. Filtered to `year >= 2026` and `category !== 'Outside Envelope'` on parse.
- **Planned events**: Google Sheets `Planned Events` tab → `appState.committedEvents[]`. Edits persist via `persistPlannedEvents()`. Falls back to hardcoded data if tab doesn't exist.
- **Recurring commitments**: Google Sheets `Recurring` tab → `appState.recurringCommitments[]`. Edits persist via `persistRecurring()`. Falls back to hardcoded data.
- **Vendor forecasts**: `appState.vendorMonthly[]` — one row per vendor, one value per month. Used for forecast calculation in `recompute()`.
- **Budget allocations**: `appState.budget[]` — category annual totals with monthly breakdown.

### Budget Math (recompute())
```
Programs Available = $90,000 - (YTD Actual + Outstanding) - Forecast
Forecast = SUM(vendorMonthly[Programs] for months >= current month)
```
- Current month IS included in forecast (uses `mi >= curMonthIdx`)
- Outstanding = transactions with `status === 'Outstanding'`
- `CONFIG.BUDGET`: headcount $336,914 + programs $90,000 + T&E $20,000 = $446,914

### Google Sheets Tabs
| Tab | Range | Purpose |
|-----|-------|---------|
| Transactions | A:O | Actual expenses from NetSuite |
| Budget | A:N | Annual/monthly budget allocations |
| Commitments | A:H | Legacy commitments data |
| Vendor Contracts | A:H | SW vendor portfolio |
| Config | A:B | Key-value configuration |
| Planned Events | A:J | Committed future events (auto-created on first save) |
| Recurring | A:G | Recurring monthly commitments (auto-created on first save) |

## Key People
- **Russell Teter** — VP Marketing, primary user, admin access
- **Kate Bertram** — PT contractor, no loaded-cost multiplier
- **Dalton Mullins** — SDR (FTE), reduced salary from $7.5K to ~$2K/mo as of Jan 2026
- **Kendall Woodard** — Creative & Brand (FTE), $4,583/mo
- **Roxana Nabavian** — Mktg Ops contractor, ~$5K/mo avg

## Technical Stack
- Multi-file: `index.html` + `styles.css` + `app.js`
- Chart.js v4 (CDN)
- Google Sheets API v4 + Google Identity Services (OAuth)
- Inter font (Google Fonts)
- No build tools, no npm, no frameworks
- GitHub Pages hosting (repo must be public for free plan)

## Commands
```bash
# Local dev
python3 -m http.server 8000    # OAuth requires http/https origin

# Deploy
git push origin main           # GitHub Pages auto-deploys from main

# Verify syntax
node -c app.js                 # Check for JS syntax errors
```

## Important Constraints
- No localStorage/sessionStorage — all state in JS memory, persisted to Google Sheets
- Outside Envelope (GL 6303/6309) removed entirely — not part of marketing budget
- Q4 2025 data removed entirely — 2026 only
- Software tab hidden — not production ready
- Amounts display as `$XX,XXX.XX`, negatives in red
- Kate Bertram: contractor, no fully-loaded cost multiplier
- Team View: headcount excluded from DOM entirely (not CSS-hidden)
- Committed events auto-create Sheets tabs on first save via `ensureSheetTab()`
- Token refresh: `sheetsApiCall()` wraps write operations with 401 retry

## Brand Colors
- Navy: `#0A1849`
- Purple: `#4739E7`
- Gold/Accent: `#FFBA00`
- Positive: `#059669`
- Negative: `#DC2626`
- Warning: `#D97706`

## File Structure
```
class-budget-tracker/
├── index.html          # HTML shell, 3-tab structure, ARIA roles
├── styles.css          # Design system (~1420 lines), 3 themes, print
├── app.js              # Application logic (~2670 lines)
├── favicon.png         # Class logo for browser tab
├── CLAUDE.md           # This file
├── docs/
│   ├── product-vision.md   # Original vision doc (partially implemented)
│   ├── session-context.md  # Historical conversation context
│   ├── architecture.md     # App architecture & data flow
│   ├── data-model.md       # Google Sheets schema
│   ├── design-system.md    # CSS design system reference
│   ├── sheets-setup.md     # Google API credentials setup
│   └── ux-audit.md         # UX research audit report
└── thoughts/
    └── shared/plans/       # Implementation plans
```
