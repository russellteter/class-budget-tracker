/* ============================================================
   CLASS 2026 MARKETING BUDGET TRACKER — APPLICATION v3
   Excel-style editing, 3-level calendar zoom, SW portfolio manager
   ============================================================ */
'use strict';

// ============================================================
// 1. CONFIGURATION
// ============================================================
const CONFIG = {
    SPREADSHEET_ID: '1ZQtYfDHBiLPEFBUV4OR-3_q81oHKbg6MrWyNP-RCJnY',
    CLIENT_ID: '1068018362027-1jmc2pq0ttv5tabrplgqscp7o7vqg0oi.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    API_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',
    SHEET_RANGES: ['Transactions!A:O', 'Budget!A:N', 'Commitments!A:H', 'Vendor Contracts!A:H', 'Config!A:B'],
    MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    QUARTERS: { Q1: ['Jan', 'Feb', 'Mar'], Q2: ['Apr', 'May', 'Jun'], Q3: ['Jul', 'Aug', 'Sep'], Q4: ['Oct', 'Nov', 'Dec'] },
    BUDGET: { headcount: 336000, programs: 90000, te: 20000, total: 446914 },
    GL_MAP: {
        '6101': { cat: 'Headcount', sub: 'Salary' },
        '6102': { cat: 'Headcount', sub: 'Bonus' },
        '6103': { cat: 'Headcount', sub: 'Payroll Tax' },
        '6104': { cat: 'Headcount', sub: 'Benefits' },
        '6105': { cat: 'Headcount', sub: 'Commissions' },
        '6202': { cat: 'T&E', sub: 'Lodging' },
        '6303': { cat: 'Outside Envelope', sub: 'Software Subscriptions' },
        '6309': { cat: 'Outside Envelope', sub: 'Prepaid' },
        '6402': { cat: 'Programs', sub: 'Consulting' },
        '6405': { cat: 'Programs', sub: 'Conferences/Events' },
        '6406': { cat: 'Programs', sub: 'Advertising' }
    }
};

// ============================================================
// 2. APPLICATION STATE
// ============================================================
const appState = {
    transactions: [],
    budget: [],
    commitments: [],
    vendorContracts: [],
    config: {},
    computed: {
        ytdActual: { total: 0, headcount: 0, programs: 0, te: 0, outside: 0 },
        forecast: { total: 0, headcount: 0, programs: 0, te: 0 },
        available: { total: 0, headcount: 0, programs: 0, te: 0 },
        programsWaterfall: { budget: 90000, spent: 0, outstanding: 0, committed: 0, available: 0 },
        byMonth: {},
        byCategory: {},
        byVendor: {},
        byGL: {},
        outstandingItems: []
    },
    activeTab: 'dashboard',
    audienceFilter: 'full',
    theme: '',
    calendarGrouping: 'category',
    isSignedIn: false,
    accessToken: null,
    userEmail: null,
    tokenClient: null,
    lastSynced: null,
    isSyncing: false,
    charts: {},
    presentationMode: false,
    txFilters: { search: '', category: '', quarter: '', status: '' },
    txSort: { col: null, dir: 'asc' },
    scenarioInput: { amount: 0, category: 'Programs', quarter: 'Q2', description: '' },
    // v3: Inline editing
    inlineEdit: { active: false, rowId: null, field: null, originalValue: null, element: null },
    // v3: Calendar zoom
    calendarZoom: 'annual',
    calendarQuarter: null,
    calendarMonth: null,
    calendarCollapsed: {},
    // v3: Software modeling
    swModeling: { proposals: {}, showProposed: true }
};

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
function fmt(n) {
    if (n == null || isNaN(n)) return '$0.00';
    const abs = Math.abs(n);
    const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? '-' + str : str;
}
function fmtWhole(n) {
    if (n == null || isNaN(n)) return '$0';
    const abs = Math.abs(n);
    const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n < 0 ? '-' + str : str;
}
function fmtPct(n) {
    if (n == null || isNaN(n)) return '0.0%';
    return (n * 100).toFixed(1) + '%';
}
function parseNum(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    return parseFloat(String(v).replace(/[$,]/g, '')) || 0;
}
function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}
function monthIdx(m) { return CONFIG.MONTHS.indexOf(m); }
function quarterOf(m) {
    const i = monthIdx(m);
    if (i < 3) return 'Q1'; if (i < 6) return 'Q2'; if (i < 9) return 'Q3'; return 'Q4';
}
function getCurrentMonth() { return CONFIG.MONTHS[new Date().getMonth()]; }
function getCurrentMonthIdx() { return new Date().getMonth(); }
function isActualPeriod(month, year) {
    const now = new Date(); const curYear = now.getFullYear(); const curMonth = now.getMonth();
    const y = parseInt(year) || 2026; const m = monthIdx(month);
    if (y < curYear) return true; if (y > curYear) return false;
    return m <= curMonth;
}
function amountClass(n) { return n < 0 ? 'amount-negative' : 'amount-positive'; }
function progressColor(pct) { if (pct >= 0.9) return 'red'; if (pct >= 0.75) return 'amber'; return 'green'; }
function pctClass(pct) { if (pct > 0.95) return 'cal-pct-red'; if (pct > 0.8) return 'cal-pct-amber'; return 'cal-pct-green'; }
function categoryPill(cat) {
    const map = { 'Headcount': 'pill-headcount', 'Programs': 'pill-programs', 'T&E': 'pill-te', 'Outside Envelope': 'pill-outside' };
    return `<span class="pill ${map[cat] || 'pill-outside'}">${esc(cat)}</span>`;
}
function statusPill(status) {
    return status === 'Outstanding' ? '<span class="pill pill-outstanding">Outstanding</span>' : '<span class="pill pill-actual">Actual</span>';
}
function statusBadge(status) {
    const map = { 'Renewed': 'status-renewed', 'Ending': 'status-ending', 'Eliminated': 'status-eliminated', 'Negotiating': 'status-negotiating' };
    return `<span class="status-badge ${map[status] || ''}">${esc(status)}</span>`;
}
function debounce(fn, ms) { let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); }; }
function timeAgo(date) {
    if (!date) return 'Never';
    const diff = Date.now() - date.getTime(); const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now'; if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60); if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
}

// ============================================================
// 4. TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="toast-icon"></i><span class="toast-message">${esc(message)}</span><button class="toast-dismiss" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 200); }, duration);
}

// ============================================================
// 5. GOOGLE AUTHENTICATION
// ============================================================
function initAuth() {
    if (typeof google === 'undefined' || !google.accounts) { setTimeout(initAuth, 500); return; }
    appState.tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.CLIENT_ID, scope: CONFIG.SCOPES, callback: handleAuthResponse });
}
function handleAuthResponse(resp) {
    if (resp.error) { showToast('Sign in failed: ' + resp.error, 'error'); return; }
    appState.accessToken = resp.access_token; appState.isSignedIn = true; updateAuthUI(); fetchAllSheets();
}
function signIn() { if (!appState.tokenClient) { showToast('Auth not ready', 'warning'); return; } appState.tokenClient.requestAccessToken(); }
function signOut() {
    if (appState.accessToken) google.accounts.oauth2.revoke(appState.accessToken);
    appState.accessToken = null; appState.isSignedIn = false; appState.userEmail = null;
    updateAuthUI(); showToast('Signed out', 'info');
}
function updateAuthUI() {
    const signInBtn = document.getElementById('signInBtn'); const userInfo = document.getElementById('userInfo');
    if (appState.isSignedIn) { signInBtn.style.display = 'none'; userInfo.style.display = 'flex'; fetchUserEmail(); }
    else { signInBtn.style.display = 'inline-flex'; userInfo.style.display = 'none'; document.getElementById('userEmail').textContent = ''; }
}
async function fetchUserEmail() {
    if (!appState.accessToken) return;
    try { const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + appState.accessToken } }); const d = await r.json(); appState.userEmail = d.email; document.getElementById('userEmail').textContent = d.email; } catch (e) {}
}

// ============================================================
// 6. GOOGLE SHEETS API
// ============================================================
async function fetchAllSheets() {
    if (!appState.accessToken) { loadFallbackData(); return; }
    appState.isSyncing = true; updateFreshness();
    const refreshBtn = document.getElementById('refreshBtn'); refreshBtn.classList.add('spinning');
    try {
        const ranges = CONFIG.SHEET_RANGES.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
        const resp = await fetch(`${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values:batchGet?${ranges}`, { headers: { Authorization: 'Bearer ' + appState.accessToken } });
        if (!resp.ok) throw new Error('Sheets API error: ' + resp.status);
        const data = await resp.json(); const rd = data.valueRanges || [];
        parseTransactions(rd[0]?.values || []); parseBudget(rd[1]?.values || []);
        parseCommitments(rd[2]?.values || []); parseVendorContracts(rd[3]?.values || []);
        parseConfig(rd[4]?.values || []);
        appState.lastSynced = new Date(); recompute(); renderActiveTab();
        showToast('Data loaded from Google Sheets', 'success');
    } catch (err) { console.error(err); showToast('Failed to load from Sheets. Using fallback.', 'warning'); loadFallbackData(); }
    finally { appState.isSyncing = false; refreshBtn.classList.remove('spinning'); updateFreshness(); }
}
async function writeToSheets(range, values) {
    if (!appState.accessToken) { showToast('Sign in to save', 'warning'); return false; }
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
            method: 'PUT', headers: { Authorization: 'Bearer ' + appState.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range, majorDimension: 'ROWS', values })
        });
        if (!resp.ok) throw new Error('Write failed: ' + resp.status);
        showToast('Saved', 'success', 2000); return true;
    } catch (err) { console.error(err); showToast('Save failed: ' + err.message, 'error'); return false; }
}
async function appendToSheets(range, values) {
    if (!appState.accessToken) { showToast('Sign in to save', 'warning'); return false; }
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
            method: 'POST', headers: { Authorization: 'Bearer ' + appState.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range, majorDimension: 'ROWS', values })
        });
        if (!resp.ok) throw new Error('Append failed: ' + resp.status);
        showToast('Added', 'success', 2000); return true;
    } catch (err) { console.error(err); showToast('Add failed: ' + err.message, 'error'); return false; }
}

// ============================================================
// 7. DATA PARSERS
// ============================================================
function parseTransactions(rows) {
    if (!rows || rows.length < 2) return;
    appState.transactions = rows.slice(1).map((r, i) => ({
        _row: i + 2, date: r[0] || '', vendor: r[1] || '', amount: parseNum(r[2]),
        gl: r[3] || '', glName: r[4] || '', department: r[5] || '', memo: r[6] || '',
        category: r[7] || '', subcategory: r[8] || '', month: r[9] || '', quarter: r[10] || '',
        year: parseInt(r[11]) || 2026, status: r[12] || 'Actual',
        isCarryover: (r[13] || '').toLowerCase() === 'yes', employeeType: r[14] || ''
    })).filter(t => t.amount !== 0 || t.vendor);
}
function parseBudget(rows) {
    if (!rows || rows.length < 2) return;
    appState.budget = rows.slice(1).map(r => ({
        category: r[0] || '', annual: parseNum(r[1]),
        months: CONFIG.MONTHS.reduce((o, m, i) => { o[m] = parseNum(r[i + 2]); return o; }, {})
    })).filter(b => b.category && b.category !== 'Notes');
}
function parseCommitments(rows) {
    if (!rows || rows.length < 2) return;
    appState.commitments = rows.slice(1).map(r => ({
        vendor: r[0] || '', monthly: parseNum(r[1]), category: r[2] || '', gl: r[3] || '',
        startMonth: r[4] || '', endMonth: r[5] || '', status: r[6] || 'Active', notes: r[7] || ''
    })).filter(c => c.vendor);
}
function parseVendorContracts(rows) {
    if (!rows || rows.length < 2) return;
    appState.vendorContracts = rows.slice(1).map(r => ({
        vendor: r[0] || '', before: parseNum(r[1]), after: parseNum(r[2]), savings: parseNum(r[3]),
        savingsPct: r[4] || '', category: r[5] || '', status: r[6] || '', notes: r[7] || '',
        contractEnd: '', renegDate: null, newTargetAnnual: null
    })).filter(v => v.vendor);
}
function parseConfig(rows) {
    if (!rows || rows.length < 1) return;
    appState.config = {}; rows.forEach(r => { if (r[0]) appState.config[r[0]] = r[1] || ''; });
}

