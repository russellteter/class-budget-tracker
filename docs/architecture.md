# Architecture

## Overview

Single-file HTML/JS/CSS application with Google Sheets as the persistence layer. No server, no build tools, no frameworks. Hosted on GitHub Pages.

```
┌─────────────────────────────────────────────┐
│                  Browser (index.html)            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Dashboard │  │ Calendar │  │ Txn List │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Scenario │  │ CFO Rec  │  │ Savings  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │          appState (in-memory)            │    │
│  │  .transactions[]  .budget[]  .config{}  │    │
│  │  .commitments[]   .vendorContracts[]    │    │
│  └─────────────────┬───────────────────────┘    │
│                    │                             │
│           ┌────────┴────────┐                   │
│           │  Sheets API v4  │                   │
│           └────────┬────────┘                   │
└────────────────────┼────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │   Google Sheets         │
        │   Spreadsheet ID:       │
        │   1ZQtYfDHBiLPEFBUV4OR  │
        │   -3_q81oHKbg6MrWyNP-  │
        │   RCJnY                 │
        │                         │
        │   Tabs:                 │
        │   - Transactions (175)  │
        │   - Budget              │
        │   - Commitments         │
        │   - Vendor Contracts    │
        │   - Config              │
        └─────────────────────────┘
```

## Data Flow

### Read (on load / refresh)
1. App loads → checks for API_KEY constant
2. If API_KEY present: fetch all 5 sheets via `GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}?key={API_KEY}`
3. If fetch fails or no API_KEY: load from `FALLBACK_DATA` constant
4. Parse rows → populate `appState` object
5. Render active tab

### Write (on edit / add)
1. User edits cell or submits "Add Transaction" modal
2. App checks if OAuth token exists (user signed in)
3. If signed in: `PUT` to Sheets API to update specific range
4. Update local `appState` immediately (optimistic update)
5. Re-render affected tab
6. If not signed in: show "read-only" banner, update local state only

### Audience Filter
- **Full View** (Russell): all data visible
- **CFO View** (Brian): hides individual salary line items, shows only category totals for headcount, no contractor names
- **Team View** (Marketing): hides all headcount/compensation data entirely, shows only Programs + T&E

## Tab Architecture

Each tab has a `render` function that reads from `appState` and rebuilds the DOM:

| Tab | Render Function | Charts | Editable |
|-----|----------------|--------|----------|
| Dashboard | `renderDashboard()` | Waterfall, Doughnut, Line | No |
| Calendar | `renderCalendarTab()` | None | Yes (cells) |
| Transactions | `renderTransactionsTab()` | None | Yes (inline + modal) |
| Scenario | `renderScenarioTab()` | None | Input only |
| CFO Recon | `renderCFOTab()` | Bridge bar | No |
| Savings | `renderSavingsTab()` | Bar chart | No |

## State Management

All state lives in a single `appState` object:

```javascript
const appState = {
    transactions: [],        // from Transactions sheet
    budget: [],             // from Budget sheet
    commitments: [],        // from Commitments sheet
    vendorContracts: [],    // from Vendor Contracts sheet
    config: {},             // from Config sheet (key-value)
    activeTab: 'dashboard',
    audienceFilter: 'full', // 'full' | 'cfo' | 'team'
    darkMode: false,
    isSignedIn: false,
    accessToken: null,
    charts: {}              // Chart.js instances (for destroy/recreate)
};
```

## API Endpoints Used

### Google Sheets API v4
- `GET /v4/spreadsheets/{id}/values/{range}` — read data
- `PUT /v4/spreadsheets/{id}/values/{range}` — update cells
- `POST /v4/spreadsheets/{id}/values/{range}:append` — add rows

### Google Identity Services
- `google.accounts.oauth2.initTokenClient()` — OAuth flow
- Scope: `https://www.googleapis.com/auth/spreadsheets`

## Deployment

GitHub Pages serves `index.html` from root of main branch. No build step required.

For OAuth to work on GitHub Pages:
1. Add the GitHub Pages URL as an authorized JavaScript origin in Google Cloud Console
2. Add it as an authorized redirect URI
