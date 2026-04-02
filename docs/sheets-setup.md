# Google Sheets API Setup

## Prerequisites

1. A Google Cloud project with billing enabled
2. Google Sheets API v4 enabled
3. The budget tracker spreadsheet shared appropriately

## Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Name it something like "Class Budget Tracker"

## Step 2: Enable Google Sheets API

1. Go to APIs & Services > Library
2. Search for "Google Sheets API"
3. Click Enable

## Step 3: Create API Key (for read-only access)

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "API Key"
3. Copy the API key
4. **Restrict the key**:
   - Application restriction: HTTP referrers
   - Add your GitHub Pages URL (e.g., `https://russellteter.github.io/class-budget-tracker/*`)
   - Add `http://localhost:*` for local dev
   - API restriction: Google Sheets API only

## Step 4: Create OAuth 2.0 Client ID (for write access)

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: Web application
4. Name: "Budget Tracker"
5. Authorized JavaScript origins:
   - `https://russellteter.github.io`
   - `http://localhost:8000` (for local dev)
6. Authorized redirect URIs:
   - `https://russellteter.github.io/class-budget-tracker/`
   - `http://localhost:8000/`
7. Copy the Client ID

## Step 5: Configure OAuth Consent Screen

1. Go to APIs & Services > OAuth consent screen
2. User type: External (or Internal if using Google Workspace)
3. App name: "Class Budget Tracker"
4. Scopes: `https://www.googleapis.com/auth/spreadsheets`
5. Add test users (russell.teter@classedu.com)

## Step 6: Update index.html

Replace the placeholder constants at the top of the script:

```javascript
const API_KEY = 'AIza...your-api-key...';
const CLIENT_ID = 'xxxx...your-client-id....apps.googleusercontent.com';
```

## Step 7: Share the Spreadsheet

The spreadsheet needs to be readable:
- For API key access: Share with "Anyone with the link" as Viewer
- For OAuth access: Share with russell.teter@classedu.com as Editor

Spreadsheet ID: `1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY`

## API Usage

### Reading Data (API Key)
```
GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{RANGE}?key={API_KEY}
```

### Writing Data (OAuth Token)
```
PUT https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{RANGE}
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "range": "Transactions!A176:O176",
  "majorDimension": "ROWS",
  "values": [["03/31/2026", "New Vendor", "1000", ...]]
}
```

### Appending Rows (OAuth Token)
```
POST https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{RANGE}:append?valueInputOption=USER_ENTERED
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "range": "Transactions!A:O",
  "majorDimension": "ROWS",
  "values": [["04/01/2026", "New Vendor", "5000", ...]]
}
```

## Troubleshooting

- **403 Forbidden**: API key not authorized, or spreadsheet not shared
- **401 Unauthorized**: OAuth token expired, re-authenticate
- **CORS errors**: Make sure JavaScript origins are correctly configured
- **Quota exceeded**: Sheets API has 300 requests per minute per project (plenty for this app)

## Local Development

```bash
# Serve locally (OAuth requires an HTTP origin)
cd class-budget-tracker
python3 -m http.server 8000
# Open http://localhost:8000
```