// ============================================================
// 8. FALLBACK DATA
// ============================================================
function loadFallbackData() {
    const txn = (date, vendor, amount, gl, glName, dept, memo, cat, sub, month, qtr, year, status, carry, empType) =>
        ({ _row: 0, date, vendor, amount, gl, glName, department: dept, memo, category: cat, subcategory: sub, month, quarter: qtr, year, status: status || 'Actual', isCarryover: carry || false, employeeType: empType || '' });
    const hc = (m, q, y, carry) => [
        txn('', 'Kendall Woodard', 4583.33, '6101', 'Salary', '404-Creative & Brand', 'Payroll', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'FTE'),
        txn('', 'Dalton Mullins', y === 2025 ? 7500 : 2083.33, '6101', 'Salary', '408-SDRs', 'Payroll', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'FTE'),
        txn('', 'Roxana Nabavian', 5000, '6101', 'Salary', '403-Mktg Ops', 'Contractor', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'Contractor'),
        txn('', 'Kate Bertram', 2800, '6101', 'Salary', '404-Creative & Brand', 'PT Contractor', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'Contractor'),
        txn('', 'Payroll Tax', y === 2025 ? 2780 : 2016.67, '6103', 'Payroll Tax', '400-Marketing', 'Tax', 'Headcount', 'Payroll Tax', m, q, y, 'Actual', carry, ''),
        txn('', 'Benefits', 3200, '6104', 'Benefits', '400-Marketing', 'Benefits', 'Headcount', 'Benefits', m, q, y, 'Actual', carry, ''),
    ];
    const q4_2025 = [
        ...hc('Oct', 'Q4', 2025), ...hc('Nov', 'Q4', 2025), ...hc('Dec', 'Q4', 2025),
        txn('10/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('10/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('10/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('10/25/2025', 'Docebo Conference', 5200, '6405', 'Conferences/Events', '401-Education Marketing', 'Annual conference', 'Programs', 'Conferences/Events', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('10/01/2025', 'Training Magazine', 12000, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Conference', 'Programs', 'Conferences/Events', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('11/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Nov', 'Q4', 2025, 'Actual', true),
        txn('11/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('11/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('11/20/2025', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('11/05/2025', 'Docebo RKO', 9328, '6405', 'Conferences/Events', '401-Education Marketing', 'Sponsorship', 'Programs', 'Conferences/Events', 'Nov', 'Q4', 2025, 'Actual', true),
        txn('12/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Dec', 'Q4', 2025, 'Actual', true),
        txn('12/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('12/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('12/20/2025', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('12/10/2025', 'Docebo RKO', 26500, '6405', 'Conferences/Events', '401-Education Marketing', 'Sponsorship', 'Programs', 'Conferences/Events', 'Dec', 'Q4', 2025, 'Actual', true),
        txn('12/18/2025', 'Training Magazine', 8500, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Webinar', 'Programs', 'Conferences/Events', 'Dec', 'Q4', 2025, 'Actual', true),
        // Outside envelope Q4
        txn('10/01/2025', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Oct', 'Q4', 2025),
        txn('10/01/2025', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Oct', 'Q4', 2025),
        txn('11/01/2025', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Nov', 'Q4', 2025),
        txn('11/01/2025', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Nov', 'Q4', 2025),
        txn('12/01/2025', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Dec', 'Q4', 2025),
        txn('12/01/2025', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Dec', 'Q4', 2025),
    ];
    const q1_2026 = [
        ...hc('Jan', 'Q1', 2026), ...hc('Feb', 'Q1', 2026), ...hc('Mar', 'Q1', 2026),
        txn('01/08/2026', 'Training Magazine', 8744, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Conference', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('01/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/20/2026', 'Paperclip Promotions', 829, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/22/2026', 'EMEA Reseller Offsite', 6919, '6405', 'Conferences/Events', '402-Corp Marketing', 'Reseller event', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('02/04/2026', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Feb', 'Q1', 2026),
        txn('02/19/2026', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Feb', 'Q1', 2026),
        txn('02/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('02/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('02/20/2026', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('03/05/2026', 'Sponge Software', 7700, '6402', 'Consulting', '400-Marketing', 'Final month MOPS', 'Programs', 'Consulting', 'Mar', 'Q1', 2026, 'Outstanding'),
        txn('03/11/2026', 'Training Magazine', 9000, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Webinar sponsorship', 'Programs', 'Conferences/Events', 'Mar', 'Q1', 2026),
        txn('03/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('03/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('03/20/2026', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('02/12/2026', 'Hotel - Sales Kickoff', 1200, '6202', 'Lodging', '400-Marketing', 'Team travel', 'T&E', 'Lodging', 'Feb', 'Q1', 2026),
        txn('03/18/2026', 'Hotel - Conference', 800, '6202', 'Lodging', '401-Education Marketing', 'Event travel', 'T&E', 'Lodging', 'Mar', 'Q1', 2026),
        txn('01/01/2026', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('01/01/2026', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('01/01/2026', 'Salesforce', 4372.58, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/01/2026', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('02/01/2026', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('02/01/2026', 'Salesforce', 4372.58, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/01/2026', 'Pantheon', 1452.17, '6303', 'Software Subscriptions', '400-Marketing', 'Website CMS', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('03/01/2026', 'HubSpot', 1333.33, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing automation', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('03/01/2026', 'Salesforce', 4372.58, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
    ];
    appState.transactions = [...q4_2025, ...q1_2026];
    appState.budget = [
        { category: 'Headcount', annual: 336000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 28000; return o; }, {}) },
        { category: 'Programs', annual: 90000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 7500; return o; }, {}) },
        { category: 'T&E', annual: 20000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 1666.67; return o; }, {}) },
        { category: 'Outside Envelope', annual: 0, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 0; return o; }, {}) },
        { category: 'TOTAL', annual: 446914, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 37166.67; return o; }, {}) },
    ];
    appState.commitments = [
        { vendor: 'LinkedIn Ads', monthly: 950, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Monthly digital ads' },
        { vendor: 'Google Ads', monthly: 850, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Monthly search ads' },
        { vendor: 'Paperclip Promotions', monthly: 300, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Promo items' },
        { vendor: 'Kendall Woodard', monthly: 4583.33, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'FTE' },
        { vendor: 'Dalton Mullins', monthly: 2083.33, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'FTE reduced' },
        { vendor: 'Roxana Nabavian', monthly: 5000, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Contractor' },
        { vendor: 'Kate Bertram', monthly: 2800, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'PT Contractor' },
        { vendor: 'Payroll Tax', monthly: 2016.67, category: 'Headcount', gl: '6103', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: '' },
        { vendor: 'Benefits', monthly: 3200, category: 'Headcount', gl: '6104', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: '' },
    ];
    appState.vendorContracts = [
        { vendor: 'Salesforce', before: 93600, after: 52471, savings: 41129, savingsPct: '43.9%', category: 'CRM', status: 'Renewed', notes: 'Renegotiated Q4 2025', contractEnd: '2026-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'ZoomInfo', before: 63000, after: 15200, savings: 47800, savingsPct: '75.9%', category: 'Data', status: 'Renewed', notes: 'Reduced seats', contractEnd: '2026-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Sponge Software', before: 78000, after: 7700, savings: 70300, savingsPct: '90.1%', category: 'Agency', status: 'Ending', notes: 'Final month Mar 2026', contractEnd: '2026-03-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'HubSpot', before: 24000, after: 16000, savings: 8000, savingsPct: '33.2%', category: 'Marketing Automation', status: 'Renewed', notes: 'Downgraded plan', contractEnd: '2026-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Outreach', before: 51600, after: 25200, savings: 26400, savingsPct: '51.2%', category: 'Sales Engagement', status: 'Renewed', notes: 'Reduced seats', contractEnd: '2026-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Wrike', before: 17600, after: 0, savings: 17600, savingsPct: '100%', category: 'PM Tool', status: 'Eliminated', notes: 'Migrated', contractEnd: '2025-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Bynder', before: 11800, after: 0, savings: 11800, savingsPct: '100%', category: 'DAM', status: 'Eliminated', notes: 'No longer needed', contractEnd: '2025-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'LinkedIn Sales Nav', before: 39900, after: 0, savings: 39900, savingsPct: '100%', category: 'Sales Tool', status: 'Eliminated', notes: 'Consolidated', contractEnd: '2025-12-31', renegDate: null, newTargetAnnual: null },
    ];
    appState.config = {
        total_budget: '446914', headcount_budget: '336000', programs_budget: '90000', te_budget: '20000',
        company_sw_budget: '871560', marketing_sw_savings: '213623', sw_savings_pct: '24.5%',
        brian_q1_marketing_programs: '85309', pantheon_reclassification: '17426', brian_adjusted_q1: '67883',
        brian_full_year_forecast: '317309', fiscal_year: '2026', budget_basis: 'salary_only_pending_clarification',
        kate_bertram_type: 'PT Contractor - no loaded-cost', sponge_outstanding: '7700',
        q4_carryover_total: '89225.50', netsuite_last_refresh: '2026-03-31'
    };
    appState.lastSynced = new Date(); recompute(); renderActiveTab();
}

// ============================================================
// 9. COMPUTATION ENGINE
// ============================================================
function recompute() {
    const tx2026 = appState.transactions.filter(t => t.year === 2026);
    const curMonthIdx = getCurrentMonthIdx();
    const actuals = tx2026.filter(t => t.status === 'Actual');
    const c = appState.computed;
    c.ytdActual = { total: 0, headcount: 0, programs: 0, te: 0, outside: 0 };
    actuals.forEach(t => {
        if (t.category === 'Headcount') c.ytdActual.headcount += t.amount;
        else if (t.category === 'Programs') c.ytdActual.programs += t.amount;
        else if (t.category === 'T&E') c.ytdActual.te += t.amount;
        else if (t.category === 'Outside Envelope') c.ytdActual.outside += t.amount;
    });
    c.ytdActual.total = c.ytdActual.headcount + c.ytdActual.programs + c.ytdActual.te;
    const outstanding = tx2026.filter(t => t.status === 'Outstanding');
    let outstandingPrograms = 0, outstandingTE = 0, outstandingHC = 0;
    outstanding.forEach(t => {
        if (t.category === 'Programs') outstandingPrograms += t.amount;
        else if (t.category === 'T&E') outstandingTE += t.amount;
        else if (t.category === 'Headcount') outstandingHC += t.amount;
    });
    c.outstandingItems = outstanding;
    c.forecast = { total: 0, headcount: 0, programs: 0, te: 0 };
    appState.commitments.forEach(cm => {
        if (cm.status !== 'Active') return;
        const start = Math.max(monthIdx(cm.startMonth), curMonthIdx + 1);
        const end = monthIdx(cm.endMonth);
        if (start > end) return;
        const total = cm.monthly * (end - start + 1);
        if (cm.category === 'Headcount') c.forecast.headcount += total;
        else if (cm.category === 'Programs') c.forecast.programs += total;
        else if (cm.category === 'T&E') c.forecast.te += total;
    });
    c.forecast.total = c.forecast.headcount + c.forecast.programs + c.forecast.te;
    c.available = {
        headcount: CONFIG.BUDGET.headcount - c.ytdActual.headcount - outstandingHC - c.forecast.headcount,
        programs: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs,
        te: CONFIG.BUDGET.te - c.ytdActual.te - outstandingTE - c.forecast.te, total: 0
    };
    c.available.total = c.available.headcount + c.available.programs + c.available.te;
    c.programsWaterfall = {
        budget: CONFIG.BUDGET.programs, spent: c.ytdActual.programs, outstanding: outstandingPrograms,
        committed: c.forecast.programs,
        available: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs
    };
    c.byMonth = {};
    CONFIG.MONTHS.forEach(m => { c.byMonth[m] = { headcount: 0, programs: 0, te: 0, outside: 0, total: 0 }; });
    tx2026.forEach(t => {
        if (!c.byMonth[t.month]) return;
        const cat = t.category === 'Headcount' ? 'headcount' : t.category === 'Programs' ? 'programs' : t.category === 'T&E' ? 'te' : 'outside';
        c.byMonth[t.month][cat] += t.amount;
        if (cat !== 'outside') c.byMonth[t.month].total += t.amount;
    });
    c.byCategory = {}; c.byVendor = {}; c.byGL = {};
    appState.transactions.forEach(t => {
        if (!c.byCategory[t.category]) c.byCategory[t.category] = {};
        const vk = t.vendor || 'Other';
        if (!c.byCategory[t.category][vk]) c.byCategory[t.category][vk] = [];
        c.byCategory[t.category][vk].push(t);
        if (!c.byVendor[vk]) c.byVendor[vk] = [];
        c.byVendor[vk].push(t);
        const glk = t.gl + ' - ' + t.glName;
        if (!c.byGL[glk]) c.byGL[glk] = [];
        c.byGL[glk].push(t);
    });
}

// ============================================================
// 10. AUDIENCE FILTERING
// ============================================================
function getFilteredTransactions() {
    if (appState.audienceFilter === 'full') return appState.transactions;
    if (appState.audienceFilter === 'team') return appState.transactions.filter(t => t.category !== 'Headcount');
    return appState.transactions;
}
function getFilteredBudget() {
    if (appState.audienceFilter === 'full') return appState.budget;
    if (appState.audienceFilter === 'team') return appState.budget.filter(b => b.category !== 'Headcount' && b.category !== 'TOTAL');
    return appState.budget;
}
function isHeadcountVisible() { return appState.audienceFilter !== 'team'; }
function shouldShowIndividualHC() { return appState.audienceFilter === 'full'; }

// ============================================================
// 11. TAB ROUTING
// ============================================================
function switchTab(tab) {
    appState.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
    renderActiveTab();
}
function renderActiveTab() {
    const renderers = { dashboard: renderDashboard, calendar: renderCalendar, transactions: renderTransactions, scenario: renderScenario, reconciliation: renderReconciliation, savings: renderSavings };
    const fn = renderers[appState.activeTab];
    if (fn) fn();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================================
// 12. THEME / PRESENTATION / FRESHNESS
// ============================================================
function cycleTheme() {
    const themes = ['', 'dark', 'high-contrast'];
    appState.theme = themes[(themes.indexOf(appState.theme) + 1) % themes.length];
    document.documentElement.setAttribute('data-theme', appState.theme);
    const icon = document.querySelector('#themeToggle i');
    if (icon) { icon.setAttribute('data-lucide', appState.theme === 'dark' ? 'moon' : appState.theme === 'high-contrast' ? 'contrast' : 'sun'); if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [icon.parentElement] }); }
    renderActiveTab();
}
function togglePresentation() {
    appState.presentationMode = !appState.presentationMode;
    document.body.classList.toggle('presentation-mode', appState.presentationMode);
    renderActiveTab();
}
function updateFreshness() {
    const dot = document.getElementById('freshnessDot'), text = document.getElementById('freshnessText');
    if (appState.isSyncing) { dot.className = 'freshness-dot fresh'; text.textContent = 'Syncing...'; return; }
    if (!appState.lastSynced) { dot.className = 'freshness-dot'; text.textContent = 'Not synced'; return; }
    const mins = Math.floor((Date.now() - appState.lastSynced.getTime()) / 60000);
    if (mins < 1) { dot.className = 'freshness-dot fresh'; text.textContent = 'Synced just now'; }
    else if (mins < 30) { dot.className = 'freshness-dot fresh'; text.textContent = 'Synced ' + mins + 'm ago'; }
    else if (mins < 120) { dot.className = 'freshness-dot stale'; text.textContent = 'Synced ' + Math.floor(mins / 60) + 'h ago'; }
    else { dot.className = 'freshness-dot error'; text.textContent = 'Stale'; }
}

// ============================================================
// 13. DRILL-DOWN PANEL
// ============================================================
function showDrillDown(transactions, title) {
    const overlay = document.getElementById('drilldownOverlay');
    document.getElementById('drilldownTitle').textContent = title;
    const sum = transactions.reduce((s, t) => s + t.amount, 0);
    document.getElementById('drilldownCount').textContent = transactions.length + ' txn' + (transactions.length !== 1 ? 's' : '');
    document.getElementById('drilldownTotal').textContent = fmt(sum);
    let html = '<table><thead><tr><th>Date</th><th>Vendor</th><th class="num">Amount</th><th>Category</th><th>Status</th></tr></thead><tbody>';
    transactions.forEach(t => {
        html += `<tr><td>${esc(t.date)}</td><td>${esc(t.vendor)}</td><td class="num ${amountClass(t.amount)}">${fmt(t.amount)}</td><td>${categoryPill(t.category)}</td><td>${statusPill(t.status)}</td></tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('drilldownBody').innerHTML = html;
    overlay.classList.add('active');
}
function closeDrillDown() { document.getElementById('drilldownOverlay').classList.remove('active'); }

// ============================================================
// 14. INLINE CELL EDITING ENGINE
// ============================================================
function startCellEdit(td, rowId, field, collection) {
    if (appState.presentationMode) return;
    if (appState.inlineEdit.active) commitCellEdit();
    collection = collection || 'transactions';
    const items = collection === 'vendors' ? appState.vendorContracts : appState.transactions;
    const item = collection === 'vendors' ? items.find((v, i) => i === rowId) : items.find(t => t._row === rowId);
    if (!item) return;
    const rawValue = item[field];
    appState.inlineEdit = { active: true, rowId, field, originalValue: rawValue, element: td, collection };
    td.classList.add('cell-editing');
    if (td.parentElement) td.parentElement.classList.add('editing-row');
    let input;
    if (field === 'status') {
        input = document.createElement('select');
        input.className = 'cell-editor';
        ['Actual', 'Outstanding'].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; if (rawValue === v) o.selected = true; input.appendChild(o); });
    } else if (field === 'gl') {
        input = document.createElement('select');
        input.className = 'cell-editor';
        Object.entries(CONFIG.GL_MAP).forEach(([code, info]) => { const o = document.createElement('option'); o.value = code; o.textContent = code + ' — ' + info.sub; if (rawValue === code) o.selected = true; input.appendChild(o); });
    } else if (field === 'amount' || field === 'before' || field === 'after' || field === 'newTargetAnnual') {
        input = document.createElement('input'); input.type = 'number'; input.step = '0.01';
        input.className = 'cell-editor num'; input.value = rawValue || '';
    } else if (field === 'renegDate' || field === 'contractEnd') {
        input = document.createElement('input'); input.type = 'date';
        input.className = 'cell-editor'; input.value = rawValue || '';
    } else {
        input = document.createElement('input'); input.type = 'text';
        input.className = 'cell-editor'; input.value = rawValue || '';
    }
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitCellEdit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelCellEdit(); }
        else if (e.key === 'Tab') { e.preventDefault(); commitCellEdit(); }
    });
    input.addEventListener('blur', () => { setTimeout(() => { if (appState.inlineEdit.active && appState.inlineEdit.element === td) commitCellEdit(); }, 100); });
}

function commitCellEdit() {
    const edit = appState.inlineEdit;
    if (!edit.active || !edit.element) return;
    const input = edit.element.querySelector('input, select');
    if (!input) { cancelCellEdit(); return; }
    const newValue = input.value;
    const coll = edit.collection || 'transactions';
    if (coll === 'vendors') {
        const vendor = appState.vendorContracts[edit.rowId];
        if (!vendor) { cancelCellEdit(); return; }
        if (edit.field === 'amount' || edit.field === 'before' || edit.field === 'after' || edit.field === 'newTargetAnnual') {
            vendor[edit.field] = parseFloat(newValue) || 0;
            if (edit.field === 'before' || edit.field === 'after') vendor.savings = vendor.before - vendor.after;
        } else if (edit.field === 'renegDate') {
            vendor.renegDate = newValue || null;
            if (!appState.swModeling.proposals[vendor.vendor]) appState.swModeling.proposals[vendor.vendor] = {};
            appState.swModeling.proposals[vendor.vendor].renegDate = newValue || null;
        } else if (edit.field === 'newTargetAnnual') {
            vendor.newTargetAnnual = parseFloat(newValue) || null;
            if (!appState.swModeling.proposals[vendor.vendor]) appState.swModeling.proposals[vendor.vendor] = {};
            appState.swModeling.proposals[vendor.vendor].newAnnual = parseFloat(newValue) || null;
        } else {
            vendor[edit.field] = newValue;
        }
    } else {
        const tx = appState.transactions.find(t => t._row === edit.rowId);
        if (!tx) { cancelCellEdit(); return; }
        if (edit.field === 'amount') tx.amount = parseFloat(newValue) || 0;
        else if (edit.field === 'gl') {
            tx.gl = newValue;
            const info = CONFIG.GL_MAP[newValue];
            if (info) { tx.category = info.cat; tx.subcategory = info.sub; tx.glName = info.sub; }
        } else if (edit.field === 'date') {
            tx.date = newValue;
            const d = new Date(newValue);
            if (!isNaN(d.getTime())) { tx.month = CONFIG.MONTHS[d.getMonth()]; tx.quarter = quarterOf(tx.month); tx.year = d.getFullYear(); }
        } else { tx[edit.field] = newValue; }
        const row = [tx.date, tx.vendor, tx.amount, tx.gl, tx.glName, tx.department, tx.memo, tx.category, tx.subcategory, tx.month, tx.quarter, tx.year, tx.status, tx.isCarryover ? 'Yes' : 'No', tx.employeeType];
        writeToSheets(`Transactions!A${tx._row}:O${tx._row}`, [row]);
    }
    edit.element.classList.remove('cell-editing');
    if (edit.element.parentElement) edit.element.parentElement.classList.remove('editing-row');
    appState.inlineEdit = { active: false, rowId: null, field: null, originalValue: null, element: null, collection: null };
    recompute();
    renderActiveTab();
}

function cancelCellEdit() {
    const edit = appState.inlineEdit;
    if (!edit.active || !edit.element) return;
    edit.element.classList.remove('cell-editing');
    if (edit.element.parentElement) edit.element.parentElement.classList.remove('editing-row');
    appState.inlineEdit = { active: false, rowId: null, field: null, originalValue: null, element: null, collection: null };
    renderActiveTab();
}

// Context menu for right-click delete
function showContextMenu(e, rowId) {
    e.preventDefault();
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.dataset.rowId = rowId;
}
function hideContextMenu() { document.getElementById('contextMenu').style.display = 'none'; }

// ============================================================
// 15. DASHBOARD TAB
// ============================================================
function renderDashboard() {
    const c = appState.computed;
    const el = document.getElementById('tab-dashboard');
    const showHC = isHeadcountVisible();
    const wf = c.programsWaterfall;
    const progPct = wf.budget > 0 ? (wf.budget - wf.available) / wf.budget : 0;
    const progAvailPct = wf.budget > 0 ? wf.available / wf.budget : 0;
    let html = '<div class="kpi-grid">';
    html += `<div class="kpi-card hero ${wf.available < 10000 ? 'warning' : 'positive'}"><div class="kpi-label">Programs Available</div><div class="kpi-value">${fmtWhole(wf.available)}</div><div class="kpi-progress"><div class="kpi-progress-bar ${progressColor(progPct)}" style="width:${Math.min(progPct * 100, 100)}%"></div></div><div class="kpi-subtext">${fmtPct(progAvailPct)} of ${fmtWhole(wf.budget)} remaining</div></div>`;
    html += `<div class="kpi-card"><div class="kpi-label">Total Budget</div><div class="kpi-value">${fmtWhole(CONFIG.BUDGET.total)}</div><div class="kpi-trend neutral">FY 2026</div></div>`;
    html += `<div class="kpi-card"><div class="kpi-label">YTD Actual</div><div class="kpi-value">${fmtWhole(c.ytdActual.total)}</div><div class="kpi-trend neutral">Through ${getCurrentMonth()}</div></div>`;
    const fullYear = c.ytdActual.total + c.forecast.total;
    const fcastPct = CONFIG.BUDGET.total > 0 ? fullYear / CONFIG.BUDGET.total : 0;
    html += `<div class="kpi-card ${fcastPct > 0.95 ? 'warning' : ''}"><div class="kpi-label">Full Year Forecast</div><div class="kpi-value">${fmtWhole(fullYear)}</div><div class="kpi-trend ${fcastPct > 1 ? 'negative' : fcastPct > 0.9 ? 'warning' : 'positive'}">${fmtPct(fcastPct)} of budget</div></div>`;
    if (showHC) {
        const hcPct = CONFIG.BUDGET.headcount > 0 ? c.ytdActual.headcount / CONFIG.BUDGET.headcount : 0;
        html += `<div class="kpi-card"><div class="kpi-label">Headcount</div><div class="kpi-value">${fmtWhole(c.ytdActual.headcount)}</div><div class="kpi-progress"><div class="kpi-progress-bar ${progressColor(hcPct)}" style="width:${Math.min(hcPct * 100, 100)}%"></div></div><div class="kpi-subtext">of ${fmtWhole(CONFIG.BUDGET.headcount)}</div></div>`;
    }
    html += '</div><div class="chart-grid">';
    html += `<div class="chart-card"><div class="chart-title">Programs Waterfall</div><div class="chart-wrapper"><canvas id="waterfallChart"></canvas></div></div>`;
    html += `<div class="chart-card"><div class="chart-title">Spend by Category</div><div class="chart-wrapper"><canvas id="categoryChart"></canvas></div></div>`;
    html += '</div><div class="chart-grid">';
    html += `<div class="chart-card"><div class="chart-title">Monthly Trend</div><div class="chart-wrapper"><canvas id="trendChart"></canvas></div></div>`;
    html += '<div class="chart-card"><div class="chart-title">Outstanding Items</div>';
    if (c.outstandingItems.length === 0) html += '<div class="empty-state"><p>No outstanding items</p></div>';
    else { html += '<table class="outstanding-table"><tbody>'; c.outstandingItems.forEach(t => { html += `<tr><td class="vendor-col">${esc(t.vendor)}</td><td class="amount-col">${fmt(t.amount)}</td><td class="month-col">${esc(t.month)} ${t.year}</td></tr>`; }); html += '</tbody></table>'; }
    html += '</div></div>';
    html += '<div class="section-card"><div class="section-title">Budget vs Actual</div>';
    const bars = [{ l: 'Headcount', a: c.ytdActual.headcount, b: CONFIG.BUDGET.headcount, s: showHC }, { l: 'Programs', a: c.ytdActual.programs, b: CONFIG.BUDGET.programs, s: true }, { l: 'T&E', a: c.ytdActual.te, b: CONFIG.BUDGET.te, s: true }];
    bars.forEach(bar => { if (!bar.s) return; const p = bar.b > 0 ? bar.a / bar.b : 0; html += `<div class="budget-progress-item"><div class="budget-progress-label">${bar.l}</div><div class="budget-progress-track"><div class="budget-progress-fill ${progressColor(p)}" style="width:${Math.min(p * 100, 100)}%"></div></div><div class="budget-progress-amount">${fmtWhole(bar.a)} / ${fmtWhole(bar.b)}</div></div>`; });
    html += '<div class="basis-note">Basis: salary-only (pending confirmation from Brian)</div></div>';
    el.innerHTML = html;
    renderDashboardCharts();
}

function renderDashboardCharts() {
    destroyChart('waterfall'); destroyChart('category'); destroyChart('trend');
    const c = appState.computed; const wf = c.programsWaterfall;
    const isDark = appState.theme === 'dark' || appState.theme === 'high-contrast';
    const textColor = isDark ? '#e7e9ea' : '#0A1849';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
    const fontOpts = { family: "'Inter', sans-serif", size: 10 };
    // Waterfall
    const wfCtx = document.getElementById('waterfallChart');
    if (wfCtx) {
        const afterSpent = wf.budget - wf.spent; const afterOut = afterSpent - wf.outstanding; const afterComm = afterOut - wf.committed;
        appState.charts.waterfall = new Chart(wfCtx, { type: 'bar', data: { labels: ['Budget', 'Spent', 'Outstanding', 'Committed', 'Available'], datasets: [{ data: [[0, wf.budget], [afterSpent, wf.budget], [afterOut, afterSpent], [afterComm, afterOut], [0, wf.available]], backgroundColor: ['rgba(71,57,231,0.8)', 'rgba(220,38,38,0.8)', 'rgba(217,119,6,0.8)', 'rgba(107,114,128,0.7)', 'rgba(5,150,105,0.8)'], borderRadius: 2, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(Math.abs(ctx.raw[1] - ctx.raw[0])) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } }, x: { ticks: { font: fontOpts, color: textColor }, grid: { display: false } } } } });
    }
    // Category Doughnut
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
        const showHC = isHeadcountVisible();
        const labels = showHC ? ['Headcount', 'Programs', 'T&E'] : ['Programs', 'T&E'];
        const data = showHC ? [c.ytdActual.headcount, c.ytdActual.programs, c.ytdActual.te] : [c.ytdActual.programs, c.ytdActual.te];
        const colors = showHC ? ['rgba(10,24,73,0.8)', 'rgba(71,57,231,0.8)', 'rgba(255,186,0,0.8)'] : ['rgba(71,57,231,0.8)', 'rgba(255,186,0,0.8)'];
        appState.charts.category = new Chart(catCtx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 3 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor, padding: 8 } }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmt(ctx.raw) } } } } });
    }
    // Monthly Trend
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        const curIdx = getCurrentMonthIdx(); const actualData = []; const forecastData = [];
        CONFIG.MONTHS.forEach((m, i) => {
            const val = c.byMonth[m] ? c.byMonth[m].total : 0;
            if (i <= curIdx && val > 0) { actualData.push(val); forecastData.push(null); }
            else if (i > curIdx) {
                actualData.push(null);
                let committed = 0;
                appState.commitments.forEach(cm => { if (cm.status !== 'Active' || cm.category === 'Outside Envelope') return; const si = monthIdx(cm.startMonth); const ei = monthIdx(cm.endMonth); if (i >= si && i <= ei) committed += cm.monthly; });
                forecastData.push(committed);
            } else { actualData.push(null); forecastData.push(null); }
        });
        if (curIdx >= 0 && curIdx < 11 && actualData[curIdx] != null) forecastData[curIdx] = actualData[curIdx];
        appState.charts.trend = new Chart(trendCtx, { type: 'line', data: { labels: CONFIG.MONTHS, datasets: [{ label: 'Actual', data: actualData, borderColor: 'rgba(71,57,231,1)', backgroundColor: 'rgba(71,57,231,0.08)', fill: true, tension: 0.3, pointRadius: 3, spanGaps: false }, { label: 'Forecast', data: forecastData, borderColor: 'rgba(107,114,128,0.5)', borderDash: [6, 4], backgroundColor: 'rgba(107,114,128,0.03)', fill: true, tension: 0.3, pointRadius: 2, spanGaps: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } }, x: { ticks: { font: fontOpts, color: textColor }, grid: { display: false } } } } });
    }
}
function destroyChart(name) { if (appState.charts[name]) { appState.charts[name].destroy(); appState.charts[name] = null; } }

// ============================================================
// 16. CALENDAR TAB — 3-LEVEL ZOOM
// ============================================================
function renderCalendar() {
    const el = document.getElementById('tab-calendar');
    let html = renderCalendarToolbar();
    switch (appState.calendarZoom) {
        case 'annual': html += renderCalendarAnnual(); break;
        case 'quarterly': html += renderCalendarQuarterly(); break;
        case 'monthly': html += renderCalendarMonthly(); break;
    }
    el.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCalendarToolbar() {
    const z = appState.calendarZoom;
    let bc = '<div class="calendar-breadcrumb">';
    if (z === 'annual') bc += '<span class="calendar-breadcrumb-current">Annual Overview</span>';
    else if (z === 'quarterly') {
        bc += `<span class="calendar-breadcrumb-item" onclick="calZoomTo('annual')">Annual</span><span class="calendar-breadcrumb-sep">&rsaquo;</span>`;
        bc += `<span class="calendar-breadcrumb-current">${appState.calendarQuarter} 2026</span>`;
    } else {
        bc += `<span class="calendar-breadcrumb-item" onclick="calZoomTo('annual')">Annual</span><span class="calendar-breadcrumb-sep">&rsaquo;</span>`;
        bc += `<span class="calendar-breadcrumb-item" onclick="calZoomTo('quarterly','${quarterOf(appState.calendarMonth)}')">${quarterOf(appState.calendarMonth)}</span><span class="calendar-breadcrumb-sep">&rsaquo;</span>`;
        bc += `<span class="calendar-breadcrumb-current">${appState.calendarMonth} 2026</span>`;
    }
    bc += '</div>';
    let html = '<div class="calendar-toolbar">';
    html += '<div class="flex items-center gap-8">' + bc;
    html += `<select class="filter-select" onchange="changeCalendarGrouping(this.value)"><option value="category" ${appState.calendarGrouping === 'category' ? 'selected' : ''}>Category</option><option value="vendor" ${appState.calendarGrouping === 'vendor' ? 'selected' : ''}>Vendor</option><option value="gl" ${appState.calendarGrouping === 'gl' ? 'selected' : ''}>GL Account</option></select>`;
    html += `<button class="btn btn-sm btn-secondary" onclick="calExpandAll()">Expand</button><button class="btn btn-sm btn-secondary" onclick="calCollapseAll()">Collapse</button>`;
    html += '</div>';
    html += '<div class="calendar-legend"><div class="legend-item"><div class="legend-swatch legend-actual"></div>Actual</div><div class="legend-item"><div class="legend-swatch legend-forecast"></div>Forecast</div><div class="legend-item"><div class="legend-swatch legend-outstanding"></div>Outstanding</div></div>';
    html += '</div>';
    return html;
}

function renderCalendarAnnual() {
    const tx = getFilteredTransactions();
    const showHC = isHeadcountVisible();
    const cats = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const qs = ['Q1', 'Q2', 'Q3', 'Q4'];
    const curQ = quarterOf(getCurrentMonth());

    let html = '<div class="calendar-container"><table class="calendar-table"><thead><tr><th class="row-label">Category / Line Item</th>';
    qs.forEach(q => {
        html += `<th class="num cal-zoom-header ${q === curQ ? 'current-month' : ''}" onclick="calZoomTo('quarterly','${q}')" colspan="2">${q} 2026</th>`;
    });
    html += '<th class="num quarter-header" colspan="2">Annual</th><th class="num">Variance</th><th class="num">% Used</th></tr>';
    html += '<tr><th class="row-label"></th>';
    qs.forEach(() => { html += '<th class="num" style="font-size:9px;font-weight:400">Budget</th><th class="num" style="font-size:9px;font-weight:400">Actual</th>'; });
    html += '<th class="num" style="font-size:9px;font-weight:400">Budget</th><th class="num" style="font-size:9px;font-weight:400">Actual</th><th class="num"></th><th class="num"></th></tr></thead><tbody>';

    let grandBudget = 0, grandActual = 0;

    cats.forEach(cat => {
        const catTx = tx.filter(t => t.year === 2026 && t.category === cat);
        const budgetRow = appState.budget.find(b => b.category === cat);
        const catBudget = budgetRow ? budgetRow.annual : 0;
        const catActual = catTx.reduce((s, t) => s + t.amount, 0);
        const isCollapsed = appState.calendarCollapsed[cat];

        // Category header
        html += `<tr class="category-row"><td class="row-label-cell"><span class="cal-category-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="calToggleCategory('${esc(cat)}')">${esc(cat)}</span></td>`;
        qs.forEach(q => {
            const qMonths = CONFIG.QUARTERS[q];
            const qBudget = budgetRow ? qMonths.reduce((s, m) => s + (budgetRow.months[m] || 0), 0) : 0;
            const qActual = catTx.filter(t => qMonths.includes(t.month)).reduce((s, t) => s + t.amount, 0);
            html += `<td class="num cal-budget-col">${qBudget ? fmtWhole(qBudget) : ''}</td><td class="num cal-actual-col">${qActual ? fmtWhole(qActual) : ''}</td>`;
        });
        const variance = catBudget - catActual;
        const pctUsed = catBudget > 0 ? catActual / catBudget : 0;
        html += `<td class="num cal-budget-col">${catBudget ? fmtWhole(catBudget) : ''}</td><td class="num cal-actual-col">${catActual ? fmtWhole(catActual) : ''}</td>`;
        html += `<td class="num ${variance >= 0 ? 'cal-variance-pos' : 'cal-variance-neg'}">${fmtWhole(variance)}</td>`;
        html += `<td class="num ${pctClass(pctUsed)}">${fmtPct(pctUsed)}</td></tr>`;

        // Line items (vendors within category)
        if (!isCollapsed) {
            const vendors = {};
            catTx.forEach(t => { const v = t.vendor || 'Other'; if (!vendors[v]) vendors[v] = []; vendors[v].push(t); });
            Object.entries(vendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([vendor, vtx]) => {
                const vTotal = vtx.reduce((s, t) => s + t.amount, 0);
                html += `<tr class="${isCollapsed ? 'cal-category-collapsed' : ''}"><td class="row-label-cell" style="padding-left:20px;font-weight:400;font-size:11px">${esc(vendor)}</td>`;
                qs.forEach(q => {
                    const qMonths = CONFIG.QUARTERS[q];
                    const qActual = vtx.filter(t => qMonths.includes(t.month)).reduce((s, t) => s + t.amount, 0);
                    html += `<td class="num cal-budget-col"></td><td class="num clickable" onclick="drillCalendarVendor('${esc(vendor)}','${q}')" style="font-size:11px">${qActual ? fmt(qActual) : ''}</td>`;
                });
                html += `<td class="num cal-budget-col"></td><td class="num" style="font-size:11px">${fmt(vTotal)}</td><td class="num"></td><td class="num"></td></tr>`;
            });
        }
        grandBudget += catBudget;
        grandActual += catActual;
    });

    // Grand total
    const gVariance = grandBudget - grandActual;
    const gPct = grandBudget > 0 ? grandActual / grandBudget : 0;
    html += '<tr class="grand-total-row"><td class="row-label-cell">TOTAL</td>';
    qs.forEach(q => {
        const qMonths = CONFIG.QUARTERS[q];
        const qBudget = appState.budget.filter(b => b.category !== 'TOTAL' && b.category !== 'Outside Envelope').reduce((s, b) => s + qMonths.reduce((ss, m) => ss + (b.months[m] || 0), 0), 0);
        const qActual = tx.filter(t => t.year === 2026 && t.category !== 'Outside Envelope' && qMonths.includes(t.month)).reduce((s, t) => s + t.amount, 0);
        html += `<td class="num">${fmtWhole(qBudget)}</td><td class="num">${fmtWhole(qActual)}</td>`;
    });
    html += `<td class="num">${fmtWhole(grandBudget)}</td><td class="num">${fmtWhole(grandActual)}</td>`;
    html += `<td class="num ${gVariance >= 0 ? 'cal-variance-pos' : 'cal-variance-neg'}">${fmtWhole(gVariance)}</td><td class="num ${pctClass(gPct)}">${fmtPct(gPct)}</td></tr>`;
    html += '</tbody></table></div>';
    return html;
}

function renderCalendarQuarterly() {
    const q = appState.calendarQuarter;
    const months = CONFIG.QUARTERS[q] || ['Jan', 'Feb', 'Mar'];
    const tx = getFilteredTransactions().filter(t => t.year === 2026);
    const showHC = isHeadcountVisible();
    const cats = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];

    let html = '<div class="calendar-container"><table class="calendar-table"><thead><tr><th class="row-label">Item</th>';
    months.forEach(m => {
        const isAct = isActualPeriod(m, 2026);
        const isCur = m === getCurrentMonth();
        html += `<th class="num cal-zoom-header ${isCur ? 'current-month' : ''}" onclick="calZoomTo('monthly','${m}')" colspan="2">${m}</th>`;
    });
    html += `<th class="num quarter-header" colspan="2">${q} Total</th></tr>`;
    html += '<tr><th class="row-label"></th>';
    months.forEach(() => { html += '<th class="num" style="font-size:9px;font-weight:400">Budget</th><th class="num" style="font-size:9px;font-weight:400">Actual</th>'; });
    html += '<th class="num" style="font-size:9px;font-weight:400">Budget</th><th class="num" style="font-size:9px;font-weight:400">Actual</th></tr></thead><tbody>';

    cats.forEach(cat => {
        const catTx = tx.filter(t => t.category === cat && months.includes(t.month));
        const budgetRow = appState.budget.find(b => b.category === cat);
        const isCollapsed = appState.calendarCollapsed[cat];
        html += `<tr class="category-row"><td class="row-label-cell"><span class="cal-category-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="calToggleCategory('${esc(cat)}')">${esc(cat)}</span></td>`;
        let qBudgetTotal = 0, qActualTotal = 0;
        months.forEach(m => {
            const mBudget = budgetRow ? (budgetRow.months[m] || 0) : 0;
            const mActual = catTx.filter(t => t.month === m).reduce((s, t) => s + t.amount, 0);
            const isAct = isActualPeriod(m, 2026);
            const cellCls = isAct ? '' : 'forecast-cell';
            html += `<td class="num cal-budget-col ${cellCls}">${mBudget ? fmtWhole(mBudget) : ''}</td><td class="num cal-actual-col ${cellCls}">${mActual ? fmtWhole(mActual) : ''}</td>`;
            qBudgetTotal += mBudget; qActualTotal += mActual;
        });
        html += `<td class="num quarter-total-cell">${fmtWhole(qBudgetTotal)}</td><td class="num quarter-total-cell">${fmtWhole(qActualTotal)}</td></tr>`;
        if (!isCollapsed) {
            const vendors = {};
            catTx.forEach(t => { const v = t.vendor || 'Other'; if (!vendors[v]) vendors[v] = []; vendors[v].push(t); });
            Object.entries(vendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([vendor, vtx]) => {
                html += `<tr><td class="row-label-cell" style="padding-left:20px;font-weight:400;font-size:11px">${esc(vendor)}</td>`;
                let vqTotal = 0;
                months.forEach(m => {
                    const mActual = vtx.filter(t => t.month === m).reduce((s, t) => s + t.amount, 0);
                    const isAct = isActualPeriod(m, 2026);
                    const hasOutstanding = vtx.some(t => t.month === m && t.status === 'Outstanding');
                    const cellCls = (isAct ? '' : 'forecast-cell') + (hasOutstanding ? ' outstanding-cell' : '');
                    html += `<td class="num cal-budget-col ${cellCls}"></td><td class="num clickable ${cellCls}" onclick="drillCalendarVendor('${esc(vendor)}','${m}')" style="font-size:11px">${mActual ? fmt(mActual) : ''}</td>`;
                    vqTotal += mActual;
                });
                html += `<td class="num quarter-total-cell"></td><td class="num quarter-total-cell" style="font-size:11px">${fmt(vqTotal)}</td></tr>`;
            });
        }
    });
    html += '</tbody></table></div>';
    return html;
}

function renderCalendarMonthly() {
    const m = appState.calendarMonth;
    const tx = getFilteredTransactions().filter(t => t.year === 2026 && t.month === m);
    const showHC = isHeadcountVisible();
    const cats = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const isPres = appState.presentationMode;

    let html = '<div class="table-container"><div class="table-scroll"><table>';
    html += '<thead><tr><th>Vendor</th><th class="num">Amount</th><th>GL</th><th>Dept</th><th>Memo</th><th>Status</th></tr></thead><tbody>';

    let monthTotal = 0;
    cats.forEach(cat => {
        const catTx = tx.filter(t => t.category === cat);
        if (catTx.length === 0 && isPres) return;
        const catTotal = catTx.reduce((s, t) => s + t.amount, 0);
        html += `<tr class="category-row"><td colspan="6">${esc(cat)} (${catTx.length}) — ${fmt(catTotal)}</td></tr>`;
        catTx.forEach(t => {
            html += `<tr oncontextmenu="showContextMenu(event,${t._row})">`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'vendor')">${esc(t.vendor)}</td>`;
            html += `<td class="num editable-cell" ondblclick="startCellEdit(this,${t._row},'amount')">${fmt(t.amount)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'gl')">${esc(t.gl)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'department')">${esc(t.department)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'memo')">${esc(t.memo)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'status')">${statusPill(t.status)}</td></tr>`;
        });
        if (!isPres) {
            html += `<tr class="cal-add-row" onclick="calAddRow('${esc(cat)}','${m}')"><td colspan="6">+ Add ${cat.toLowerCase()} item</td></tr>`;
        }
        html += `<tr class="subtotal-row"><td>${esc(cat)} Subtotal</td><td class="num">${fmt(catTotal)}</td><td colspan="4"></td></tr>`;
        monthTotal += catTotal;
    });
    html += `<tr class="grand-total-row"><td>${m} Total</td><td class="num">${fmt(monthTotal)}</td><td colspan="4"></td></tr>`;
    html += '</tbody></table></div></div>';
    return html;
}

function calZoomTo(level, target) {
    appState.calendarZoom = level;
    if (level === 'quarterly') appState.calendarQuarter = target;
    if (level === 'monthly') { appState.calendarMonth = target; appState.calendarQuarter = quarterOf(target); }
    renderCalendar();
}
function calToggleCategory(cat) { appState.calendarCollapsed[cat] = !appState.calendarCollapsed[cat]; renderCalendar(); }
function calExpandAll() { appState.calendarCollapsed = {}; renderCalendar(); }
function calCollapseAll() { ['Headcount', 'Programs', 'T&E', 'Outside Envelope'].forEach(c => appState.calendarCollapsed[c] = true); renderCalendar(); }
function changeCalendarGrouping(val) { appState.calendarGrouping = val; renderCalendar(); }

function calAddRow(category, month) {
    const glDefault = category === 'Programs' ? '6406' : category === 'T&E' ? '6202' : category === 'Headcount' ? '6101' : '6303';
    const info = CONFIG.GL_MAP[glDefault] || { cat: category, sub: '' };
    const newTx = { _row: Date.now(), date: '', vendor: '', amount: 0, gl: glDefault, glName: info.sub, department: '400-Marketing', memo: '', category: info.cat, subcategory: info.sub, month, quarter: quarterOf(month), year: 2026, status: 'Actual', isCarryover: false, employeeType: '' };
    appState.transactions.push(newTx);
    recompute(); renderCalendar();
    // Find the new row's vendor cell and start editing
    setTimeout(() => {
        const cells = document.querySelectorAll('td.editable-cell');
        const lastVendorCell = Array.from(cells).filter(td => td.getAttribute('ondblclick')?.includes(newTx._row + ",'vendor'")).pop();
        if (lastVendorCell) startCellEdit(lastVendorCell, newTx._row, 'vendor');
    }, 50);
}

function drillCalendarVendor(vendor, period) {
    const tx = getFilteredTransactions();
    const months = CONFIG.QUARTERS[period] || [period];
    const filtered = tx.filter(t => t.vendor === vendor && t.year === 2026 && months.includes(t.month));
    if (filtered.length > 0) showDrillDown(filtered, vendor + ' — ' + period);
}

// ============================================================
// 17. TRANSACTIONS TAB — INLINE EDITING
// ============================================================
function renderTransactions() {
    const el = document.getElementById('tab-transactions');
    const allTx = getFilteredTransactions();
    const f = appState.txFilters;
    let filtered = allTx.filter(t => {
        if (f.search) { const s = f.search.toLowerCase(); if (!(t.vendor.toLowerCase().includes(s) || t.memo.toLowerCase().includes(s) || t.glName.toLowerCase().includes(s) || t.department.toLowerCase().includes(s))) return false; }
        if (f.category && t.category !== f.category) return false;
        if (f.quarter) { const tq = t.quarter + (t.year === 2025 ? ' 2025' : ' 2026'); if (tq !== f.quarter) return false; }
        if (f.status && t.status !== f.status) return false;
        return true;
    });
    if (appState.txSort.col) {
        const col = appState.txSort.col; const dir = appState.txSort.dir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => { let va = a[col], vb = b[col]; if (col === 'amount') return (va - vb) * dir; if (col === 'date') return (new Date(va) - new Date(vb)) * dir; return String(va).localeCompare(String(vb)) * dir; });
    }
    const showHC = isHeadcountVisible();
    const isPres = appState.presentationMode;
    let html = '<div class="filter-bar">';
    html += `<input type="text" class="filter-input" placeholder="Search vendor, memo, GL..." value="${esc(f.search)}" oninput="updateTxFilter('search', this.value)">`;
    html += `<select class="filter-select" onchange="updateTxFilter('category', this.value)"><option value="">All Categories</option>${showHC ? '<option value="Headcount"' + (f.category === 'Headcount' ? ' selected' : '') + '>Headcount</option>' : ''}<option value="Programs" ${f.category === 'Programs' ? 'selected' : ''}>Programs</option><option value="T&E" ${f.category === 'T&E' ? 'selected' : ''}>T&E</option><option value="Outside Envelope" ${f.category === 'Outside Envelope' ? 'selected' : ''}>Outside Envelope</option></select>`;
    html += `<select class="filter-select" onchange="updateTxFilter('quarter', this.value)"><option value="">All Quarters</option><option value="Q4 2025" ${f.quarter === 'Q4 2025' ? 'selected' : ''}>Q4 2025</option><option value="Q1 2026" ${f.quarter === 'Q1 2026' ? 'selected' : ''}>Q1 2026</option><option value="Q2 2026" ${f.quarter === 'Q2 2026' ? 'selected' : ''}>Q2 2026</option><option value="Q3 2026" ${f.quarter === 'Q3 2026' ? 'selected' : ''}>Q3 2026</option><option value="Q4 2026" ${f.quarter === 'Q4 2026' ? 'selected' : ''}>Q4 2026</option></select>`;
    html += `<select class="filter-select" onchange="updateTxFilter('status', this.value)"><option value="">All Status</option><option value="Actual" ${f.status === 'Actual' ? 'selected' : ''}>Actual</option><option value="Outstanding" ${f.status === 'Outstanding' ? 'selected' : ''}>Outstanding</option></select>`;
    html += `<button class="filter-clear" onclick="clearTxFilters()">Clear</button>`;
    html += `<button class="btn btn-secondary" onclick="exportCSV()"><i data-lucide="download" style="width:13px;height:13px"></i> CSV</button>`;
    if (!isPres) html += `<button class="btn btn-primary" data-action="add" onclick="openAddTxModal()"><i data-lucide="plus" style="width:13px;height:13px"></i> Add</button>`;
    html += '</div>';
    html += '<div class="table-container"><div class="table-scroll"><table>';
    const sortIcon = col => appState.txSort.col !== col ? '<span class="sort-indicator">↕</span>' : '<span class="sort-indicator">' + (appState.txSort.dir === 'asc' ? '↑' : '↓') + '</span>';
    const sortCls = col => appState.txSort.col !== col ? 'sortable' : 'sortable sort-' + appState.txSort.dir;
    html += `<thead><tr><th class="${sortCls('date')}" onclick="sortTx('date')">Date ${sortIcon('date')}</th><th class="${sortCls('vendor')}" onclick="sortTx('vendor')">Vendor ${sortIcon('vendor')}</th><th class="num ${sortCls('amount')}" onclick="sortTx('amount')">Amount ${sortIcon('amount')}</th><th class="${sortCls('category')}" onclick="sortTx('category')">Category ${sortIcon('category')}</th><th>Sub</th><th>GL</th><th>Dept</th><th>Memo</th><th>Status</th></tr></thead><tbody>`;
    const catOrder = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const grouped = {}; filtered.forEach(t => { if (!grouped[t.category]) grouped[t.category] = []; grouped[t.category].push(t); });
    catOrder.forEach(cat => {
        const items = grouped[cat]; if (!items || items.length === 0) return;
        const catTotal = items.reduce((s, t) => s + t.amount, 0);
        html += `<tr class="category-row"><td colspan="9">${esc(cat)} (${items.length}) — ${fmt(catTotal)}</td></tr>`;
        items.forEach(t => {
            html += `<tr oncontextmenu="showContextMenu(event,${t._row})">`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'date')">${esc(t.date)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'vendor')">${esc(t.vendor)}</td>`;
            html += `<td class="num editable-cell" ondblclick="startCellEdit(this,${t._row},'amount')">${fmt(t.amount)}</td>`;
            html += `<td>${categoryPill(t.category)}</td><td>${esc(t.subcategory)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'gl')">${esc(t.gl)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'department')">${esc(t.department)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'memo')">${esc(t.memo)}</td>`;
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'status')">${statusPill(t.status)}</td></tr>`;
        });
    });
    const grandTotal = filtered.reduce((s, t) => s + t.amount, 0);
    html += `<tr class="grand-total-row"><td colspan="2">Total (${filtered.length})</td><td class="num">${fmt(grandTotal)}</td><td colspan="6"></td></tr>`;
    html += '</tbody></table></div></div>';
    el.innerHTML = html;
}
function updateTxFilter(key, val) { appState.txFilters[key] = val; if (key === 'search') debounce(renderTransactions, 300)(); else renderTransactions(); }
function clearTxFilters() { appState.txFilters = { search: '', category: '', quarter: '', status: '' }; renderTransactions(); }
function sortTx(col) { if (appState.txSort.col === col) appState.txSort.dir = appState.txSort.dir === 'asc' ? 'desc' : 'asc'; else { appState.txSort.col = col; appState.txSort.dir = 'asc'; } renderTransactions(); }
function exportCSV() {
    const tx = getFilteredTransactions();
    const headers = ['Date', 'Vendor', 'Amount', 'GL', 'GL_Name', 'Department', 'Memo', 'Category', 'Subcategory', 'Month', 'Quarter', 'Year', 'Status'];
    const rows = tx.map(t => [t.date, t.vendor, t.amount, t.gl, t.glName, t.department, t.memo, t.category, t.subcategory, t.month, t.quarter, t.year, t.status]);
    const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'budget_transactions.csv'; a.click(); URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
}
function openAddTxModal() { showTxModal(null); }
function showTxModal(tx) {
    const isEdit = !!tx; const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = isEdit ? 'Edit Transaction' : 'Add Transaction';
    const glOpts = Object.entries(CONFIG.GL_MAP).map(([c, i]) => `<option value="${c}" ${tx && tx.gl === c ? 'selected' : ''}>${c} — ${i.sub}</option>`).join('');
    document.getElementById('modalBody').innerHTML = `<div class="form-row"><div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="txDate" value="${tx ? tx.date : new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label class="form-label">Amount</label><input type="number" class="form-input" id="txAmount" step="0.01" value="${tx ? tx.amount : ''}"></div></div><div class="form-group"><label class="form-label">Vendor</label><input type="text" class="form-input" id="txVendor" value="${tx ? esc(tx.vendor) : ''}"></div><div class="form-row"><div class="form-group"><label class="form-label">GL Account</label><select class="form-select" id="txGL">${glOpts}</select></div><div class="form-group"><label class="form-label">Department</label><select class="form-select" id="txDept"><option value="400-Marketing">400-Marketing</option><option value="401-Education Marketing">401-Education Mktg</option><option value="402-Corp Marketing">402-Corp Mktg</option><option value="403-Mktg Ops">403-Mktg Ops</option><option value="404-Creative & Brand">404-Creative</option><option value="405-Community & Advocacy">405-Community</option><option value="406-Sales Enablement">406-Sales Enable</option><option value="407-Mktg Leadership">407-Leadership</option><option value="408-SDRs">408-SDRs</option></select></div></div><div class="form-group"><label class="form-label">Memo</label><input type="text" class="form-input" id="txMemo" value="${tx ? esc(tx.memo) : ''}"></div><div class="form-row"><div class="form-group"><label class="form-label">Status</label><select class="form-select" id="txStatus"><option value="Actual">Actual</option><option value="Outstanding">Outstanding</option></select></div><div class="form-group"><label class="form-label">Employee Type</label><select class="form-select" id="txEmpType"><option value="">(none)</option><option value="FTE">FTE</option><option value="Contractor">Contractor</option></select></div></div>`;
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveTxModal(${isEdit ? tx._row : 'null'})">${isEdit ? 'Save' : 'Add'}</button>`;
    overlay.classList.add('active');
}
async function saveTxModal(editRow) {
    const dateVal = document.getElementById('txDate').value; const amount = parseFloat(document.getElementById('txAmount').value);
    const vendor = document.getElementById('txVendor').value.trim(); const gl = document.getElementById('txGL').value;
    const dept = document.getElementById('txDept').value; const memo = document.getElementById('txMemo').value.trim();
    const status = document.getElementById('txStatus').value; const empType = document.getElementById('txEmpType').value;
    if (!dateVal || isNaN(amount) || !vendor) { showToast('Fill Date, Amount, Vendor', 'warning'); return; }
    const d = new Date(dateVal); const dateFormatted = (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getDate().toString().padStart(2, '0') + '/' + d.getFullYear();
    const month = CONFIG.MONTHS[d.getMonth()]; const quarter = quarterOf(month); const year = d.getFullYear();
    const glInfo = CONFIG.GL_MAP[gl] || { cat: 'Programs', sub: '' };
    const row = [dateFormatted, vendor, amount, gl, glInfo.sub, dept, memo, glInfo.cat, glInfo.sub, month, quarter, year, status, year < 2026 ? 'Yes' : 'No', empType];
    const newTx = { _row: editRow || appState.transactions.length + 2, date: dateFormatted, vendor, amount, gl, glName: glInfo.sub, department: dept, memo, category: glInfo.cat, subcategory: glInfo.sub, month, quarter, year, status, isCarryover: year < 2026, employeeType: empType };
    if (editRow) { const idx = appState.transactions.findIndex(t => t._row === editRow); if (idx >= 0) appState.transactions[idx] = newTx; writeToSheets(`Transactions!A${editRow}:O${editRow}`, [row]); }
    else { appState.transactions.push(newTx); appendToSheets('Transactions!A:O', [row]); }
    recompute(); closeModal(); renderActiveTab();
}
function confirmDeleteTx(row) {
    if (confirm('Delete this transaction?')) { appState.transactions = appState.transactions.filter(t => t._row !== row); recompute(); renderActiveTab(); showToast('Deleted locally', 'info'); }
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }

// ============================================================
// 18. SCENARIO TAB
// ============================================================
function renderScenario() {
    const el = document.getElementById('tab-scenario');
    const s = appState.scenarioInput; const c = appState.computed;
    const catBudget = s.category === 'Programs' ? CONFIG.BUDGET.programs : CONFIG.BUDGET.te;
    const catActual = s.category === 'Programs' ? c.ytdActual.programs : c.ytdActual.te;
    const catOutstanding = s.category === 'Programs' ? c.programsWaterfall.outstanding : 0;
    const catCommitted = s.category === 'Programs' ? c.programsWaterfall.committed : 0;
    const available = catBudget - catActual - catOutstanding - catCommitted;
    const remaining = available - (s.amount || 0);
    const verdict = remaining >= catBudget * 0.1 ? 'ok' : remaining >= 0 ? 'tight' : 'over';
    const verdictLabel = verdict === 'ok' ? 'Within Budget' : verdict === 'tight' ? 'Tight' : 'Over Budget';
    let html = '<div class="scenario-layout"><div class="scenario-input-panel section-card"><div class="section-title">Scenario Input</div>';
    html += `<div class="form-group"><label class="form-label">Amount ($)</label><input type="number" class="form-input" id="scenarioAmount" step="100" value="${s.amount || ''}" placeholder="e.g. 8000" oninput="updateScenario('amount', parseFloat(this.value) || 0)"></div>`;
    html += `<div class="form-group"><label class="form-label">Category</label><select class="form-select" onchange="updateScenario('category', this.value)"><option value="Programs" ${s.category === 'Programs' ? 'selected' : ''}>Programs</option><option value="T&E" ${s.category === 'T&E' ? 'selected' : ''}>T&E</option></select></div>`;
    html += `<div class="form-group"><label class="form-label">Quarter</label><select class="form-select" onchange="updateScenario('quarter', this.value)"><option value="Q2" ${s.quarter === 'Q2' ? 'selected' : ''}>Q2</option><option value="Q3" ${s.quarter === 'Q3' ? 'selected' : ''}>Q3</option><option value="Q4" ${s.quarter === 'Q4' ? 'selected' : ''}>Q4</option></select></div>`;
    html += `<div class="form-group"><label class="form-label">Description</label><input type="text" class="form-input" id="scenarioDesc" value="${esc(s.description)}" placeholder="e.g. Sponsored webinar" oninput="updateScenario('description', this.value)"></div></div>`;
    html += '<div><div class="section-card"><div class="section-title">Impact Analysis</div>';
    if (s.amount > 0) {
        html += `<div class="scenario-verdict verdict-${verdict}">${verdictLabel}</div>`;
        html += `<table class="scenario-impact-table"><tr><td>${s.category} Budget:</td><td>${fmt(catBudget)}</td></tr><tr><td>YTD Actual:</td><td class="amount-negative">-${fmt(catActual)}</td></tr>`;
        if (catOutstanding > 0) html += `<tr><td>Outstanding:</td><td class="amount-negative">-${fmt(catOutstanding)}</td></tr>`;
        html += `<tr><td>Committed:</td><td class="amount-negative">-${fmt(catCommitted)}</td></tr><tr class="divider"><td>Available:</td><td>${fmt(available)}</td></tr><tr><td>This Request:</td><td class="amount-negative">-${fmt(s.amount)}</td></tr><tr class="result"><td>Remaining:</td><td class="${amountClass(remaining)}">${fmt(remaining)}</td></tr></table>`;
        html += `<div class="kpi-subtext mt-8">${fmtPct(s.amount / catBudget)} of ${s.category} budget</div>`;
    } else html += '<div class="empty-state"><p>Enter an amount to see impact.</p></div>';
    html += '</div>';
    if (s.amount > 0) {
        const desc = s.description || '[description]';
        const txt = `Marketing ${s.category} budget: ${fmt(catBudget)}. Through Q1, ${fmt(catActual)} spent${catOutstanding > 0 ? ' with ' + fmt(catOutstanding) + ' outstanding' : ''}. Known commitments: ${fmt(catCommitted)}. Available: ${fmt(available)}.\n\nProposed: ${fmt(s.amount)} for ${desc} in ${s.quarter}. Remaining: ${fmt(remaining)} (${fmtPct(remaining / catBudget)}).`;
        html += `<div class="section-card"><div class="section-title">Summary (Copy)</div><div class="scenario-summary"><button class="copy-btn" onclick="copyScenarioSummary()"><i data-lucide="copy"></i> Copy</button><pre style="white-space:pre-wrap;font-family:var(--font-family);font-size:12px;margin:0" id="scenarioSummaryText">${esc(txt)}</pre></div></div>`;
    }
    html += '</div></div>';
    el.innerHTML = html;
}
function updateScenario(key, val) { appState.scenarioInput[key] = val; renderScenario(); }
function copyScenarioSummary() { navigator.clipboard.writeText(document.getElementById('scenarioSummaryText').textContent).then(() => showToast('Copied', 'success')); }

// ============================================================
// 19. RECONCILIATION TAB
// ============================================================
function renderReconciliation() {
    const el = document.getElementById('tab-reconciliation');
    const cfg = appState.config;
    const brianQ1 = parseNum(cfg.brian_q1_marketing_programs); const pantheon = parseNum(cfg.pantheon_reclassification);
    const adjusted = parseNum(cfg.brian_adjusted_q1); const brianFull = parseNum(cfg.brian_full_year_forecast);
    const carryovers = appState.transactions.filter(t => t.isCarryover && t.year === 2025 && t.category === 'Programs');
    const carryoverTotal = carryovers.reduce((s, t) => s + t.amount, 0);
    let html = '<div class="section-card recon-bridge"><div class="section-title">Q1 Reconciliation Bridge</div><table class="bridge-table">';
    html += `<tr class="bridge-start"><td>Brian's Cash-Basis Q1 Marketing Programs</td><td>${fmt(brianQ1)}</td></tr>`;
    html += `<tr class="bridge-adjustment"><td>Pantheon reclassification (hosting → software)</td><td class="amount-negative">-${fmt(pantheon)}</td></tr>`;
    html += `<tr class="bridge-adjustment"><td>= Adjusted Marketing Programs</td><td>${fmt(adjusted)}</td></tr>`;
    if (carryoverTotal > 0) { html += `<tr class="bridge-adjustment"><td>Q4 2025 carryovers paid in Q1 2026</td><td class="amount-negative">-${fmt(carryoverTotal)}</td></tr>`; html += `<tr class="bridge-result"><td>Q1 2026 Marketing Programs Actual</td><td>${fmt(adjusted - carryoverTotal)}</td></tr>`; }
    else html += `<tr class="bridge-result"><td>Q1 2026 Adjusted Marketing Programs</td><td>${fmt(adjusted)}</td></tr>`;
    html += '</table></div>';
    html += '<div class="section-card"><div class="section-title">Categorization Notes</div><div class="table-container"><table><thead><tr><th>Item</th><th>Brian\'s Category</th><th>Russell\'s Category</th><th class="num">Amount</th><th>Rationale</th></tr></thead><tbody>';
    html += `<tr><td>Pantheon</td><td>${categoryPill('Programs')}</td><td>${categoryPill('Outside Envelope')}</td><td class="num">${fmt(pantheon)}</td><td>Website CMS hosting (GL 6303). Not a marketing program.</td></tr>`;
    html += '</tbody></table></div></div>';
    if (carryovers.length > 0) {
        html += '<div class="section-card"><div class="section-title">Q4 2025 Carryover Reference</div><p class="text-muted mb-8" style="font-size:11px">Transactions accrued in Q4 2025 with cash payments in Q1 2026.</p><div class="table-container"><table><thead><tr><th>Vendor</th><th>Month</th><th class="num">Amount</th><th>Category</th></tr></thead><tbody>';
        carryovers.forEach(t => { html += `<tr><td>${esc(t.vendor)}</td><td>${esc(t.month)} ${t.year}</td><td class="num">${fmt(t.amount)}</td><td>${categoryPill(t.category)}</td></tr>`; });
        html += `<tr class="subtotal-row"><td colspan="2">Total Carryover</td><td class="num">${fmt(carryoverTotal)}</td><td></td></tr></tbody></table></div></div>`;
    }
    html += `<div class="section-card"><div class="section-title">Brian's Reference Numbers</div><table class="scenario-impact-table"><tr><td>Q1 Marketing Programs:</td><td>${fmt(brianQ1)}</td></tr><tr><td>Full Year Forecast:</td><td>${fmt(brianFull)}</td></tr><tr><td>Company SW Budget:</td><td>${fmt(parseNum(cfg.company_sw_budget))}</td></tr><tr><td>NetSuite Last Refresh:</td><td>${cfg.netsuite_last_refresh || 'N/A'}</td></tr></table></div>`;
    el.innerHTML = html;
}

// ============================================================
// 20. SAVINGS TAB — SOFTWARE PORTFOLIO MANAGER
// ============================================================
function renderSavings() {
    const el = document.getElementById('tab-savings');
    const vendors = appState.vendorContracts;
    const totalBefore = vendors.reduce((s, v) => s + v.before, 0);
    const totalAfter = vendors.reduce((s, v) => s + v.after, 0);
    const totalSavings = vendors.reduce((s, v) => s + v.savings, 0);
    const companySW = parseNum(appState.config.company_sw_budget) || 871560;

    // Compute proposed savings
    let proposedTotal = 0;
    vendors.forEach(v => {
        const p = appState.swModeling.proposals[v.vendor];
        if (p && p.newAnnual != null) proposedTotal += v.before - p.newAnnual;
        else proposedTotal += v.savings;
    });
    const additionalSavings = proposedTotal - totalSavings;

    let html = '';
    // KPIs
    html += '<div class="savings-kpi-grid">';
    html += `<div class="kpi-card positive"><div class="kpi-label">Current SW Savings</div><div class="kpi-value">${fmtWhole(totalSavings)}</div><div class="kpi-trend positive">${fmtPct(totalSavings / totalBefore)} reduction</div></div>`;
    html += `<div class="kpi-card"><div class="kpi-label">Company SW Budget</div><div class="kpi-value">${fmtWhole(companySW)}</div><div class="kpi-trend neutral">FY 2026</div></div>`;
    if (additionalSavings > 0) {
        html += `<div class="kpi-card gold"><div class="kpi-label">Proposed Additional</div><div class="kpi-value sw-forecast-delta">+${fmtWhole(additionalSavings)}</div><div class="kpi-trend positive">from renegotiations</div></div>`;
    } else {
        html += `<div class="kpi-card gold"><div class="kpi-label">Impact on Company SW</div><div class="kpi-value">${fmtPct(totalSavings / companySW)}</div><div class="kpi-trend positive">of company budget</div></div>`;
    }
    html += '</div>';

    // Editable Portfolio Table
    html += '<div class="section-card"><div class="section-title">Software Portfolio (double-click to edit)</div>';
    html += '<div class="table-container"><div class="table-scroll"><table><thead><tr>';
    html += '<th>Vendor</th><th>Category</th><th class="num">Previous $/yr</th><th class="num">Current $/yr</th><th class="num">Savings</th><th class="num">%</th><th>Contract End</th><th>Reneg Date</th><th class="num">New Target</th><th>Status</th>';
    html += '</tr></thead><tbody>';
    vendors.forEach((v, i) => {
        const proposal = appState.swModeling.proposals[v.vendor] || {};
        const hasProposal = proposal.renegDate || proposal.newAnnual;
        html += '<tr>';
        html += `<td class="editable-cell" ondblclick="startCellEdit(this,${i},'vendor','vendors')">${esc(v.vendor)}</td>`;
        html += `<td class="editable-cell" ondblclick="startCellEdit(this,${i},'category','vendors')">${esc(v.category)}</td>`;
        html += `<td class="num editable-cell" ondblclick="startCellEdit(this,${i},'before','vendors')">${fmtWhole(v.before)}</td>`;
        html += `<td class="num editable-cell" ondblclick="startCellEdit(this,${i},'after','vendors')">${fmtWhole(v.after)}</td>`;
        html += `<td class="num text-positive">${fmtWhole(v.savings)}</td>`;
        html += `<td class="num">${esc(v.savingsPct)}</td>`;
        html += `<td class="editable-cell" ondblclick="startCellEdit(this,${i},'contractEnd','vendors')">${esc(v.contractEnd || '')}</td>`;
        html += `<td class="editable-cell sw-modeling-cell ${hasProposal ? 'has-value' : ''}" ondblclick="startSWModelEdit(this,${i},'renegDate')">${esc(v.renegDate || proposal.renegDate || '')}</td>`;
        html += `<td class="num editable-cell sw-modeling-cell ${hasProposal ? 'has-value' : ''}" ondblclick="startSWModelEdit(this,${i},'newTargetAnnual')">${proposal.newAnnual != null ? fmtWhole(proposal.newAnnual) : (v.newTargetAnnual != null ? fmtWhole(v.newTargetAnnual) : '')}</td>`;
        html += `<td>${statusBadge(v.status)}</td>`;
        html += '</tr>';
    });
    html += `<tr class="grand-total-row"><td>Total</td><td></td><td class="num">${fmtWhole(totalBefore)}</td><td class="num">${fmtWhole(totalAfter)}</td><td class="num text-positive">${fmtWhole(totalSavings)}</td><td class="num">${fmtPct(totalSavings / totalBefore)}</td><td colspan="4"></td></tr>`;
    html += '</tbody></table></div></div></div>';

    // Forecast Impact Chart
    html += `<div class="chart-card"><div class="chart-title">Software Cost Forecast — Monthly Impact</div><div class="chart-wrapper tall"><canvas id="swForecastChart"></canvas></div></div>`;

    // Company Impact
    html += '<div class="section-card"><div class="section-title">Company Impact</div>';
    html += `<p style="font-size:12px;margin-bottom:8px">Marketing vendor renegotiations account for ${fmtWhole(totalSavings)} of the company's ${fmtWhole(companySW)} annual software expenses (${fmtPct(totalSavings / companySW)}).`;
    if (additionalSavings > 0) html += ` Proposed renegotiations would add ${fmtWhole(additionalSavings)} in additional savings.`;
    html += '</p>';
    html += '<div class="impact-bar-container"><div class="impact-bar-track">';
    html += `<div class="impact-bar-fill" style="width:${Math.max((totalSavings / companySW) * 100, 5)}%">${fmtPct(totalSavings / companySW)}</div>`;
    html += `</div><div class="impact-labels"><span>Savings: ${fmtWhole(totalSavings)}</span><span>Company SW: ${fmtWhole(companySW)}</span></div></div></div>`;

    el.innerHTML = html;
    renderSWForecastChart();
}

function startSWModelEdit(td, vendorIdx, field) {
    const vendor = appState.vendorContracts[vendorIdx];
    if (!vendor) return;
    if (!appState.swModeling.proposals[vendor.vendor]) appState.swModeling.proposals[vendor.vendor] = {};
    startCellEdit(td, vendorIdx, field, 'vendors');
}

function computeSWForecast() {
    const months = CONFIG.MONTHS;
    const currentLine = new Array(12).fill(0);
    const proposedLine = new Array(12).fill(0);
    const baseline = (parseNum(appState.config.company_sw_budget) || 871560) / 12;

    appState.vendorContracts.forEach(v => {
        months.forEach((m, i) => {
            const monthDate = new Date(2026, i, 15);
            let active = true;
            if (v.status === 'Ending' || v.status === 'Eliminated') {
                const endDate = v.contractEnd ? new Date(v.contractEnd) : new Date(2025, 11, 31);
                if (monthDate > endDate) active = false;
            }
            if (active) currentLine[i] += v.after / 12;

            const proposal = appState.swModeling.proposals[v.vendor];
            if (proposal && proposal.renegDate && proposal.newAnnual != null) {
                const renegDate = new Date(proposal.renegDate);
                if (monthDate >= renegDate) proposedLine[i] += proposal.newAnnual / 12;
                else if (active) proposedLine[i] += v.after / 12;
            } else {
                if (active) proposedLine[i] += v.after / 12;
            }
        });
    });
    return { currentLine, proposedLine, baseline };
}

function renderSWForecastChart() {
    destroyChart('swForecast');
    const { currentLine, proposedLine, baseline } = computeSWForecast();
    const hasProposals = Object.keys(appState.swModeling.proposals).some(k => {
        const p = appState.swModeling.proposals[k];
        return p.renegDate && p.newAnnual != null;
    });
    const isDark = appState.theme === 'dark' || appState.theme === 'high-contrast';
    const textColor = isDark ? '#e7e9ea' : '#0A1849';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
    const fontOpts = { family: "'Inter', sans-serif", size: 10 };
    const ctx = document.getElementById('swForecastChart');
    if (!ctx) return;

    const datasets = [
        { label: 'Company SW Budget (monthly)', data: new Array(12).fill(baseline), borderColor: 'rgba(107,114,128,0.4)', borderDash: [8, 4], pointRadius: 0, fill: false, tension: 0 },
        { label: 'Marketing SW (Current)', data: currentLine, borderColor: 'rgba(71,57,231,0.9)', backgroundColor: 'rgba(71,57,231,0.08)', pointRadius: 3, fill: true, tension: 0.3 },
    ];
    if (hasProposals) {
        datasets.push({ label: 'Marketing SW (Proposed)', data: proposedLine, borderColor: 'rgba(5,150,105,0.9)', backgroundColor: 'rgba(5,150,105,0.08)', pointRadius: 3, fill: true, tension: 0.3 });
    }

    appState.charts.swForecast = new Chart(ctx, {
        type: 'line',
        data: { labels: CONFIG.MONTHS, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } },
                x: { ticks: { font: fontOpts, color: textColor }, grid: { display: false } }
            }
        }
    });
}

// ============================================================
// 21. EVENT HANDLERS & INITIALIZATION
// ============================================================
function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.getElementById('signInBtn').addEventListener('click', signIn);
    document.getElementById('signOutBtn').addEventListener('click', signOut);
    document.getElementById('themeToggle').addEventListener('click', cycleTheme);
    document.getElementById('presentationToggle').addEventListener('click', togglePresentation);
    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (appState.isSignedIn) fetchAllSheets();
        else { loadFallbackData(); showToast('Refreshed fallback data', 'info'); }
    });
    document.getElementById('audienceFilter').addEventListener('change', (e) => { appState.audienceFilter = e.target.value; recompute(); renderActiveTab(); });
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('drilldownClose').addEventListener('click', closeDrillDown);
    document.getElementById('drilldownOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDrillDown(); });
    // Context menu
    document.getElementById('contextMenuDelete').addEventListener('click', () => {
        const rowId = parseInt(document.getElementById('contextMenu').dataset.rowId);
        if (rowId) confirmDeleteTx(rowId);
        hideContextMenu();
    });
    document.addEventListener('click', hideContextMenu);
    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); closeDrillDown(); hideContextMenu(); if (appState.inlineEdit.active) cancelCellEdit(); if (appState.presentationMode) togglePresentation(); }
        if (e.key === 'p' && e.ctrlKey) { e.preventDefault(); togglePresentation(); }
    });
    setInterval(updateFreshness, 60000);
}

function init() {
    bindEvents(); initAuth(); loadFallbackData();
    const loader = document.getElementById('loadingOverlay');
    setTimeout(() => loader.classList.add('hidden'), 300);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
