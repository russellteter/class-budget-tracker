# Full Session Context — Cowork → Claude Code Handoff

This document captures all decisions, data sources, problem-solving, and context from the Cowork sessions that built this project. Read this before starting any work.

## What Was Built

1. **Google Sheets backend** — Spreadsheet `1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY` with 5 tabs, 175 transactions loaded
2. **v1 HTML dashboard** (`v1-reference.html`) — Static dashboard Russell liked aesthetically. Compact, data-dense, spreadsheet-like.
3. **v2 HTML app** (`index.html`) — Interactive app with Sheets sync, 6 tabs, inline editing. Functionally complete but UI/UX needs redesign to match v1 density.

## The $35K Gap — Solved

Brian (CFO) reported $85,309 in Q1 marketing programs spend (cash basis). Russell's accrual view showed ~$49,459 in programs. The gap was:

- **Pantheon**: $17,426 in Q1 cash payments for website CMS hosting. Should be reclassified from marketing programs → software/infrastructure ("Outside Envelope"). Brian's adjusted Q1 = $67,883.
- **Carryover timing**: Items like Sponge Software, Docebo/RKO sponsorships, and Training Magazine were booked in Q4 2025 but cash payments hit Q1 2026. These inflate Brian's cash-basis Q1 number.

## Budget Structure

```
Total Budget: $446,914
├── Headcount: $336,000  (salary only — pending clarification from Brian on fully-loaded)
├── Programs:   $90,000
└── T&E:        $20,000

"Outside Envelope" (tracked, not budgeted):
├── Software Subscriptions (GL 6303)
└── Prepaid Contracts (GL 6309)
```

## Headcount Details

| Person | Role | Dept | Type | Monthly | Notes |
|--------|------|------|------|---------|-------|
| Dalton Mullins | SDR | 408-SDRs | FTE | ~$2,083 (was $7,500) | Reduced Jan 2026 |
| Kendall Woodard | Creative | 404-Creative & Brand | FTE | $4,583 | Stable |
| Roxana Nabavian | Mktg Ops | 403-Mktg Ops | Contractor | ~$5,000 avg | Variable |
| Kate Bertram | Mktg Ops | 403-Mktg Ops | PT Contractor | ~$2,800 avg | NO loaded-cost calc |
| Sales Enablement | Multiple | 406-Sales Enablement | FTE | $6,875-$12,291 | Q4 2025 only in data |

### Fully-Loaded Cost Multipliers (from NetSuite Q1 2026)

These were pulled for all departments. Marketing contractors (403-Mktg Ops) have a 1.0x multiplier. Other marketing departments range 1.12x to 1.56x. The key question Russell needs to ask Brian: **Is the $336K headcount budget salary-only or fully-loaded?** The app should handle either interpretation.

## Programs Waterfall (Q1 2026)

```
$90,000  Budget (annual)
- $23,230  Q1 actual spend (consulting + events + advertising)
- $7,700   Sponge outstanding (March MOPS, final month)
- $18,900  Q2-Q4 committed ($950 LinkedIn + $850 Google + $300 Paperclip × 9 months)
= ~$40,170 Available for new programs spend
```

## Software Vendor Savings

