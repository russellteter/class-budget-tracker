# Class 2026 Marketing Budget Tracker

Interactive web application for tracking, reconciling, and managing the Class Technologies 2026 marketing budget ($446,914).

## Features

- **Dashboard** — KPI cards, programs waterfall, spend-by-category charts, outstanding invoices
- **Calendar/Timeline** — Monthly grid view (Oct 2025–Dec 2026) with toggleable row grouping (category/vendor/GL)
- **Transaction Detail** — Sortable, filterable table with inline editing and CSV export
- **Scenario Planner** — "Can I spend $X?" calculator with auto-generated CFO talking points
- **CFO Reconciliation** — Cash vs accrual view bridge, Pantheon reclassification proof, carryover evidence
- **Software Savings** — Vendor contract comparison ($213K savings = 24.5% of company-wide SW spend)

## Data Backend

Google Sheets (two-way sync):
- **Spreadsheet ID**: `1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY`
- 5 tabs: Transactions (175 rows), Budget, Commitments, Vendor Contracts, Config
- Read via API key, write via OAuth 2.0

## Quick Start

1. Clone this repo
2. Open `index.html` in a browser (works with embedded fallback data)
3. For Sheets sync: add Google API credentials (see `docs/sheets-setup.md`)
4. For GitHub Pages: push to main, enable Pages in repo settings

## Tech Stack

Single-file HTML/JS/CSS. No build tools.
- Chart.js v4 (CDN)
- Google Sheets API v4
- Google Identity Services (OAuth 2.0)
- Inter font (Google Fonts)

## Documentation

- `docs/architecture.md` — App architecture and data flow
- `docs/data-model.md` — Google Sheets schema for all 5 tabs
- `docs/design-system.md` — CSS design system reference
- `docs/sheets-setup.md` — Google API credentials setup

## Budget Structure

| Category | Annual Budget |
|----------|---------------|
| Headcount | $336,000 |
| Programs | $90,000 |
| T&E | $20,000 |
| **Total** | **$446,914** |

"Outside Envelope" items (software subscriptions, prepaid contracts) are tracked but not counted against the $446K budget.