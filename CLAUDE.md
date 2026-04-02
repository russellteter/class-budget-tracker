# CLAUDE.md — Class 2026 Marketing Budget Tracker

## FIRST: Read Session Context

**Before doing anything, read `docs/session-context.md`.** It contains the complete conversation history, all decisions Russell made, the $35K gap analysis, vendor savings data, headcount details, and Russell's specific feedback on the current UI. This is the most important file in the repo for understanding what to build.

## Project Overview

Interactive web application for tracking, reconciling, and managing the 2026 Class Technologies marketing budget ($446,914 envelope). Single-file HTML/JS/CSS app backed by Google Sheets for persistence. Designed to be hosted on GitHub Pages.

## Current State

- `index.html` — The working app (v2). Functional but needs UI/UX redesign. Too much whitespace, too "AI vibe-coded". Needs to look more like a spreadsheet/Excel — compact, data-dense, professional.
- `v1-reference.html` — The v1 dashboard Russell liked. Use this as the design reference. Copy its CSS design system, spacing, font sizes, table density. The v1 has 12px body font, 8px table cell padding, compact KPI cards, tight header. This is the target aesthetic.
- `docs/` — Architecture, data model, design system, Sheets API setup, and full session context.

## Priority 1: UI/UX Redesign

The current `index.html` needs to be redesigned to match the v1 reference aesthetic:

### What to copy from v1-reference.html:
- **Font size**: body 14px, table cells 12px, headers 10px uppercase
- **Spacing**: padding 8px 12px on table cells, 12px gaps, 16px container padding
- **Header**: compact (12px 20px padding), 18px title, sticky
- **Tab nav**: compact (12px 20px padding), 13px font, bottom border style
- **KPI cards**: 200px min grid, 16px padding, 28px value, 11px label, 3px gradient top bar
- **Tables**: sticky gradient thead, 10px uppercase headers, alternating very subtle row hover, category rows with navy bg, pill badges for categories
- **Charts**: 280px height wrapper, 12px uppercase card titles
- **CSS variables**: Use the exact v1 variable names and values (see docs/design-system.md)
- **Dark mode**: data-theme attribute approach, not class toggle

### What NOT to do:
- No 1.75rem headers or rem-based sizing (use px)
- No generous padding/margins
- No large rounded corners (max 9px)
- No "card with lots of whitespace" aesthetic
- No emoji-heavy UI

## Priority 2: Google Sheets API Integration

The app needs real two-way Google Sheets sync. See `docs/sheets-setup.md` for details.

- Spreadsheet ID: `1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY`
- 5 sheets: Transactions (175 rows), Budget, Commitments, Vendor Contracts, Config
- Read: Google Sheets API v4 with API key (public read)
- Write: OAuth 2.0 with Sheets scope
- Fallback: embedded data constant if API unavailable

## Priority 3: GitHub Pages Deployment

- Deploy `index.html` as root
- Set up GitHub Pages from main branch
- CNAME optional (no custom domain yet)

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
├── index.html              # Main app (needs redesign)
├── v1-reference.html       # Design reference (keep for comparison)
├── CLAUDE.md               # This file
├── README.md               # Project readme
└── docs/
    ├── architecture.md     # App architecture & data flow
    ├── data-model.md       # Google Sheets schema (all 5 tabs)
    ├── design-system.md    # Complete CSS design system from v1
    ├── session-context.md  # FULL conversation history & decisions
    └── sheets-setup.md     # Google API credentials setup guide
```

## Commands
- No build step. Open `index.html` in browser.
- For local dev with Sheets API, serve via `python3 -m http.server 8000` (OAuth requires http/https origin)
- Deploy: push to main, GitHub Pages serves index.html

## Important Constraints
- No localStorage or sessionStorage (not supported in some hosting contexts)
- All state in memory (JS objects)
- Single file — no separate CSS/JS files
- Amounts display as `$XX,XXX.XX`, negatives in red
- Kate Bertram: contractor, no fully-loaded cost multiplier
- "Outside Envelope" items (SW subs, prepaid) tracked but NOT counted against budget
- Q4 2025 data is included for carryover context but isn't part of 2026 budget tracking
