# Data Model — Google Sheets Schema

Spreadsheet ID: `1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY`
URL: https://docs.google.com/spreadsheets/d/1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY/edit

## Sheet 1: Transactions

175 data rows (81 Q4 2025 + 93 Q1 2026 + 1 outstanding). This is the core data.

| Column | Header | Type | Example |
|--------|--------|------|----------|
| A | Date | MM/DD/YYYY | 01/31/2026 |
| B | Vendor | String | Dalton Mullins |
| C | Amount | Number | 4583.33 |
| D | GL_Account | String | 6101 |
| E | GL_Name | String | Salary |
| F | Department | String | 408-SDRs |
| G | Memo | String | Payroll JE5798 |
| H | Category | String | Headcount |
| I | Subcategory | String | Salary |
| J | Month | String | Jan |
| K | Quarter | String | Q1 |
| L | Year | Number | 2026 |
| M | Status | String | Actual / Outstanding |
| N | Is_Carryover | String | Yes / No |
| O | Employee_Type | String | FTE / Contractor / (blank) |

### Categories
- **Headcount**: Salary (6101), Bonus (6102), Payroll Tax (6103), Benefits (6104), Commissions (6105)
- **Programs**: Consulting (6402), Conferences/Events (6405), Advertising (6406)
- **T&E**: Lodging (6202)
- **Outside Envelope**: Software Subscriptions (6303), Prepaid (6309) — tracked but NOT against budget

### Departments
- 400-Marketing
- 401-Education Marketing
- 402-Corp Marketing
- 403-Mktg Ops
- 404-Creative & Brand
- 405-Community & Advocacy
- 406-Sales Enablement
- 407-Mktg Leadership
- 408-SDRs

## Sheet 2: Budget

Monthly budget allocations by category.

| Column | Header | Example |
|--------|--------|----------|
| A | Category | Headcount |
| B | Annual_Budget | 336000 |
| C-N | Jan through Dec | 28000 |

Rows: Headcount ($336K), Programs ($90K), T&E ($20K), Outside Envelope ($0), TOTAL ($446,914), Notes

## Sheet 3: Commitments

Known recurring monthly expenses for forecasting.

| Column | Header | Example |
|--------|--------|----------|
| A | Vendor | LinkedIn Ads |
| B | Monthly_Amount | 950 |
| C | Category | Programs |
| D | GL_Account | 6406 |
| E | Start_Month | Apr |
| F | End_Month | Dec |
| G | Status | Active / Outstanding |
| H | Notes | Monthly digital ad spend |

Key commitments:
- LinkedIn Ads: $950/mo (Programs)
- Google Ads: $850/mo (Programs)
- Paperclip Promotions: $300/mo (Programs)
- Sponge Software: $7,700 (March only, final month — Outstanding)
- Kendall Woodard: $4,583/mo (Headcount)
- Dalton Mullins: $2,083/mo (Headcount, reduced from $7.5K)
- Roxana Nabavian: ~$5,000/mo (Headcount, contractor)
- Kate Bertram: ~$2,800/mo (Headcount, PT contractor, NO loaded-cost)

## Sheet 4: Vendor Contracts

Software vendor savings tracking.

| Column | Header | Example |
|--------|--------|----------|
| A | Vendor | Salesforce |
| B | Annual_Cost_Before | 93600 |
| C | Annual_Cost_After | 52471 |
| D | Annual_Savings | 41129 |
| E | Savings_Pct | 43.9% |
| F | Category | CRM |
| G | Status | Renewed / Ending / Eliminated |
| H | Notes | Renegotiated Q4 2025 |

Vendors tracked:
- Salesforce: $93.6K → $52.5K (43.9% savings)
- ZoomInfo: $63K → $15.2K (75.9%)
- Sponge Software: $78K → $7.7K (90.1%, ending)
- HubSpot: $24K → $16K (33.2%)
- Outreach: $51.6K → $25.2K (51.2%)
- Wrike: $17.6K → $0 (eliminated)
- Bynder: $11.8K → $0 (eliminated)
- LinkedIn Sales Nav: $39.9K → $0 (eliminated)
- **TOTAL: $379.5K → $116.6K = $262.9K savings (69.3%)**

## Sheet 5: Config

Key-value reference data.

| Key | Value |
|-----|-------|
| total_budget | 446914 |
| headcount_budget | 336000 |
| programs_budget | 90000 |
| te_budget | 20000 |
| company_sw_budget | 871560 |
| marketing_sw_savings | 213623 |
| sw_savings_pct | 24.5% |
| brian_q1_marketing_programs | 85309 |
| pantheon_reclassification | 17426 |
| brian_adjusted_q1 | 67883 |
| brian_full_year_forecast | 317309 |
| fiscal_year | 2026 |
| budget_basis | salary_only_pending_clarification |
| kate_bertram_type | PT Contractor - no loaded-cost |
| marketing_dept_ids | 11,37,38,39,40,41,42,43,44,72 |
| marketing_gl_accounts | 6101,6102,6103,6104,6105,6202,6303,6309,6402,6405,6406 |
| sponge_outstanding | 7700 |
| q4_carryover_total | 89225.50 |
| netsuite_last_refresh | 2026-03-31 |

## Brian's Cash Flow Reference

Separate spreadsheet (read-only reference):
- ID: `1PKnyXYxN4hGZHgHq7Vl-s9kkYE5mQKC0DA3ydJhEV_g`
- Row 27 "Marketing Programs": $85,309 YTD, $317,309 full year
- Row 28 "Software Subscriptions": $88,554 YTD, $871,560 full year
- Row 19 "Payroll": $2,264,031 YTD, $8,459,776 full year