Russell drove $213,623/yr in marketing software savings. Company-wide software budget = $871,560/yr (from Brian's Row 28). Marketing savings = 24.5% of total company SW spend.

| Vendor | Before | After | Saved | % | Status |
|--------|--------|-------|-------|---|--------|
| Salesforce | $93,600 | $52,471 | $41,129 | 43.9% | Renewed |
| ZoomInfo | $63,000 | $15,204 | $47,796 | 75.9% | Renewed |
| Sponge Software | $78,000 | $7,700 | $70,300 | 90.1% | Ending Mar 2026 |
| HubSpot | $24,000 | $16,033 | $7,967 | 33.2% | Renewed |
| Outreach | $51,600 | $25,200 | $26,400 | 51.2% | Renewed |
| Wrike | $17,640 | $0 | $17,640 | 100% | Eliminated |
| Bynder | $11,760 | $0 | $11,760 | 100% | Eliminated |
| LinkedIn Sales Nav | $39,900 | $0 | $39,900 | 100% | Eliminated |

## Q4 2025 Carryover Items

These were booked in Q4 2025 accrual but paid in Q1 2026 cash:
- Sponge Software: $6,500/mo × 3 months (Oct-Dec 2025) = $19,500
- Docebo/RKO: $9,328 (Nov) + $26,500 (Dec) = $35,828
- Training Magazine: $12,000 (Oct) + $15,000 (Oct) + $8,500 (Dec) = $35,500
- DevLearn: $3,647.50 (Dec)

## Brian's Cash Flow Reference

Separate spreadsheet (read-only): `1PKnyXYxN4hGZHgHq7Vl-s9kkYE5mQKC0DA3ydJhEV_g`
- Title: "Class Cash Flow Forecast as of March 15 2026"
- Row 27 "Marketing Programs": $85,309 YTD (actuals through week 11), $317,309 full year forecast
- Row 28 "Software Subscriptions": $88,554 YTD, $871,560 full year (company-wide)
- Row 19 "Payroll": $2,264,031 YTD, $8,459,776 full year
- Weekly granularity, forecasts ~$4K/week for marketing Q2-Q4

## NetSuite Query Details

Marketing department IDs: 11, 37, 38, 39, 40, 41, 42, 43, 44, 72
Marketing GL accounts: 6101, 6102, 6103, 6104, 6105, 6202, 6303, 6309, 6402, 6405, 6406

Department mapping:
- 11 → 400-Marketing
- 37 → 401-Education Marketing
- 38 → 402-Corp Marketing
- 39 → 403-Mktg Ops
- 40 → 404-Creative & Brand
- 41 → 405-Community & Advocacy
- 42 → 406-Sales Enablement
- 43 → 407-Mktg Leadership
- 44 → 408-SDRs
- 72 → (additional marketing)

## Key Design Decisions Russell Made

1. **Google Sheets as backend** (not local storage, not a database)
2. **Two-way sync** — edits in webapp write to Sheets, Sheets edits reflect in app
3. **Three audience views**: Full (Russell), CFO (Brian, no salary detail), Team (marketing, no comp)
4. **Toggle row grouping** in calendar: by Category, Vendor, or GL Account
5. **Known commitments only for forecast** — $950 LinkedIn, $850 Google, $300 Paperclip monthly
6. **Kate Bertram as PT contractor** in salary totals — itemized, labeled, NO loaded-cost multiplier
7. **Both inline editing AND modal forms** for adding/editing transactions
8. **On-demand refresh button** (not auto-polling)
9. **Match v1 design style** — compact, data-dense, spreadsheet-like
10. **GitHub Pages hosting**

## Russell's Feedback on v2

Direct quote context: "The UI/UX of this is pretty lame. Looks very Generation 1 AI slop vibe-coded design. Could you put in place more of a Google Sheets-like view, or more like Excel, thinking something that's a bit more compact?"

Translation: The v2 app has too much whitespace, too-large fonts, too much padding, rounded corners too big. He wants it to look like a professional spreadsheet tool, not a marketing landing page. Reference `v1-reference.html` for the target density.

## Files in Google Sheets (Already Populated)

Spreadsheet has real data in all 5 tabs:
- **Transactions**: 175 rows (81 Q4 2025 + 93 Q1 2026 + 1 outstanding)
- **Budget**: Monthly allocations by category
- **Commitments**: 8 recurring items (salaries + ad spend + Paperclip)
- **Vendor Contracts**: 8 vendors + total row
- **Config**: 19 key-value pairs (budget numbers, Brian's numbers, department IDs, etc.)

## What Needs Doing Next

1. **UI/UX redesign** of `index.html` to match `v1-reference.html` aesthetic (see `docs/design-system.md`)
2. **Google Sheets API credentials** — needs Google Cloud project setup (see `docs/sheets-setup.md`)
3. **GitHub Pages deployment** — enable in repo settings
4. **Testing with live Sheets data** — swap in real API_KEY and CLIENT_ID
5. **Calendar tab polish** — the grouping toggle and scrollable Q4 2025 area need work
6. **Audience filter implementation** — the CFO and Team views need to actually hide/show the right data
