/* ============================================================
   CLASS 2026 MARKETING BUDGET TRACKER — APPLICATION v4
   4-tab Budget Command Center: Dashboard, Budget, Expenses, Software
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
    SHEET_RANGES: ['Transactions!A:O', 'Budget!A:N', 'Commitments!A:H', 'Vendor Contracts!A:H', 'Config!A:B', 'Vendor Budgets!A:H'],
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
    },
    SUBCATEGORIES: {
        'Programs': ['Events', 'Mktg Ops', 'Advertising', 'Webinars', 'Consulting', 'Conferences/Events'],
        'T&E': ['Lodging', 'Meals', 'Travel'],
        'Headcount': ['Salary', 'Payroll Tax', 'Benefits', 'Bonus', 'Commissions'],
        'Outside Envelope': ['Software Subscriptions', 'Prepaid']
    }
};

// ============================================================
// 2. APPLICATION STATE
// ============================================================
const appState = {
    transactions: [],
    budget: [],
    vendorMonthly: [],
    vendorContracts: [],
    vendorBudgets: [],
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
    // v4: Inline editing
    inlineEdit: { active: false, rowId: null, field: null, originalValue: null, element: null },
    // v5: Monthly spreadsheet — drill-down month for transaction detail view
    calendarMonth: null,
    calendarCollapsed: {},
    // v4: Budget modeling
    draftItems: [],
    disabledVendors: {},
    // v4: SW forecasting
    swForecasts: {}
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
    const map = { 'Renewed': 'status-renewed', 'Renegotiated': 'status-renewed', 'Ending': 'status-ending', 'Terminated': 'status-eliminated', 'Eliminated': 'status-eliminated', 'Cancelled': 'status-eliminated', 'Negotiating': 'status-negotiating', 'Upcoming': 'status-negotiating', 'Winding Down': 'status-ending' };
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
function matchVendor(budgetName, txName) {
    if (!budgetName || !txName) return false;
    const bn = budgetName.toLowerCase().trim();
    const tn = txName.toLowerCase().trim();
    if (bn === tn) return true;
    if (tn.startsWith(bn) || bn.startsWith(tn)) return true;
    if (tn.includes(bn) || bn.includes(tn)) return true;
    return false;
}

// ============================================================
// 4. TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-message">${esc(message)}</span><button class="toast-dismiss" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
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
        // Discover which sheets exist, then only request those
        const metaResp = await fetch(`${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}?fields=sheets.properties.title`, { headers: { Authorization: 'Bearer ' + appState.accessToken } });
        if (!metaResp.ok) throw new Error('Sheets metadata error: ' + metaResp.status);
        const meta = await metaResp.json();
        const existingTabs = (meta.sheets || []).map(s => s.properties.title);
        console.log('Sheets found:', existingTabs);
        // Filter ranges to only existing tabs
        const validRanges = CONFIG.SHEET_RANGES.filter(r => {
            const tabName = r.split('!')[0];
            return existingTabs.includes(tabName);
        });
        if (validRanges.length === 0) throw new Error('No matching tabs found in spreadsheet');
        const rangesParam = validRanges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
        const resp = await fetch(`${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values:batchGet?${rangesParam}`, { headers: { Authorization: 'Bearer ' + appState.accessToken } });
        if (!resp.ok) { const body = await resp.text(); throw new Error('Sheets API error: ' + resp.status + ' ' + body); }
        const data = await resp.json(); const rd = data.valueRanges || [];
        // Map results back to parsers by tab name
        const parsers = {
            'Transactions': parseTransactions, 'Budget': parseBudget,
            'Commitments': parseCommitments, 'Vendor Contracts': parseVendorContracts,
            'Config': parseConfig, 'Vendor Budgets': parseVendorBudgets
        };
        // Start with fallback data as baseline, then overlay Sheets data
        loadFallbackData();
        rd.forEach(vr => {
            const tabName = (vr.range || '').split('!')[0].replace(/'/g, '');
            const parser = parsers[tabName];
            if (parser && vr.values) parser(vr.values);
        });
        const loaded = rd.map(vr => (vr.range || '').split('!')[0].replace(/'/g, ''));
        const skipped = CONFIG.SHEET_RANGES.map(r => r.split('!')[0]).filter(t => !existingTabs.includes(t));
        appState.lastSynced = new Date(); recompute(); renderActiveTab();
        if (skipped.length > 0) showToast('Loaded ' + loaded.length + ' tabs. Missing: ' + skipped.join(', '), 'info', 5000);
        else showToast('Data loaded from Google Sheets', 'success');
    } catch (err) { console.error(err); showToast('Sheets error: ' + err.message.substring(0, 80) + '. Using fallback.', 'warning'); loadFallbackData(); }
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
function parseVendorBudgets(rows) {
    if (!rows || rows.length < 2) return;
    appState.vendorBudgets = rows.slice(1).map(r => ({
        vendor: r[0] || '', subcategory: r[1] || '', category: r[2] || 'Programs',
        q1: parseNum(r[3]), q2: parseNum(r[4]), q3: parseNum(r[5]), q4: parseNum(r[6]),
        notes: r[7] || ''
    })).filter(v => v.vendor);
}

// ============================================================
// 8. FALLBACK DATA
// ============================================================
function loadFallbackData() {
    let _fbRowId = 1000;
    const txn = (date, vendor, amount, gl, glName, dept, memo, cat, sub, month, qtr, year, status, carry, empType) =>
        ({ _row: _fbRowId++, date, vendor, amount, gl, glName, department: dept, memo, category: cat, subcategory: sub, month, quarter: qtr, year, status: status || 'Actual', isCarryover: carry || false, employeeType: empType || '' });
    // --- Q4 2025 Reference Data (carryover context, $87,778 Programs) ---
    const q4_2025 = [
        // Sponge ($19,500)
        txn('10/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '407-Mktg Leadership', 'Monthly retainer', 'Programs', 'Consulting', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('11/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '407-Mktg Leadership', 'Monthly retainer', 'Programs', 'Consulting', 'Nov', 'Q4', 2025, 'Actual', true),
        txn('12/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '407-Mktg Leadership', 'Monthly retainer', 'Programs', 'Consulting', 'Dec', 'Q4', 2025, 'Actual', true),
        // Advertising ($5,750)
        txn('10/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('11/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('12/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('10/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('11/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('12/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('11/20/2025', 'Paperclip Promotions', 150, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('12/20/2025', 'Paperclip Promotions', 200, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        // Events ($62,528)
        txn('11/20/2025', 'Paperclip Promotions', 300, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Event materials', 'Programs', 'Conferences/Events', 'Nov', 'Q4', 2025),
        txn('12/20/2025', 'Paperclip Promotions', 300, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Event materials', 'Programs', 'Conferences/Events', 'Dec', 'Q4', 2025),
        txn('10/25/2025', 'Docebo Conference', 5200, '6405', 'Conferences/Events', '401-Education Marketing', 'Annual conference', 'Programs', 'Conferences/Events', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('10/01/2025', 'Training Magazine', 12000, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Conference', 'Programs', 'Conferences/Events', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('11/05/2025', 'Docebo RKO', 9328, '6405', 'Conferences/Events', '401-Education Marketing', 'Sponsorship', 'Programs', 'Conferences/Events', 'Nov', 'Q4', 2025, 'Actual', true),
        txn('12/10/2025', 'Docebo RKO', 26500, '6405', 'Conferences/Events', '401-Education Marketing', 'Sponsorship', 'Programs', 'Conferences/Events', 'Dec', 'Q4', 2025, 'Actual', true),
        txn('12/18/2025', 'Training Magazine', 8900, '6405', 'Conferences/Events', '402-Corp Marketing', 'TM Webinar', 'Programs', 'Conferences/Events', 'Dec', 'Q4', 2025, 'Actual', true),
    ];

    // --- Q1 2026 Programs ($23,230.11 from NetSuite DETAIL tab) ---
    const q1_programs = [
        // Sponge Software ($15,400) — GL 6402, dept 407-Mktg Leadership
        txn('02/28/2026', 'Sponge Software', 7700, '6402', 'Consulting', '407-Mktg Leadership', 'MOPS consulting', 'Programs', 'Consulting', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Sponge Software', 7700, '6402', 'Consulting', '407-Mktg Leadership', 'Final month MOPS', 'Programs', 'Consulting', 'Mar', 'Q1', 2026, 'Outstanding'),
        // Paperclip Promotions ($2,155.75) — GL 6405 Events
        txn('01/31/2026', 'Paperclip Promotions', 100, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Promo items', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('01/31/2026', 'Paperclip Promotions', 1081.34, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Event materials', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Paperclip Promotions', 490, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Promo items', 'Programs', 'Conferences/Events', 'Feb', 'Q1', 2026),
        txn('02/28/2026', 'Paperclip Promotions', 264.41, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Materials', 'Programs', 'Conferences/Events', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Paperclip Promotions', 220, '6405', 'Conferences/Events', '405-Community & Advocacy', 'Promo items', 'Programs', 'Conferences/Events', 'Mar', 'Q1', 2026),
        // American Express Events ($2,080.46) — GL 6405
        txn('01/31/2026', 'American Express', 1913.28, '6405', 'Conferences/Events', '402-Corp Marketing', 'Cooking class event', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'American Express', 167.18, '6405', 'Conferences/Events', '402-Corp Marketing', 'Vistaprint', 'Programs', 'Conferences/Events', 'Feb', 'Q1', 2026),
        // LinkedIn Ads ($1,906.76) — GL 6406, via AmEx
        txn('01/31/2026', 'LinkedIn Ads', 988.79, '6406', 'Advertising', '402-Corp Marketing', 'via AmEx', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'LinkedIn Ads', 917.97, '6406', 'Advertising', '402-Corp Marketing', 'via AmEx', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        // Google Ads ($1,687.14) — GL 6406, via AmEx
        txn('01/31/2026', 'Google Ads', 791.37, '6406', 'Advertising', '402-Corp Marketing', 'via AmEx', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Google Ads', 895.77, '6406', 'Advertising', '402-Corp Marketing', 'via AmEx', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
    ];

    // --- Q1 2026 T&E ($7,270.65 — single Ed Miller entry) ---
    const q1_te = [
        txn('02/15/2026', 'Ed Miller', 7270.65, '6202', 'Lodging', '400-Marketing', 'Conference lodging', 'T&E', 'Lodging', 'Feb', 'Q1', 2026),
    ];

    // --- Q1 2026 Headcount ($133,131.77 total) ---
    const q1_headcount = [
        // Jan salary entries
        txn('01/31/2026', 'Kendall Woodard', 4583.33, '6101', 'Salary', '404-Creative & Brand', 'Payroll', 'Headcount', 'Salary', 'Jan', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('01/31/2026', 'Dalton Mullins', 9356.06, '6101', 'Salary', '408-SDRs', 'Payroll - pre-reduction rate', 'Headcount', 'Salary', 'Jan', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('01/31/2026', 'Roxana Nabavian', 5964.00, '6101', 'Salary', '403-Mktg Ops', 'Contractor', 'Headcount', 'Salary', 'Jan', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('01/31/2026', 'Kate Bertram', 3120.00, '6101', 'Salary', '404-Creative & Brand', 'PT Contractor', 'Headcount', 'Salary', 'Jan', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('01/31/2026', 'Other Marketing Payroll', 21276.05, '6101', 'Salary', '400-Marketing', 'Dept payroll', 'Headcount', 'Salary', 'Jan', 'Q1', 2026),
        // Feb salary entries
        txn('02/28/2026', 'Kendall Woodard', 4583.33, '6101', 'Salary', '404-Creative & Brand', 'Payroll', 'Headcount', 'Salary', 'Feb', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('02/28/2026', 'Dalton Mullins', 2083.33, '6101', 'Salary', '408-SDRs', 'Payroll - reduced rate', 'Headcount', 'Salary', 'Feb', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('02/28/2026', 'Roxana Nabavian', 3362.00, '6101', 'Salary', '403-Mktg Ops', 'Contractor', 'Headcount', 'Salary', 'Feb', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('02/28/2026', 'Kate Bertram', 2028.00, '6101', 'Salary', '404-Creative & Brand', 'PT Contractor', 'Headcount', 'Salary', 'Feb', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('02/28/2026', 'Other Marketing Payroll', 21276.05, '6101', 'Salary', '400-Marketing', 'Dept payroll', 'Headcount', 'Salary', 'Feb', 'Q1', 2026),
        // Mar salary entries
        txn('03/31/2026', 'Kendall Woodard', 4583.33, '6101', 'Salary', '404-Creative & Brand', 'Payroll', 'Headcount', 'Salary', 'Mar', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('03/31/2026', 'Dalton Mullins', 2083.33, '6101', 'Salary', '408-SDRs', 'Payroll - reduced rate', 'Headcount', 'Salary', 'Mar', 'Q1', 2026, 'Actual', false, 'FTE'),
        txn('03/31/2026', 'Roxana Nabavian', 5964.00, '6101', 'Salary', '403-Mktg Ops', 'Contractor', 'Headcount', 'Salary', 'Mar', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('03/31/2026', 'Kate Bertram', 3120.00, '6101', 'Salary', '404-Creative & Brand', 'PT Contractor', 'Headcount', 'Salary', 'Mar', 'Q1', 2026, 'Actual', false, 'Contractor'),
        txn('03/31/2026', 'Other Marketing Payroll', 21276.04, '6101', 'Salary', '400-Marketing', 'Dept payroll', 'Headcount', 'Salary', 'Mar', 'Q1', 2026),
        // Payroll Tax ($7,264.63)
        txn('01/31/2026', 'Payroll Tax', 2421.54, '6103', 'Payroll Tax', '400-Marketing', 'Tax', 'Headcount', 'Payroll Tax', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Payroll Tax', 2421.54, '6103', 'Payroll Tax', '400-Marketing', 'Tax', 'Headcount', 'Payroll Tax', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Payroll Tax', 2421.55, '6103', 'Payroll Tax', '400-Marketing', 'Tax', 'Headcount', 'Payroll Tax', 'Mar', 'Q1', 2026),
        // Benefits ($4,844.32)
        txn('01/31/2026', 'Benefits', 1614.77, '6104', 'Benefits', '400-Marketing', 'Benefits', 'Headcount', 'Benefits', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Benefits', 1614.77, '6104', 'Benefits', '400-Marketing', 'Benefits', 'Headcount', 'Benefits', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Benefits', 1614.78, '6104', 'Benefits', '400-Marketing', 'Benefits', 'Headcount', 'Benefits', 'Mar', 'Q1', 2026),
        // Bonus ($1,666.66)
        txn('01/31/2026', 'Bonus', 555.55, '6102', 'Bonus', '400-Marketing', 'Bonus', 'Headcount', 'Bonus', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Bonus', 555.55, '6102', 'Bonus', '400-Marketing', 'Bonus', 'Headcount', 'Bonus', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Bonus', 555.56, '6102', 'Bonus', '400-Marketing', 'Bonus', 'Headcount', 'Bonus', 'Mar', 'Q1', 2026),
        // Commissions ($4,697.31)
        txn('01/31/2026', 'Commissions', 1565.77, '6105', 'Commissions', '400-Marketing', 'Commissions', 'Headcount', 'Commissions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Commissions', 1565.77, '6105', 'Commissions', '400-Marketing', 'Commissions', 'Headcount', 'Commissions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Commissions', 1565.77, '6105', 'Commissions', '400-Marketing', 'Commissions', 'Headcount', 'Commissions', 'Mar', 'Q1', 2026),
    ];

    // --- Q1 2026 Outside Envelope ($66,751.39) ---
    const q1_outside = [
        // SW Amortization — GL 6303 ($33,411.29)
        txn('01/31/2026', 'Salesforce', 2915.00, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM amortization', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Salesforce', 2915.00, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM amortization', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Salesforce', 2915.00, '6303', 'Software Subscriptions', '403-Mktg Ops', 'CRM amortization', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('01/31/2026', 'Outreach/LinkedIn Nav', 1828.67, '6303', 'Software Subscriptions', '403-Mktg Ops', 'SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Outreach/LinkedIn Nav', 1828.67, '6303', 'Software Subscriptions', '403-Mktg Ops', 'SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Outreach/LinkedIn Nav', 1828.66, '6303', 'Software Subscriptions', '403-Mktg Ops', 'SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('01/31/2026', 'HubSpot', 929.01, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing Hub amortization', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'HubSpot', 929.01, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing Hub amortization', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'HubSpot', 929.00, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Marketing Hub amortization', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('01/31/2026', 'ZoomInfo', 844.67, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Data amortization', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'ZoomInfo', 844.67, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Data amortization', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'ZoomInfo', 844.66, '6303', 'Software Subscriptions', '403-Mktg Ops', 'Data amortization', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        txn('01/31/2026', 'Other SW', 4619.76, '6303', 'Software Subscriptions', '400-Marketing', 'Misc SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Jan', 'Q1', 2026),
        txn('02/28/2026', 'Other SW', 4619.76, '6303', 'Software Subscriptions', '400-Marketing', 'Misc SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Feb', 'Q1', 2026),
        txn('03/31/2026', 'Other SW', 4619.77, '6303', 'Software Subscriptions', '400-Marketing', 'Misc SW amortization', 'Outside Envelope', 'Software Subscriptions', 'Mar', 'Q1', 2026),
        // Prepaid — GL 6309 ($33,340.10)
        txn('01/15/2026', 'ZoomInfo', 20000, '6309', 'Prepaid', '403-Mktg Ops', 'Annual prepaid', 'Outside Envelope', 'Prepaid', 'Jan', 'Q1', 2026),
        txn('01/15/2026', 'HubSpot', 13340.10, '6309', 'Prepaid', '403-Mktg Ops', 'Annual prepaid', 'Outside Envelope', 'Prepaid', 'Jan', 'Q1', 2026),
    ];

    appState.transactions = [...q4_2025, ...q1_programs, ...q1_te, ...q1_headcount, ...q1_outside];
    appState.budget = [
        { category: 'Headcount', annual: 336000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 28000; return o; }, {}) },
        { category: 'Programs', annual: 90000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 7500; return o; }, {}) },
        { category: 'T&E', annual: 20000, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 1666.67; return o; }, {}) },
        { category: 'Outside Envelope', annual: 0, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 0; return o; }, {}) },
        { category: 'TOTAL', annual: 446914, months: CONFIG.MONTHS.reduce((o, m) => { o[m] = 37166.67; return o; }, {}) },
    ];
    // REFERENCE tab — real vendor contract data ($392,580 before → $178,957 after = $213,623 savings)
    appState.vendorContracts = [
        { vendor: 'Sponge Software', before: 92400, after: 0, savings: 92400, savingsPct: '100%', category: 'Agency', status: 'Terminated', notes: 'Final month Q1 2026', in446k: false, contractEnd: '2026-03-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Salesforce', before: 95380, after: 65563, savings: 29817, savingsPct: '31.3%', category: 'CRM', status: 'Renewed', notes: '12mo deal through Jan 2027', in446k: false, contractEnd: '2027-01-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'ZoomInfo', before: 92000, after: 48000, savings: 44000, savingsPct: '47.8%', category: 'Data', status: 'Renegotiated', notes: '$20K prepaid Q1. Through ~Mar 2027', in446k: false, contractEnd: '2027-03-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'HubSpot', before: 50340, after: 50340, savings: 0, savingsPct: '0%', category: 'Marketing Automation', status: 'Upcoming', notes: 'Renewal ~Jun 2026. TARGET: negotiate down', in446k: false, contractEnd: '2026-06-30', renegDate: '2026-06-01', newTargetAnnual: null },
        { vendor: 'LinkedIn Sales Nav', before: 22642, after: 0, savings: 22642, savingsPct: '100%', category: 'Sales Tool', status: 'Winding Down', notes: 'Terminate June. Unpaid balance.', in446k: false, contractEnd: '2026-06-30', renegDate: null, newTargetAnnual: null },
        { vendor: 'Outreach', before: 15054, after: 15054, savings: 0, savingsPct: '0%', category: 'Sales Engagement', status: 'Upcoming', notes: 'Review at renewal', in446k: false, contractEnd: '2026-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Wrike', before: 8460, after: 0, savings: 8460, savingsPct: '100%', category: 'PM Tool', status: 'Cancelled', notes: 'Eliminated, migrated off', in446k: false, contractEnd: '2025-12-31', renegDate: null, newTargetAnnual: null },
        { vendor: 'Bynder', before: 16304, after: 0, savings: 16304, savingsPct: '100%', category: 'DAM', status: 'Cancelled', notes: 'No longer needed', in446k: false, contractEnd: '2025-12-31', renegDate: null, newTargetAnnual: null },
    ];
    // Legacy vendorBudgets kept for allocation chart compat — vendorMonthly is the source of truth
    appState.vendorBudgets = appState.vendorMonthly.filter(vm => vm.category === 'Programs').map(vm => ({
        vendor: vm.vendor, subcategory: vm.subcategory, category: vm.category,
        q1: (vm.jan||0)+(vm.feb||0)+(vm.mar||0), q2: (vm.apr||0)+(vm.may||0)+(vm.jun||0),
        q3: (vm.jul||0)+(vm.aug||0)+(vm.sep||0), q4: (vm.oct||0)+(vm.nov||0)+(vm.dec||0),
        notes: vm.notes || ''
    }));
    // vendorMonthly: one row per vendor, monthly plan values
    // Sources: 2026 Field Marketing Budget Tracker.xlsx (TOTALS + event tabs) + Marketing Retro PPTX (Q2 confirmed items)
    appState.vendorMonthly = [
        // ── Programs — Advertising (recurring) ──
        { vendor: 'LinkedIn Ads', subcategory: 'Advertising', category: 'Programs',
          oct25: 950, nov25: 950, dec25: 950,
          jan: 950, feb: 950, mar: 950, apr: 950, may: 950, jun: 950,
          jul: 950, aug: 950, sep: 950, oct: 950, nov: 950, dec: 950, notes: '' },
        { vendor: 'Google Ads', subcategory: 'Advertising', category: 'Programs',
          oct25: 850, nov25: 850, dec25: 850,
          jan: 850, feb: 850, mar: 850, apr: 850, may: 850, jun: 850,
          jul: 850, aug: 850, sep: 850, oct: 850, nov: 850, dec: 850, notes: '' },
        // ── Programs — Events (recurring materials) ──
        { vendor: 'Paperclip Promotions', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 450, dec25: 500,
          jan: 300, feb: 300, mar: 300, apr: 300, may: 300, jun: 300,
          jul: 300, aug: 300, sep: 300, oct: 300, nov: 300, dec: 300, notes: 'Event materials ~$300/mo' },
        { vendor: 'American Express', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Events via AmEx card' },
        // ── Programs — Events (Q2 confirmed) — from PPTX + Excel TOTALS ──
        { vendor: 'Docebo Inspire', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 25000, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Apr 20-22, Miami. $250 actual so far' },
        { vendor: 'ATD Conference', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 9000, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'May 17-20, Los Angeles. Confirmed' },
        { vendor: 'Bb Durham TLC', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 1800, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'INTL. Budget $1,800' },
        { vendor: 'Class Day Spain', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 2000,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'INTL reseller event (eLearnia)' },
        { vendor: 'Class Day Germany', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 2000,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'INTL reseller event' },
        // ── Programs — Events (Q2 draft / on hold) ──
        { vendor: 'ASU+GSV Summit', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 30000, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Draft — estimate, not in TOTALS budget', isDraft: true },
        { vendor: 'Class Day Nairobi', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 1500, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Draft — On Hold as of 11/3', isDraft: true },
        { vendor: 'Cornerstone Spark', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Draft — Q2, costs TBD', isDraft: true },
        // ── Programs — Events (Q3) ──
        { vendor: 'Class Day Italy', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 1500, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'INTL reseller event' },
        { vendor: 'Bb Together User Conference', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 1000, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'BD. TBC costs w/ Russell' },
        { vendor: 'D2L Fusion', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 24350, oct: 0, nov: 0, dec: 0, notes: 'Draft — estimate from event tab', isDraft: true },
        { vendor: 'Class Day Dubai', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 2000, oct: 0, nov: 0, dec: 0, notes: 'Draft — may not take place', isDraft: true },
        // ── Programs — Events (Q4) ──
        { vendor: 'DevLearn', subcategory: 'Events', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 12000, nov: 0, dec: 0, notes: 'Corp. Budget $12,000' },
        // ── Programs — Mktg Ops ──
        { vendor: 'Sponge Software', subcategory: 'Mktg Ops', category: 'Programs',
          oct25: 6500, nov25: 6500, dec25: 6500,
          jan: 0, feb: 7700, mar: 7700, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Terminated after Q1' },
        // ── Programs — Webinars ──
        { vendor: 'TM Sponsored Webinar', subcategory: 'Webinars', category: 'Programs',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 9000, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Training Magazine — confirmed Q2, $9K' },
        // ── T&E ──
        { vendor: 'Ed Miller', subcategory: 'Lodging', category: 'T&E',
          oct25: 0, nov25: 0, dec25: 0,
          jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
          jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: 'Conference lodging' },
    ];
    appState.config = {
        total_budget: '446914', headcount_budget: '336000', programs_budget: '90000', te_budget: '20000',
        company_sw_budget: '871560', marketing_sw_savings: '213623', sw_savings_pct: '24.5%',
        fiscal_year: '2026', budget_basis: 'salary_only_pending_clarification',
        kate_bertram_type: 'PT Contractor - no loaded-cost', sponge_outstanding: '7700',
        netsuite_last_refresh: '2026-03-31',
        programs_budget_original: '180000', programs_budget_note: 'Reduced from $180K to $90K mid-Q1 to fund Kendall retention (+$100K headcount)'
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

    // Forecast from vendorMonthly (future months planned spend)
    c.forecast = { total: 0, headcount: 0, programs: 0, te: 0 };
    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    appState.vendorMonthly.forEach(vm => {
        if (appState.disabledVendors[vm.vendor]) return;
        let vendorForecast = 0;
        MONTH_KEYS.forEach((mk, mi) => {
            if (mi > curMonthIdx && (vm[mk] || 0) > 0) vendorForecast += vm[mk];
        });
        if (vm.category === 'Headcount') c.forecast.headcount += vendorForecast;
        else if (vm.category === 'Programs') c.forecast.programs += vendorForecast;
        else if (vm.category === 'T&E') c.forecast.te += vendorForecast;
    });
    c.forecast.total = c.forecast.headcount + c.forecast.programs + c.forecast.te;

    // Calculate disabled vendor budget impact (future months freed up)
    let disabledBudgetDelta = 0;
    Object.keys(appState.disabledVendors).forEach(vendor => {
        if (!appState.disabledVendors[vendor]) return;
        const vm = appState.vendorMonthly.find(v => v.vendor === vendor);
        if (vm) {
            MONTH_KEYS.forEach((mk, mi) => {
                if (mi > curMonthIdx) disabledBudgetDelta += (vm[mk] || 0);
            });
        }
    });

    c.available = {
        headcount: CONFIG.BUDGET.headcount - c.ytdActual.headcount - outstandingHC - c.forecast.headcount,
        programs: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs + disabledBudgetDelta,
        te: CONFIG.BUDGET.te - c.ytdActual.te - outstandingTE - c.forecast.te, total: 0
    };
    c.available.total = c.available.headcount + c.available.programs + c.available.te;
    c.programsWaterfall = {
        budget: CONFIG.BUDGET.programs, spent: c.ytdActual.programs, outstanding: outstandingPrograms,
        committed: c.forecast.programs,
        available: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs + disabledBudgetDelta
    };

    // Per-month actuals
    c.byMonth = {};
    CONFIG.MONTHS.forEach(m => { c.byMonth[m] = { headcount: 0, programs: 0, te: 0, outside: 0, total: 0 }; });
    tx2026.forEach(t => {
        if (!c.byMonth[t.month]) return;
        const cat = t.category === 'Headcount' ? 'headcount' : t.category === 'Programs' ? 'programs' : t.category === 'T&E' ? 'te' : 'outside';
        c.byMonth[t.month][cat] += t.amount;
        if (cat !== 'outside') c.byMonth[t.month].total += t.amount;
    });

    // Aggregate indexes
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

    // SW forecast trajectory
    const swResult = computeSWForecast();
    c.swCurrentAnnual = appState.vendorContracts.reduce((s, v) => s + v.after, 0);
    c.swModeledAnnual = swResult.proposedLine.reduce((s, v) => s + v, 0);
    c.swTotalSavings = appState.vendorContracts.reduce((s, v) => s + v.savings, 0);
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
    const renderers = {
        dashboard: renderDashboard,
        budget: renderCalendar,
        expenses: renderExpenses,
        software: renderSoftware
    };
    const fn = renderers[appState.activeTab];
    if (fn) fn();
}

// ============================================================
// 12. THEME / PRESENTATION / FRESHNESS
// ============================================================
function cycleTheme() {
    const themes = ['', 'high-contrast'];
    appState.theme = themes[(themes.indexOf(appState.theme) + 1) % themes.length];
    document.documentElement.setAttribute('data-theme', appState.theme);
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
    } else if (field === 'category') {
        input = document.createElement('select');
        input.className = 'cell-editor';
        ['Headcount', 'Programs', 'T&E', 'Outside Envelope'].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; if (rawValue === v) o.selected = true; input.appendChild(o); });
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
    // Capture scroll position
    const scrollEl = document.querySelector('.table-scroll') || document.querySelector('.calendar-container');
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;

    if (coll === 'vendors') {
        const vendor = appState.vendorContracts[edit.rowId];
        if (!vendor) { cancelCellEdit(); return; }
        if (edit.field === 'amount' || edit.field === 'before' || edit.field === 'after' || edit.field === 'newTargetAnnual') {
            vendor[edit.field] = parseFloat(newValue) || 0;
            if (edit.field === 'before' || edit.field === 'after') vendor.savings = vendor.before - vendor.after;
        } else if (edit.field === 'renegDate') {
            vendor.renegDate = newValue || null;
        } else if (edit.field === 'newTargetAnnual') {
            vendor.newTargetAnnual = parseFloat(newValue) || null;
        } else {
            vendor[edit.field] = newValue;
        }
    } else {
        const tx = appState.transactions.find(t => t._row === edit.rowId);
        if (!tx) { cancelCellEdit(); return; }
        if (edit.field === 'amount') tx.amount = parseFloat(newValue) || 0;
        else if (edit.field === 'category') {
            tx.category = newValue;
            const subMap = CONFIG.SUBCATEGORIES[newValue];
            if (subMap && subMap.length > 0) tx.subcategory = subMap[0];
        } else if (edit.field === 'gl') {
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
    // Restore scroll
    requestAnimationFrame(() => {
        const el = document.querySelector('.table-scroll') || document.querySelector('.calendar-container');
        if (el) { el.scrollTop = scrollTop; el.scrollLeft = scrollLeft; }
    });
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
    const tePct = CONFIG.BUDGET.te > 0 ? c.ytdActual.te / CONFIG.BUDGET.te : 0;
    const totalSavings = appState.vendorContracts.reduce((s, v) => s + v.savings, 0);

    let html = '<div class="kpi-grid">';
    // Hero: Programs Available for New Spend
    const pctRemaining = wf.budget > 0 ? (wf.available / wf.budget) : 0;
    html += `<div class="kpi-card hero ${wf.available < 10000 ? 'warning' : 'positive'}"><div class="kpi-label">Programs Available for New Spend</div><div class="kpi-value">${fmtWhole(wf.available)}</div><div class="kpi-progress"><div class="kpi-progress-bar ${progressColor(progPct)}" style="width:${Math.min(progPct * 100, 100)}%"></div></div><div class="kpi-subtext">${fmtPct(pctRemaining)} of ${fmtWhole(wf.budget)} remaining after actuals + commitments</div></div>`;
    // Programs Q1 with pacing (includes outstanding items like Sponge $7,700)
    const totalProgramsQ1 = c.ytdActual.programs + c.outstandingItems.filter(t => t.category === 'Programs').reduce((s, t) => s + t.amount, 0);
    const progAnnualPace = totalProgramsQ1 * 4;
    const progPaceWarning = progAnnualPace > CONFIG.BUDGET.programs;
    html += `<div class="kpi-card"><div class="kpi-label">Programs Q1</div><div class="kpi-value">${fmtWhole(totalProgramsQ1)}</div><div class="kpi-trend ${progPaceWarning ? 'negative' : 'neutral'}" style="color:${progPaceWarning ? 'var(--color-warning)' : ''}">Pacing at ${fmtWhole(progAnnualPace)}/yr</div></div>`;
    // T&E Q1 with pacing
    const teAnnualPace = c.ytdActual.te * 4;
    const tePaceWarning = teAnnualPace > CONFIG.BUDGET.te;
    html += `<div class="kpi-card ${tePct > 0.5 ? 'warning' : ''}"><div class="kpi-label">T&E Q1</div><div class="kpi-value">${fmtWhole(c.ytdActual.te)}</div><div class="kpi-trend ${tePaceWarning ? 'negative' : 'neutral'}" style="color:${tePaceWarning ? 'var(--color-negative)' : ''}">Pacing at ${fmtWhole(teAnnualPace)}/yr</div></div>`;
    // Headcount (Loaded)
    if (showHC) {
        html += `<div class="kpi-card"><div class="kpi-label">Headcount (Loaded)</div><div class="kpi-value">${fmtWhole(c.ytdActual.headcount)}</div><div class="kpi-trend neutral">Budget is salary-only (${fmtWhole(CONFIG.BUDGET.headcount)})</div></div>`;
    }
    // SW Savings Driven
    html += `<div class="kpi-card positive"><div class="kpi-label">SW Savings Driven</div><div class="kpi-value">${fmtWhole(totalSavings)}</div><div class="kpi-trend positive">Annual, outside the $446K envelope</div></div>`;
    html += '</div>';

    // Charts row 1: Monthly Stacked + Cumulative
    html += '<div class="chart-grid">';
    html += `<div class="chart-card"><div class="chart-title">Monthly Spend (Programs + T&E)</div><div class="chart-wrapper"><canvas id="monthlyStackChart"></canvas></div></div>`;
    html += `<div class="chart-card"><div class="chart-title">Cumulative vs Budget Pace</div><div class="chart-wrapper"><canvas id="cumulativeChart"></canvas></div></div>`;
    html += '</div>';

    // Charts row 2: Utilization Gauges + Allocation
    html += '<div class="chart-grid">';
    html += `<div class="chart-card"><div class="chart-title">Category Utilization</div><div class="chart-wrapper"><canvas id="utilizationChart"></canvas></div></div>`;
    html += `<div class="chart-card"><div class="chart-title">Programs Allocation by Subcategory</div><div class="chart-wrapper"><canvas id="allocationChart"></canvas></div></div>`;
    html += '</div>';

    // Assumptions panel — structured notes (matches mockup)
    html += '<div class="section-card"><details class="assumptions-panel" open><summary>Budget Assumptions &amp; Notes</summary><div class="assumptions-notes">';
    html += '<div class="assumption-note"><span class="assumption-label">Programs budget adjusted</span><span class="assumption-detail">$180K reduced to $90K mid-Q1 to fund Kendall retention (+$100K headcount)</span></div>';
    html += '<div class="assumption-note"><span class="assumption-label">Headcount basis</span><span class="assumption-detail">$336K budget is salary-only. Q1 actual includes tax, benefits, bonus, commissions</span></div>';
    html += '<div class="assumption-note"><span class="assumption-label">Outside Envelope</span><span class="assumption-detail">' + fmtWhole(c.ytdActual.outside) + ' in SW subscriptions sits in GL 6303, not in the $446K marketing budget</span></div>';
    html += '<div class="assumption-note"><span class="assumption-label">Sponge Software</span><span class="assumption-detail">Terminated after Q1. $15,400 in Q1 was final spend. $0 from Q2 forward.</span></div>';
    html += '<div class="assumption-note"><span class="assumption-label">Kate Bertram</span><span class="assumption-detail">PT Contractor — no fully-loaded cost multiplier applied</span></div>';
    html += '<div class="assumption-note"><span class="assumption-label">T&E overpace</span><span class="assumption-detail">Ed Miller conference lodging (' + fmtWhole(c.ytdActual.te) + ') is a one-time Q1 event, not a recurring run rate</span></div>';
    html += '</div></details></div>';

    el.innerHTML = html;
    renderDashboardCharts();
}

function renderDashboardCharts() {
    destroyChart('monthlyStack'); destroyChart('cumulative'); destroyChart('utilization'); destroyChart('allocation');
    const c = appState.computed;
    const textColor = '#0A1849';
    const gridColor = 'rgba(0,0,0,0.06)';
    const fontOpts = { family: "'Inter', sans-serif", size: 10 };
    const curIdx = getCurrentMonthIdx();

    // 1. Monthly Stacked Bars (Programs + T&E)
    const stackCtx = document.getElementById('monthlyStackChart');
    if (stackCtx) {
        const progData = CONFIG.MONTHS.map(m => c.byMonth[m] ? c.byMonth[m].programs : 0);
        const teData = CONFIG.MONTHS.map(m => c.byMonth[m] ? c.byMonth[m].te : 0);
        appState.charts.monthlyStack = new Chart(stackCtx, {
            type: 'bar',
            data: { labels: CONFIG.MONTHS, datasets: [
                { label: 'Programs', data: progData, backgroundColor: 'rgba(71,57,231,0.7)', borderRadius: 2 },
                { label: 'T&E', data: teData, backgroundColor: 'rgba(255,186,0,0.7)', borderRadius: 2 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } } }, scales: { x: { stacked: true, ticks: { font: fontOpts, color: textColor }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } } } }
        });
    }

    // 2. Cumulative vs Pace (with forecast line extending through Q4)
    const cumCtx = document.getElementById('cumulativeChart');
    if (cumCtx) {
        const actualCum = []; const forecastCum = []; const paceLine = [];
        let runTotal = 0;
        const monthlyBudget = (CONFIG.BUDGET.programs + CONFIG.BUDGET.te) / 12;
        // Monthly committed forecast (Programs + T&E, from vendorMonthly)
        const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        CONFIG.MONTHS.forEach((m, i) => {
            const mTotal = c.byMonth[m] ? c.byMonth[m].programs + c.byMonth[m].te : 0;
            if (i <= curIdx && mTotal > 0) { runTotal += mTotal; actualCum.push(runTotal); }
            else actualCum.push(null);
            paceLine.push(monthlyBudget * (i + 1));
        });
        // Forecast line: continues from last actual month through Dec using vendorMonthly
        let fcRunTotal = runTotal;
        CONFIG.MONTHS.forEach((m, i) => {
            if (i <= curIdx) { forecastCum.push(null); }
            else {
                const mk = MONTH_KEYS[i];
                const monthForecast = appState.vendorMonthly.filter(vm => (vm.category === 'Programs' || vm.category === 'T&E') && !appState.disabledVendors[vm.vendor]).reduce((s, vm) => s + (vm[mk] || 0), 0);
                fcRunTotal += monthForecast;
                forecastCum.push(fcRunTotal);
            }
        });
        // Connect forecast to last actual point
        if (curIdx >= 0 && curIdx < 11) forecastCum[curIdx] = runTotal;
        appState.charts.cumulative = new Chart(cumCtx, {
            type: 'line',
            data: { labels: CONFIG.MONTHS, datasets: [
                { label: 'Actual', data: actualCum, borderColor: 'rgba(71,57,231,1)', backgroundColor: 'rgba(71,57,231,0.08)', fill: true, tension: 0.3, pointRadius: 4, spanGaps: false },
                { label: 'Forecast', data: forecastCum, borderColor: 'rgba(107,114,128,0.5)', borderDash: [4, 4], backgroundColor: 'rgba(107,114,128,0.04)', fill: true, tension: 0.3, pointRadius: 2, spanGaps: false },
                { label: 'Budget Pace', data: paceLine, borderColor: 'rgba(5,150,105,0.6)', borderDash: [8, 4], pointRadius: 0, fill: false, tension: 0 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } }, x: { ticks: { font: fontOpts, color: textColor }, grid: { display: false } } } }
        });
    }

    // 3. Utilization Gauges (half-doughnut)
    const utilCtx = document.getElementById('utilizationChart');
    if (utilCtx) {
        const progUsed = c.ytdActual.programs + (c.outstandingItems.filter(t => t.category === 'Programs').reduce((s, t) => s + t.amount, 0));
        const progPct = CONFIG.BUDGET.programs > 0 ? progUsed / CONFIG.BUDGET.programs : 0;
        const teUsed = c.ytdActual.te;
        const tePctVal = CONFIG.BUDGET.te > 0 ? teUsed / CONFIG.BUDGET.te : 0;
        appState.charts.utilization = new Chart(utilCtx, {
            type: 'doughnut',
            data: { labels: ['Programs Used', 'Programs Remaining', 'T&E Used', 'T&E Remaining'], datasets: [
                { data: [Math.min(progPct, 1) * 100, Math.max(1 - progPct, 0) * 100], backgroundColor: ['rgba(71,57,231,0.8)', 'rgba(71,57,231,0.1)'], circumference: 180, rotation: 270, borderWidth: 0 },
                { data: [Math.min(tePctVal, 1) * 100, Math.max(1 - tePctVal, 0) * 100], backgroundColor: ['rgba(255,186,0,0.8)', 'rgba(255,186,0,0.1)'], circumference: 180, rotation: 270, borderWidth: 0 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw.toFixed(1) + '%' } } } }
        });
    }

    // 4. Programs Budget Allocation by Subcategory (Actuals + Future Plan from vendorMonthly)
    const allocCtx = document.getElementById('allocationChart');
    if (allocCtx) {
        const allocMK = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const subActuals = {};
        const subFuturePlan = {};
        // Future months from vendorMonthly
        appState.vendorMonthly.filter(vm => vm.category === 'Programs').forEach(vm => {
            const sub = vm.subcategory || 'Other';
            if (!subFuturePlan[sub]) subFuturePlan[sub] = 0;
            allocMK.forEach((mk, mi) => { if (mi > curIdx) subFuturePlan[sub] += (vm[mk] || 0); });
        });
        // Past-month actuals mapped via vendorMonthly subcategories
        const progTx = appState.transactions.filter(t => t.year === 2026 && t.category === 'Programs');
        appState.vendorMonthly.filter(vm => vm.category === 'Programs').forEach(vm => {
            const sub = vm.subcategory;
            if (!subActuals[sub]) subActuals[sub] = 0;
            progTx.filter(t => matchVendor(vm.vendor, t.vendor)).forEach(t => { subActuals[sub] += t.amount; });
        });
        // Unmatched actuals
        const matchedVendors = appState.vendorMonthly.filter(vm => vm.category === 'Programs').map(vm => vm.vendor);
        progTx.filter(t => !matchedVendors.some(mv => matchVendor(mv, t.vendor))).forEach(t => {
            const sub = t.subcategory || 'Other';
            if (!subActuals[sub]) subActuals[sub] = 0;
            subActuals[sub] += t.amount;
        });
        const allSubs = [...new Set([...Object.keys(subActuals), ...Object.keys(subFuturePlan)])].sort();
        const actualData = allSubs.map(s => subActuals[s] || 0);
        const planData = allSubs.map(s => subFuturePlan[s] || 0);
        appState.charts.allocation = new Chart(allocCtx, {
            type: 'bar',
            data: { labels: allSubs, datasets: [
                { label: 'YTD Actual', data: actualData, backgroundColor: 'rgba(71,57,231,0.7)', borderRadius: 2 },
                { label: 'Future Plan', data: planData, backgroundColor: 'rgba(71,57,231,0.15)', borderRadius: 2 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } } }, scales: { x: { stacked: true, ticks: { font: fontOpts, color: textColor }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } } } }
        });
    }
}
function destroyChart(name) { if (appState.charts[name]) { appState.charts[name].destroy(); appState.charts[name] = null; } }

// ============================================================
// 16. BUDGET TAB — MONTHLY SPREADSHEET
// ============================================================
function renderCalendar() {
    const el = document.getElementById('tab-budget');
    if (appState.calendarMonth) {
        el.innerHTML = renderCalendarMonthly();
    } else {
        el.innerHTML = renderMonthlySpreadsheet();
    }
}

function renderMonthlySpreadsheet() {
    const tx = getFilteredTransactions();
    const showHC = isHeadcountVisible();
    const cats = showHC ? ['Programs', 'T&E', 'Headcount', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const isPres = appState.presentationMode;
    const curMonthIdx = getCurrentMonthIdx();
    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const Q4_KEYS = ['oct25','nov25','dec25'];
    const Q4_LABELS = ["Oct'25","Nov'25","Dec'25"];
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tx2026 = tx.filter(t => t.year === 2026);
    const q4tx = tx.filter(t => t.year === 2025 && t.quarter === 'Q4');

    // Helper: sum actual transactions for a vendor in a given month (2026)
    function actualForVendorMonth(vendorName, monthLabel) {
        return tx2026.filter(t => matchVendor(vendorName, t.vendor) && t.month === monthLabel).reduce((s, t) => s + t.amount, 0);
    }
    // Helper: sum Q4'25 transactions for a vendor in a given Q4 month
    function q4ForVendorMonth(vendorName, q4Month) {
        const monthMap = { oct25: 'Oct', nov25: 'Nov', dec25: 'Dec' };
        return q4tx.filter(t => matchVendor(vendorName, t.vendor) && t.month === monthMap[q4Month]).reduce((s, t) => s + t.amount, 0);
    }

    // Toolbar
    let html = '<div class="zoom-bar">';
    html += '<span style="font-size:11px;color:var(--text-muted)">Click any month header to see transaction detail</span>';
    html += '<div style="margin-left:auto;display:flex;gap:6px">';
    html += '<button class="zoom-btn" onclick="calExpandAll()">Expand All</button>';
    html += '<button class="zoom-btn" onclick="calCollapseAll()">Collapse All</button>';
    html += '</div></div>';

    // Table header
    html += '<div class="calendar-container"><table class="calendar-table"><thead><tr>';
    html += '<th class="row-label sticky-col-toggle" style="min-width:28px"></th>';
    html += '<th class="row-label sticky-col-name">Category / Vendor</th>';
    // Q4'25 columns (muted)
    Q4_LABELS.forEach((lbl, i) => {
        const sepCls = i === 0 ? 'q-sep' : '';
        html += `<th class="num cell q4-ref ${sepCls}" style="opacity:0.5;font-size:10px">${lbl}</th>`;
    });
    // 2026 month columns
    MONTH_LABELS.forEach((lbl, mi) => {
        const isCur = mi === curMonthIdx;
        const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
        const sepCls = isQBoundary ? 'q-sep' : '';
        html += `<th class="num cal-zoom-header cell ${sepCls} ${isCur ? 'current-month' : ''}" onclick="calZoomTo('monthly','${lbl}')" style="font-size:10px">${lbl}</th>`;
    });
    // Summary columns
    html += '<th class="num ann-col q-sep cell" style="font-size:9px;font-weight:400">Annual</th>';
    html += '<th class="num ann-col cell" style="font-size:9px;font-weight:400">Budget</th>';
    html += '<th class="num cell q-sep" style="font-size:9px;font-weight:400">Var</th>';
    html += '<th class="num cell" style="font-size:9px;font-weight:400">%</th>';
    html += '</tr></thead><tbody>';

    let grandAnnual = 0, grandBudget = 0;

    cats.forEach(cat => {
        const isCollapsed = appState.calendarCollapsed[cat];
        const inGrandTotal = (cat === 'Programs' || cat === 'T&E');
        const catVMs = appState.vendorMonthly.filter(vm => vm.category === cat);
        const catTx = tx2026.filter(t => t.category === cat);
        const budgetRow = appState.budget.find(b => b.category === cat);
        const catBudgetAnn = budgetRow ? budgetRow.annual : 0;

        // Compute category monthly totals
        let catAnnualTotal = 0;
        const catMonthTotals = MONTH_KEYS.map((mk, mi) => {
            const monthLabel = MONTH_LABELS[mi];
            const isPast = mi <= curMonthIdx;
            // Sum from transactions for past months, from vendorMonthly for future
            let monthVal = 0;
            if (isPast) {
                monthVal = catTx.filter(t => t.month === monthLabel).reduce((s, t) => s + t.amount, 0);
            } else {
                monthVal = catVMs.filter(vm => !appState.disabledVendors[vm.vendor]).reduce((s, vm) => s + (vm[mk] || 0), 0);
            }
            catAnnualTotal += monthVal;
            return monthVal;
        });

        // Category header row
        html += `<tr class="category-row"><td class="row-label-cell sticky-col-toggle"></td>`;
        html += `<td class="row-label-cell sticky-col-name"><span class="cal-category-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="calToggleCategory('${esc(cat)}')">${esc(cat)}</span></td>`;
        // Q4'25 totals
        Q4_KEYS.forEach((qk, qi) => {
            const monthMap = { oct25: 'Oct', nov25: 'Nov', dec25: 'Dec' };
            const q4Val = q4tx.filter(t => t.category === cat && t.month === monthMap[qk]).reduce((s, t) => s + t.amount, 0);
            html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.5">${q4Val ? fmtWhole(q4Val) : ''}</td>`;
        });
        // 2026 months
        catMonthTotals.forEach((val, mi) => {
            const isPast = mi <= curMonthIdx;
            const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
            const sepCls = isQBoundary ? 'q-sep' : '';
            const cellCls = isPast ? 'act' : 'forecast-cell';
            html += `<td class="num cell ${sepCls} ${cellCls}">${val ? fmtWhole(val) : ''}</td>`;
        });
        // Summary
        const catVariance = catBudgetAnn - catAnnualTotal;
        const catPctUsed = catBudgetAnn > 0 ? catAnnualTotal / catBudgetAnn : 0;
        html += `<td class="num ann-col q-sep cell">${catAnnualTotal ? fmtWhole(catAnnualTotal) : ''}</td>`;
        html += `<td class="num ann-col cell">${catBudgetAnn ? fmtWhole(catBudgetAnn) : ''}</td>`;
        html += `<td class="num cell q-sep ${catVariance >= 0 ? 'cal-variance-pos' : 'cal-variance-neg'}">${catBudgetAnn ? fmtWhole(catVariance) : ''}</td>`;
        html += `<td class="num cell ${pctClass(catPctUsed)}">${catBudgetAnn ? fmtPct(catPctUsed) : ''}</td></tr>`;

        if (inGrandTotal) { grandAnnual += catAnnualTotal; grandBudget += catBudgetAnn; }

        if (isCollapsed) return;

        // Group vendors by subcategory for Programs
        if (cat === 'Programs') {
            const subs = {};
            catVMs.forEach(vm => {
                const sub = vm.subcategory || 'Other';
                if (!subs[sub]) subs[sub] = [];
                subs[sub].push(vm);
            });
            Object.entries(subs).sort(([a], [b]) => a.localeCompare(b)).forEach(([sub, vendors]) => {
                // Subcategory header
                let subAnnual = 0;
                html += `<tr class="subcategory-row"><td class="sticky-col-toggle"></td><td class="row-label-cell sticky-col-name">${esc(sub)}</td>`;
                Q4_KEYS.forEach((qk, qi) => {
                    const monthMap = { oct25: 'Oct', nov25: 'Nov', dec25: 'Dec' };
                    const q4Val = vendors.reduce((s, vm) => s + q4ForVendorMonth(vm.vendor, qk), 0);
                    html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.4">${q4Val ? fmtWhole(q4Val) : ''}</td>`;
                });
                MONTH_KEYS.forEach((mk, mi) => {
                    const monthLabel = MONTH_LABELS[mi];
                    const isPast = mi <= curMonthIdx;
                    const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
                    let val = 0;
                    vendors.forEach(vm => {
                        if (isPast) val += actualForVendorMonth(vm.vendor, monthLabel);
                        else if (!appState.disabledVendors[vm.vendor]) val += (vm[mk] || 0);
                    });
                    subAnnual += val;
                    html += `<td class="num cell ${isQBoundary ? 'q-sep' : ''} ${isPast ? '' : 'forecast-cell'}">${val ? fmtWhole(val) : ''}</td>`;
                });
                html += `<td class="num ann-col q-sep cell">${subAnnual ? fmtWhole(subAnnual) : ''}</td><td class="num ann-col cell"></td><td class="num cell q-sep"></td><td class="num cell"></td></tr>`;

                // Vendor rows
                vendors.forEach(vm => {
                    html += renderVendorMonthlyRow(vm, catTx, q4tx, curMonthIdx, isPres);
                });
            });

            // Unmatched vendors (transactions with no vendorMonthly entry)
            const matchedVendors = catVMs.map(vm => vm.vendor);
            const unmatchedTx = catTx.filter(t => !matchedVendors.some(mv => matchVendor(mv, t.vendor)));
            if (unmatchedTx.length > 0) {
                const uVendors = {};
                unmatchedTx.forEach(t => { const v = t.vendor || 'Other'; if (!uVendors[v]) uVendors[v] = []; uVendors[v].push(t); });
                Object.entries(uVendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([vendor, vtx]) => {
                    let vAnnual = 0;
                    html += `<tr class="vendor-row"><td class="sticky-col-toggle"></td><td class="row-label-cell sticky-col-name" style="padding-left:34px">${esc(vendor)}</td>`;
                    Q4_KEYS.forEach((qk, qi) => html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.4"></td>`);
                    MONTH_KEYS.forEach((mk, mi) => {
                        const mLabel = MONTH_LABELS[mi];
                        const val = vtx.filter(t => t.month === mLabel).reduce((s, t) => s + t.amount, 0);
                        const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
                        vAnnual += val;
                        html += `<td class="num clickable cell ${isQBoundary ? 'q-sep' : ''}" onclick="drillCalendarVendor('${esc(vendor)}','${mLabel}')" style="font-size:11px">${val ? fmt(val) : ''}</td>`;
                    });
                    html += `<td class="num ann-col q-sep cell" style="font-size:11px">${vAnnual ? fmt(vAnnual) : ''}</td><td class="num ann-col cell"></td><td class="num cell q-sep"></td><td class="num cell"></td></tr>`;
                });
            }

            // + Add new
            if (!isPres) {
                html += `<tr class="cal-add-row" onclick="calAddRow('Programs')"><td class="sticky-col-toggle"></td><td class="sticky-col-name" colspan="18">+ Add new Programs vendor</td></tr>`;
            }
        } else if (cat === 'T&E') {
            // T&E vendor rows from vendorMonthly
            catVMs.forEach(vm => {
                html += renderVendorMonthlyRow(vm, catTx, q4tx, curMonthIdx, isPres);
            });
            // Unmatched T&E vendors
            const matchedVendors = catVMs.map(vm => vm.vendor);
            const unmatchedTx = catTx.filter(t => !matchedVendors.some(mv => matchVendor(mv, t.vendor)));
            if (unmatchedTx.length > 0) {
                const uVendors = {};
                unmatchedTx.forEach(t => { const v = t.vendor || 'Other'; if (!uVendors[v]) uVendors[v] = []; uVendors[v].push(t); });
                Object.entries(uVendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([vendor, vtx]) => {
                    let vAnnual = 0;
                    html += `<tr class="vendor-row"><td class="sticky-col-toggle"></td><td class="row-label-cell sticky-col-name" style="padding-left:18px">${esc(vendor)}</td>`;
                    Q4_KEYS.forEach((qk, qi) => html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.4"></td>`);
                    MONTH_KEYS.forEach((mk, mi) => {
                        const mLabel = MONTH_LABELS[mi];
                        const val = vtx.filter(t => t.month === mLabel).reduce((s, t) => s + t.amount, 0);
                        const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
                        vAnnual += val;
                        html += `<td class="num clickable cell ${isQBoundary ? 'q-sep' : ''}" onclick="drillCalendarVendor('${esc(vendor)}','${mLabel}')" style="font-size:11px">${val ? fmt(val) : ''}</td>`;
                    });
                    html += `<td class="num ann-col q-sep cell" style="font-size:11px">${vAnnual ? fmt(vAnnual) : ''}</td><td class="num ann-col cell"></td><td class="num cell q-sep"></td><td class="num cell"></td></tr>`;
                });
            }
            if (!isPres) {
                html += `<tr class="cal-add-row" onclick="calAddRow('T&amp;E')"><td class="sticky-col-toggle"></td><td class="sticky-col-name" colspan="18">+ Add new T&amp;E item</td></tr>`;
            }
        } else {
            // Headcount / Outside Envelope: aggregate from transactions only
            const vendors = {};
            catTx.forEach(t => { const v = t.vendor || 'Other'; if (!vendors[v]) vendors[v] = []; vendors[v].push(t); });
            Object.entries(vendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([vendor, vtx]) => {
                let vAnnual = 0;
                html += `<tr class="vendor-row"><td class="sticky-col-toggle"></td><td class="row-label-cell sticky-col-name" style="padding-left:18px">${esc(vendor)}</td>`;
                Q4_KEYS.forEach((qk, qi) => {
                    const monthMap = { oct25: 'Oct', nov25: 'Nov', dec25: 'Dec' };
                    const q4Val = q4tx.filter(t => matchVendor(vendor, t.vendor) && t.month === monthMap[qk]).reduce((s, t) => s + t.amount, 0);
                    html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.4">${q4Val ? fmtWhole(q4Val) : ''}</td>`;
                });
                MONTH_KEYS.forEach((mk, mi) => {
                    const mLabel = MONTH_LABELS[mi];
                    const val = vtx.filter(t => t.month === mLabel).reduce((s, t) => s + t.amount, 0);
                    const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
                    vAnnual += val;
                    html += `<td class="num clickable cell ${isQBoundary ? 'q-sep' : ''}" onclick="drillCalendarVendor('${esc(vendor)}','${mLabel}')" style="font-size:11px">${val ? fmtWhole(val) : ''}</td>`;
                });
                html += `<td class="num ann-col q-sep cell" style="font-size:11px">${fmtWhole(vAnnual)}</td><td class="num ann-col cell"></td><td class="num cell q-sep"></td><td class="num cell"></td></tr>`;
            });
        }
    });

    // Grand total — Programs + T&E only
    const gVariance = grandBudget - grandAnnual;
    const gPct = grandBudget > 0 ? grandAnnual / grandBudget : 0;
    html += '<tr class="grand-total-row"><td class="sticky-col-toggle"></td><td class="row-label-cell sticky-col-name">TOTAL (Programs + T&amp;E)</td>';
    Q4_KEYS.forEach((qk, qi) => html += `<td class="num cell ${qi === 0 ? 'q-sep' : ''}"></td>`);
    MONTH_KEYS.forEach((mk, mi) => {
        const monthLabel = MONTH_LABELS[mi];
        const isPast = mi <= curMonthIdx;
        const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
        let val = 0;
        ['Programs', 'T&E'].forEach(cat => {
            const catVMs = appState.vendorMonthly.filter(vm => vm.category === cat);
            const catTx = tx2026.filter(t => t.category === cat);
            if (isPast) val += catTx.filter(t => t.month === monthLabel).reduce((s, t) => s + t.amount, 0);
            else val += catVMs.filter(vm => !appState.disabledVendors[vm.vendor]).reduce((s, vm) => s + (vm[mk] || 0), 0);
        });
        html += `<td class="num cell ${isQBoundary ? 'q-sep' : ''}">${val ? fmtWhole(val) : ''}</td>`;
    });
    html += `<td class="num ann-col q-sep cell">${fmtWhole(grandAnnual)}</td><td class="num ann-col cell">${fmtWhole(grandBudget)}</td>`;
    html += `<td class="num cell q-sep ${gVariance >= 0 ? 'cal-variance-pos' : 'cal-variance-neg'}">${fmtWhole(gVariance)}</td>`;
    html += `<td class="num cell ${pctClass(gPct)}">${fmtPct(gPct)}</td></tr>`;
    html += '</tbody></table></div>';
    return html;
}

// Render a single vendor row in the monthly spreadsheet
function renderVendorMonthlyRow(vm, catTx, q4tx, curMonthIdx, isPres) {
    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const Q4_KEYS = ['oct25','nov25','dec25'];
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const isDraft = vm.isDraft || (vm.notes || '').toLowerCase().includes('draft');
    const isDisabled = appState.disabledVendors[vm.vendor];
    const isTerminated = (vm.notes || '').toLowerCase().includes('terminated');
    const rowClass = isDraft ? 'draft-row' : (isDisabled ? 'cut-row' : '');
    const vendorIdx = appState.vendorMonthly.indexOf(vm);

    let vAnnual = 0;
    let html = `<tr class="vendor-row ${rowClass}"><td class="row-label-cell sticky-col-toggle">`;
    html += `<button class="toggle-btn ${isDisabled ? '' : 'on'}" onclick="toggleVendor('${esc(vm.vendor)}')">${isDisabled ? '' : '✓'}</button></td>`;
    html += `<td class="row-label-cell sticky-col-name" style="padding-left:34px" data-vm-name="${vendorIdx}">${esc(vm.vendor)}</td>`;

    // Q4'25 cells
    Q4_KEYS.forEach((qk, qi) => {
        const monthMap = { oct25: 'Oct', nov25: 'Nov', dec25: 'Dec' };
        const q4Actual = q4tx.filter(t => matchVendor(vm.vendor, t.vendor) && t.month === monthMap[qk]).reduce((s, t) => s + t.amount, 0);
        const q4Plan = vm[qk] || 0;
        const val = q4Actual || q4Plan;
        html += `<td class="num cell q4-ref ${qi === 0 ? 'q-sep' : ''}" style="opacity:0.4;font-size:11px">${val ? fmtWhole(val) : ''}</td>`;
    });

    // 2026 month cells
    MONTH_KEYS.forEach((mk, mi) => {
        const monthLabel = MONTH_LABELS[mi];
        const isPast = mi <= curMonthIdx;
        const isQBoundary = mi === 0 || mi === 3 || mi === 6 || mi === 9;
        const sepCls = isQBoundary ? 'q-sep' : '';
        const actual = catTx.filter(t => matchVendor(vm.vendor, t.vendor) && t.month === monthLabel).reduce((s, t) => s + t.amount, 0);
        const plan = vm[mk] || 0;

        let cellContent = '';
        let cellClass = '';
        let editAttr = '';

        if (isPast) {
            // Past month: show actual (bold), fall back to plan if no actuals
            const val = actual || plan;
            vAnnual += actual; // Only count actual spend for past months
            cellContent = val ? fmt(val) : '';
            cellClass = actual ? '' : 'forecast-cell';
            // Click to drill down
            if (actual > 0) editAttr = ` onclick="drillCalendarVendor('${esc(vm.vendor)}','${monthLabel}')"`;
        } else {
            // Future month: show plan (italic/hatched), editable
            vAnnual += (isDisabled ? 0 : plan);
            if (isTerminated && plan === 0) {
                cellContent = '<span style="font-size:9px;color:var(--text-muted)">—</span>';
                cellClass = 'forecast-cell';
            } else {
                cellContent = plan ? fmtWhole(plan) : '';
                cellClass = 'forecast-cell';
                if (!isPres) editAttr = ` ondblclick="startMonthlyEdit(this,${vendorIdx},'${mk}')"`;
            }
        }
        html += `<td class="num cell ${sepCls} ${cellClass}" style="font-size:11px"${editAttr}>${cellContent}</td>`;
    });

    // Summary columns
    const vBudgetAnn = MONTH_KEYS.reduce((s, mk) => s + (vm[mk] || 0), 0);
    const vVar = vBudgetAnn - vAnnual;
    const vPct = vBudgetAnn > 0 ? vAnnual / vBudgetAnn : 0;
    html += `<td class="num ann-col q-sep cell" style="font-size:11px">${vAnnual ? fmt(vAnnual) : ''}</td>`;
    html += `<td class="num ann-col cell" style="font-size:11px">${vBudgetAnn ? fmtWhole(vBudgetAnn) : ''}</td>`;
    html += `<td class="num cell q-sep ${vVar >= 0 ? 'cal-variance-pos' : 'cal-variance-neg'}" style="font-size:11px">${vBudgetAnn ? fmtWhole(vVar) : ''}</td>`;
    html += `<td class="num cell ${pctClass(vPct)}" style="font-size:11px">${vBudgetAnn ? fmtPct(vPct) : ''}</td></tr>`;
    return html;
}

function renderCalendarMonthly() {
    const m = appState.calendarMonth;
    const tx = getFilteredTransactions().filter(t => t.year === 2026 && t.month === m);
    const showHC = isHeadcountVisible();
    const cats = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const isPres = appState.presentationMode;

    let html = '<div class="zoom-bar"><button class="zoom-btn" onclick="calZoomTo(\'spreadsheet\')">&larr; Back to Budget</button><span style="font-size:12px;font-weight:600">' + esc(m) + ' 2026 — Transaction Detail</span></div>';
    html += '<div class="table-container"><div class="table-scroll"><table>';
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
            html += `<tr class="cal-add-row" onclick="calAddRowMonthly('${esc(cat)}','${m}')"><td colspan="6">+ Add ${cat.toLowerCase()} item</td></tr>`;
        }
        html += `<tr class="subtotal-row"><td>${esc(cat)} Subtotal</td><td class="num">${fmt(catTotal)}</td><td colspan="4"></td></tr>`;
        monthTotal += catTotal;
    });
    html += `<tr class="grand-total-row"><td>${m} Total</td><td class="num">${fmt(monthTotal)}</td><td colspan="4"></td></tr>`;
    html += '</tbody></table></div></div>';
    return html;
}

function calZoomTo(level, target) {
    if (level === 'monthly') { appState.calendarMonth = target; }
    else { appState.calendarMonth = null; }
    renderCalendar();
}
function calToggleCategory(cat) { appState.calendarCollapsed[cat] = !appState.calendarCollapsed[cat]; renderCalendar(); }
function calExpandAll() { appState.calendarCollapsed = {}; renderCalendar(); }
function calCollapseAll() { ['Headcount', 'Programs', 'T&E', 'Outside Envelope'].forEach(c => appState.calendarCollapsed[c] = true); renderCalendar(); }
function toggleVendor(vendor) {
    appState.disabledVendors[vendor] = !appState.disabledVendors[vendor];
    const vm = appState.vendorMonthly.find(v => v.vendor === vendor);
    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const freed = vm ? MONTH_KEYS.reduce((s, mk) => s + (vm[mk] || 0), 0) : 0;
    const action = appState.disabledVendors[vendor] ? 'toggled off' : 'toggled on';
    showToast(`${vendor} ${action}` + (appState.disabledVendors[vendor] && freed > 0 ? ` — ${fmtWhole(freed)} freed` : ''), 'info');
    recompute(); renderCalendar();
}

function calAddRow(category) {
    const subMap = { 'Programs': 'Other', 'T&E': 'Other' };
    const newVM = { vendor: '', subcategory: subMap[category] || '', category,
        oct25: 0, nov25: 0, dec25: 0,
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, notes: '' };
    appState.vendorMonthly.push(newVM);
    recompute(); renderCalendar();
    // Start editing vendor name
    const idx = appState.vendorMonthly.length - 1;
    setTimeout(() => {
        const nameCell = document.querySelector(`[data-vm-name="${idx}"]`);
        if (nameCell) startVendorNameEdit(nameCell, idx);
    }, 50);
}

// Edit a monthly plan cell in vendorMonthly
function startMonthlyEdit(td, vendorIdx, monthKey) {
    if (appState.presentationMode) return;
    const vm = appState.vendorMonthly[vendorIdx];
    if (!vm) return;
    // Capture scroll position
    const scrollEl = document.querySelector('.calendar-container');
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;

    const currentVal = vm[monthKey] || 0;
    td.classList.add('cell-editing');
    const input = document.createElement('input');
    input.type = 'number'; input.step = '1';
    input.className = 'cell-editor num';
    input.value = currentVal || '';
    input.style.width = '65px'; input.style.fontSize = '11px'; input.style.padding = '2px 4px';
    td.textContent = '';
    td.appendChild(input);
    input.focus(); input.select();

    function commit() {
        const newVal = parseFloat(input.value) || 0;
        vm[monthKey] = newVal;
        td.classList.remove('cell-editing');
        recompute(); renderCalendar();
        requestAnimationFrame(() => {
            const el = document.querySelector('.calendar-container');
            if (el) { el.scrollTop = scrollTop; el.scrollLeft = scrollLeft; }
        });
    }
    function cancel() {
        td.classList.remove('cell-editing');
        renderCalendar();
        requestAnimationFrame(() => {
            const el = document.querySelector('.calendar-container');
            if (el) { el.scrollTop = scrollTop; el.scrollLeft = scrollLeft; }
        });
    }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', () => setTimeout(commit, 100));
}

// Edit vendor name for a new vendorMonthly entry
function startVendorNameEdit(td, vendorIdx) {
    const vm = appState.vendorMonthly[vendorIdx];
    if (!vm) return;
    td.classList.add('cell-editing');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = vm.vendor;
    input.placeholder = 'Vendor name...';
    input.style.fontSize = '11px'; input.style.padding = '2px 4px'; input.style.width = '140px';
    td.textContent = '';
    td.appendChild(input);
    input.focus();

    function commit() {
        vm.vendor = input.value.trim();
        td.classList.remove('cell-editing');
        recompute(); renderCalendar();
    }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); td.classList.remove('cell-editing'); renderCalendar(); }
    });
    input.addEventListener('blur', () => setTimeout(commit, 100));
}

function drillCalendarVendor(vendor, period) {
    const tx = getFilteredTransactions();
    const months = CONFIG.QUARTERS[period] || [period];
    const filtered = tx.filter(t => matchVendor(vendor, t.vendor) && t.year === 2026 && months.includes(t.month));
    if (filtered.length > 0) showDrillDown(filtered, vendor + ' — ' + period);
}

// Add a transaction row in the monthly detail view
function calAddRowMonthly(category, month) {
    const glDefault = category === 'Programs' ? '6406' : category === 'T&E' ? '6202' : category === 'Headcount' ? '6101' : '6303';
    const info = CONFIG.GL_MAP[glDefault] || { cat: category, sub: '' };
    const newTx = { _row: Date.now(), date: '', vendor: '', amount: 0, gl: glDefault, glName: info.sub, department: '400-Marketing', memo: '', category: info.cat, subcategory: info.sub, month, quarter: quarterOf(month), year: 2026, status: 'Actual', isCarryover: false, employeeType: '' };
    appState.transactions.push(newTx);
    recompute(); renderCalendar();
    setTimeout(() => {
        const cells = document.querySelectorAll('td.editable-cell');
        const lastVendorCell = Array.from(cells).filter(td => td.getAttribute('ondblclick')?.includes(newTx._row + ",'vendor'")).pop();
        if (lastVendorCell) startCellEdit(lastVendorCell, newTx._row, 'vendor');
    }, 50);
}

// ============================================================
// 17. EXPENSES TAB
// ============================================================
function renderExpenses() {
    const el = document.getElementById('tab-expenses');
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
    html += `<button class="btn btn-secondary" onclick="exportCSV()">CSV</button>`;
    if (!isPres) html += `<button class="btn btn-primary" data-action="add" onclick="openAddTxModal()">+ Add</button>`;
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
            html += `<td class="editable-cell" ondblclick="startCellEdit(this,${t._row},'category')">${categoryPill(t.category)}</td>`;
            html += `<td>${esc(t.subcategory)}</td>`;
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
function updateTxFilter(key, val) { appState.txFilters[key] = val; if (key === 'search') debounce(renderExpenses, 300)(); else renderExpenses(); }
function clearTxFilters() { appState.txFilters = { search: '', category: '', quarter: '', status: '' }; renderExpenses(); }
function sortTx(col) { if (appState.txSort.col === col) appState.txSort.dir = appState.txSort.dir === 'asc' ? 'desc' : 'asc'; else { appState.txSort.col = col; appState.txSort.dir = 'asc'; } renderExpenses(); }
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
// 18. SOFTWARE TAB — VENDOR PORTFOLIO + INTERACTIVE FORECASTING
// ============================================================
function renderSoftware() {
    const el = document.getElementById('tab-software');
    const vendors = appState.vendorContracts;
    const totalBefore = vendors.reduce((s, v) => s + v.before, 0);
    const totalAfter = vendors.reduce((s, v) => s + v.after, 0);
    const totalSavings = vendors.reduce((s, v) => s + v.savings, 0);
    const isPres = appState.presentationMode;

    // Calculate modeled savings from swForecasts
    let modeledAfter = totalAfter;
    let additionalSavings = 0;
    Object.keys(appState.swForecasts).forEach(vendor => {
        const f = appState.swForecasts[vendor];
        const v = vendors.find(vc => vc.vendor === vendor);
        if (!v) return;
        if (f.cancelled) { modeledAfter -= v.after; additionalSavings += v.after; }
        else if (f.targetAmount != null) { modeledAfter += (f.targetAmount - v.after); additionalSavings += (v.after - f.targetAmount); }
    });
    const hasForecasts = additionalSavings !== 0;

    let html = '';
    // KPIs
    html += '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">';
    html += `<div class="kpi-card positive" style="border-left:3px solid var(--color-positive)"><div class="kpi-label">Total Annual Savings</div><div class="kpi-value">${fmtWhole(totalSavings)}</div><div class="kpi-trend positive">From vendor renegotiations</div></div>`;
    html += `<div class="kpi-card"><div class="kpi-label">Previous Annual Cost</div><div class="kpi-value">${fmtWhole(totalBefore)}</div><div class="kpi-trend neutral">Before marketing-driven renegotiations</div></div>`;
    html += `<div class="kpi-card"><div class="kpi-label">Current Annual Cost</div><div class="kpi-value">${fmtWhole(totalAfter)}</div><div class="kpi-trend positive">${fmtPct(totalSavings / totalBefore)} reduction</div></div>`;
    html += '</div>';

    // Modeled savings indicator
    if (hasForecasts) {
        html += `<div class="section-card" style="border-left:3px solid var(--color-positive);padding:10px 14px;margin-bottom:10px"><div style="font-size:11px;font-weight:600;color:var(--color-positive)">Modeled: ${fmtWhole(totalAfter)} &rarr; ${fmtWhole(modeledAfter)} = ${fmtWhole(additionalSavings)} additional savings if negotiations succeed</div></div>`;
    }

    // Charts
    html += '<div class="chart-grid">';
    html += `<div class="chart-card"><div class="chart-title">Before vs After (Annual Contract Value)</div><div class="chart-wrapper"><canvas id="swBeforeAfterChart"></canvas></div></div>`;
    html += `<div class="chart-card"><div class="chart-title">Savings by Vendor</div><div class="chart-wrapper"><canvas id="swSavingsChart"></canvas></div></div>`;
    html += '</div>';

    // Vendor Portfolio Cards
    html += '<div class="section-card"><div class="section-title">Vendor Portfolio</div><div class="sw-card-grid">';
    vendors.forEach((v, i) => {
        const statusMap = { 'Renewed': 'sw-renewed', 'Renegotiated': 'sw-renewed', 'Terminated': 'sw-terminated', 'Cancelled': 'sw-terminated', 'Upcoming': 'sw-upcoming', 'Winding Down': 'sw-winding' };
        const statusCls = statusMap[v.status] || 'sw-upcoming';
        const isUpcoming = v.status === 'Upcoming';
        const isWindingDown = v.status === 'Winding Down';
        const forecast = appState.swForecasts[v.vendor] || {};

        html += '<div class="sw-card">';
        html += '<div style="flex:1">';
        html += `<div style="font-weight:600;font-size:12px;margin-bottom:2px">${esc(v.vendor)} <span class="sw-status ${statusCls}">${esc(v.status)}</span></div>`;
        html += `<div style="font-size:10px;color:var(--text-muted)">${esc(v.category)}${v.contractEnd ? '. Ends: ' + esc(v.contractEnd) : ''}${v.notes ? '. ' + esc(v.notes) : ''}</div>`;
        html += '</div>';
        html += '<div style="text-align:right;min-width:120px">';
        html += `<div style="font-size:11px;color:var(--text-muted);text-decoration:line-through">${fmtWhole(v.before)}/yr</div>`;
        if (isUpcoming) {
            html += `<div style="font-size:14px;font-weight:600;color:var(--color-warning)">${fmtWhole(v.after)}/yr</div>`;
            html += `<div style="font-size:10px;color:var(--color-warning);font-weight:600">${v.savings > 0 ? 'Saving ' + fmtWhole(v.savings) : 'Target: negotiate down'}</div>`;
        } else if (isWindingDown) {
            html += `<div style="font-size:14px;font-weight:600">${fmtWhole(v.after)}/yr</div>`;
            html += `<div style="font-size:10px;color:var(--color-positive);font-weight:600">Saving ${fmtWhole(v.savings)}</div>`;
        } else {
            html += `<div style="font-size:14px;font-weight:600">${fmtWhole(v.after)}/yr</div>`;
            html += `<div style="font-size:10px;color:var(--color-positive);font-weight:600">Saving ${fmtWhole(v.savings)}</div>`;
        }
        html += '</div>';
        html += '</div>';

        // Inline modeling for upcoming vendors
        if (isUpcoming && !isPres) {
            html += `<div class="sw-model-controls" style="background:rgba(255,186,0,0.04);border:1px solid rgba(255,186,0,0.15);border-radius:4px;padding:8px 12px;margin-top:-1px;margin-bottom:10px;display:flex;align-items:center;gap:12px;font-size:11px">`;
            html += `<label style="color:var(--text-muted)">Target annual:</label>`;
            html += `<input type="number" class="form-input" style="width:100px;padding:3px 6px;font-size:11px" value="${forecast.targetAmount != null ? forecast.targetAmount : ''}" placeholder="${v.after}" onchange="updateSWForecast('${esc(v.vendor)}','targetAmount',this.value)">`;
            html += `<label style="color:var(--text-muted)">Cancel?</label>`;
            html += `<input type="checkbox" ${forecast.cancelled ? 'checked' : ''} onchange="updateSWForecast('${esc(v.vendor)}','cancelled',this.checked)">`;
            html += '</div>';
        }
    });
    html += '</div></div>';

    // Forecast Chart
    html += `<div class="chart-card"><div class="chart-title">Software Cost Forecast — Monthly</div><div class="chart-wrapper tall"><canvas id="swForecastChart"></canvas></div></div>`;

    // The CFO Argument
    html += '<div class="section-card"><details class="assumptions-panel" style="margin-top:10px"><summary>The CFO Argument</summary><div style="padding:10px 0;font-size:12px;color:var(--text-muted);line-height:1.6">';
    html += 'Marketing is pacing under on the $446K envelope, AND has driven $213K+ in annual software savings that free up room to reinvest in programs. These savings sit outside the $446K marketing budget in the company-wide Software Subscriptions line — incremental value delivered by marketing leadership, not captured in the department budget.';
    html += '</div></details></div>';

    el.innerHTML = html;
    renderSWCharts();
}

function updateSWForecast(vendor, field, value) {
    if (!appState.swForecasts[vendor]) appState.swForecasts[vendor] = {};
    if (field === 'targetAmount') {
        appState.swForecasts[vendor].targetAmount = value ? parseFloat(value) : null;
    } else if (field === 'cancelled') {
        appState.swForecasts[vendor].cancelled = !!value;
    }
    recompute();
    renderSoftware();
}

function renderSWCharts() {
    destroyChart('swBeforeAfter'); destroyChart('swSavings'); destroyChart('swForecast');
    const vendors = appState.vendorContracts;
    const textColor = '#0A1849';
    const gridColor = 'rgba(0,0,0,0.06)';
    const fontOpts = { family: "'Inter', sans-serif", size: 10 };

    // Before vs After
    const baCt = document.getElementById('swBeforeAfterChart');
    if (baCt) {
        const labels = vendors.map(v => v.vendor);
        appState.charts.swBeforeAfter = new Chart(baCt, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Before', data: vendors.map(v => v.before), backgroundColor: 'rgba(220,38,38,0.6)', borderRadius: 2 },
                { label: 'After', data: vendors.map(v => v.after), backgroundColor: 'rgba(5,150,105,0.6)', borderRadius: 2 }
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } } }, scales: { x: { ticks: { font: { ...fontOpts, size: 8 }, color: textColor, maxRotation: 45 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } } } }
        });
    }

    // Savings horizontal bars
    const sCt = document.getElementById('swSavingsChart');
    if (sCt) {
        const sorted = [...vendors].sort((a, b) => b.savings - a.savings);
        appState.charts.swSavings = new Chart(sCt, {
            type: 'bar',
            data: { labels: sorted.map(v => v.vendor), datasets: [{ label: 'Savings', data: sorted.map(v => v.savings), backgroundColor: 'rgba(71,57,231,0.7)', borderRadius: 2 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtWhole(ctx.raw) } } }, scales: { x: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } }, y: { ticks: { font: { ...fontOpts, size: 9 }, color: textColor }, grid: { display: false } } } }
        });
    }

    // Forecast line chart
    const { currentLine, proposedLine, baseline } = computeSWForecast();
    const hasForecasts = Object.keys(appState.swForecasts).some(k => {
        const f = appState.swForecasts[k];
        return f.cancelled || f.targetAmount != null;
    });
    const fCt = document.getElementById('swForecastChart');
    if (fCt) {
        const datasets = [
            { label: 'Company SW Budget (monthly)', data: new Array(12).fill(baseline), borderColor: 'rgba(107,114,128,0.4)', borderDash: [8, 4], pointRadius: 0, fill: false, tension: 0 },
            { label: 'Marketing SW (Current)', data: currentLine, borderColor: 'rgba(71,57,231,0.9)', backgroundColor: 'rgba(71,57,231,0.08)', pointRadius: 3, fill: true, tension: 0.3 },
        ];
        if (hasForecasts) {
            datasets.push({ label: 'Marketing SW (Modeled)', data: proposedLine, borderColor: 'rgba(5,150,105,0.9)', backgroundColor: 'rgba(5,150,105,0.08)', pointRadius: 3, fill: true, tension: 0.3 });
        }
        appState.charts.swForecast = new Chart(fCt, {
            type: 'line', data: { labels: CONFIG.MONTHS, datasets },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor }, grid: { color: gridColor } }, x: { ticks: { font: fontOpts, color: textColor }, grid: { display: false } } } }
        });
    }
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
            // Terminated/Cancelled/Winding Down vendors have end dates
            if (v.status === 'Terminated' || v.status === 'Cancelled' || v.status === 'Winding Down' || v.status === 'Ending' || v.status === 'Eliminated') {
                const endDate = v.contractEnd ? new Date(v.contractEnd) : new Date(2025, 11, 31);
                if (monthDate > endDate) active = false;
            }
            if (active) currentLine[i] += v.after / 12;

            const forecast = appState.swForecasts[v.vendor];
            if (forecast) {
                if (forecast.cancelled) {
                    // Cancelled in model — don't add to proposed
                } else if (forecast.targetAmount != null) {
                    // Use renewal date if available, otherwise apply immediately
                    const renewDate = v.renegDate ? new Date(v.renegDate) : (v.contractEnd ? new Date(v.contractEnd) : null);
                    if (renewDate && monthDate >= renewDate) proposedLine[i] += forecast.targetAmount / 12;
                    else if (active) proposedLine[i] += v.after / 12;
                } else {
                    if (active) proposedLine[i] += v.after / 12;
                }
            } else {
                if (active) proposedLine[i] += v.after / 12;
            }
        });
    });
    return { currentLine, proposedLine, baseline };
}

// ============================================================
// 19. EVENT HANDLERS & INITIALIZATION
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
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
