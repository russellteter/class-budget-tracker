/* ============================================================
   CLASS 2026 MARKETING BUDGET TRACKER — APPLICATION
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
    scenarioInput: { amount: 0, category: 'Programs', quarter: 'Q2', description: '' }
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

function monthIdx(m) {
    return CONFIG.MONTHS.indexOf(m);
}

function quarterOf(m) {
    const i = monthIdx(m);
    if (i < 3) return 'Q1';
    if (i < 6) return 'Q2';
    if (i < 9) return 'Q3';
    return 'Q4';
}

function getCurrentMonth() {
    return CONFIG.MONTHS[new Date().getMonth()];
}

function getCurrentMonthIdx() {
    return new Date().getMonth();
}

function isActualPeriod(month, year) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const y = parseInt(year) || 2026;
    const m = monthIdx(month);
    if (y < curYear) return true;
    if (y > curYear) return false;
    return m <= curMonth;
}

function amountClass(n) {
    return n < 0 ? 'amount-negative' : 'amount-positive';
}

function progressColor(pct) {
    if (pct >= 0.9) return 'red';
    if (pct >= 0.75) return 'amber';
    return 'green';
}

function categoryPill(cat) {
    const map = { 'Headcount': 'pill-headcount', 'Programs': 'pill-programs', 'T&E': 'pill-te', 'Outside Envelope': 'pill-outside' };
    return `<span class="pill ${map[cat] || 'pill-outside'}">${esc(cat)}</span>`;
}

function statusPill(status) {
    if (status === 'Outstanding') return '<span class="pill pill-outstanding">Outstanding</span>';
    return '<span class="pill pill-actual">Actual</span>';
}

function statusBadge(status) {
    const map = { 'Renewed': 'status-renewed', 'Ending': 'status-ending', 'Eliminated': 'status-eliminated' };
    return `<span class="status-badge ${map[status] || ''}">${esc(status)}</span>`;
}

function debounce(fn, ms) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

function timeAgo(date) {
    if (!date) return 'Never';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
}

// ============================================================
// 4. TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i data-lucide="${icons[type] || 'info'}" class="toast-icon"></i>
        <span class="toast-message">${esc(message)}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

// ============================================================
// 5. GOOGLE AUTHENTICATION
// ============================================================
function initAuth() {
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initAuth, 500);
        return;
    }
    appState.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: handleAuthResponse
    });
}

function handleAuthResponse(resp) {
    if (resp.error) {
        showToast('Sign in failed: ' + resp.error, 'error');
        return;
    }
    appState.accessToken = resp.access_token;
    appState.isSignedIn = true;
    updateAuthUI();
    fetchAllSheets();
}

function signIn() {
    if (!appState.tokenClient) {
        showToast('Auth not ready. Try again.', 'warning');
        return;
    }
    appState.tokenClient.requestAccessToken();
}

function signOut() {
    if (appState.accessToken) {
        google.accounts.oauth2.revoke(appState.accessToken);
    }
    appState.accessToken = null;
    appState.isSignedIn = false;
    appState.userEmail = null;
    updateAuthUI();
    showToast('Signed out', 'info');
}

function updateAuthUI() {
    const signInBtn = document.getElementById('signInBtn');
    const userInfo = document.getElementById('userInfo');
    const emailEl = document.getElementById('userEmail');
    if (appState.isSignedIn) {
        signInBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        if (appState.userEmail) emailEl.textContent = appState.userEmail;
        fetchUserEmail();
    } else {
        signInBtn.style.display = 'inline-flex';
        userInfo.style.display = 'none';
        emailEl.textContent = '';
    }
}

async function fetchUserEmail() {
    if (!appState.accessToken) return;
    try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: 'Bearer ' + appState.accessToken }
        });
        const data = await resp.json();
        appState.userEmail = data.email;
        document.getElementById('userEmail').textContent = data.email;
    } catch (e) { /* non-critical */ }
}

// ============================================================
// 6. GOOGLE SHEETS API
// ============================================================
async function fetchAllSheets() {
    if (!appState.accessToken) {
        loadFallbackData();
        return;
    }
    appState.isSyncing = true;
    updateFreshness();
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('spinning');

    try {
        const ranges = CONFIG.SHEET_RANGES.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
        const url = `${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values:batchGet?${ranges}`;
        const resp = await fetch(url, {
            headers: { Authorization: 'Bearer ' + appState.accessToken }
        });
        if (!resp.ok) throw new Error('Sheets API error: ' + resp.status);
        const data = await resp.json();
        const ranges_data = data.valueRanges || [];
        parseTransactions(ranges_data[0]?.values || []);
        parseBudget(ranges_data[1]?.values || []);
        parseCommitments(ranges_data[2]?.values || []);
        parseVendorContracts(ranges_data[3]?.values || []);
        parseConfig(ranges_data[4]?.values || []);
        appState.lastSynced = new Date();
        recompute();
        renderActiveTab();
        showToast('Data loaded from Google Sheets', 'success');
    } catch (err) {
        console.error('Sheets fetch error:', err);
        showToast('Failed to load from Sheets. Using fallback data.', 'warning');
        loadFallbackData();
    } finally {
        appState.isSyncing = false;
        refreshBtn.classList.remove('spinning');
        updateFreshness();
    }
}

async function writeToSheets(range, values) {
    if (!appState.accessToken) {
        showToast('Sign in to save changes', 'warning');
        return false;
    }
    try {
        const url = `${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
        const resp = await fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + appState.accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ range, majorDimension: 'ROWS', values })
        });
        if (!resp.ok) throw new Error('Write failed: ' + resp.status);
        showToast('Saved to Google Sheets', 'success');
        return true;
    } catch (err) {
        console.error('Sheets write error:', err);
        showToast('Failed to save: ' + err.message, 'error');
        return false;
    }
}

async function appendToSheets(range, values) {
    if (!appState.accessToken) {
        showToast('Sign in to save changes', 'warning');
        return false;
    }
    try {
        const url = `${CONFIG.API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + appState.accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ range, majorDimension: 'ROWS', values })
        });
        if (!resp.ok) throw new Error('Append failed: ' + resp.status);
        showToast('Transaction added', 'success');
        return true;
    } catch (err) {
        console.error('Sheets append error:', err);
        showToast('Failed to add: ' + err.message, 'error');
        return false;
    }
}

// ============================================================
// 7. DATA PARSERS
// ============================================================
function parseTransactions(rows) {
    if (!rows || rows.length < 2) return;
    appState.transactions = rows.slice(1).map((r, i) => ({
        _row: i + 2,
        date: r[0] || '',
        vendor: r[1] || '',
        amount: parseNum(r[2]),
        gl: r[3] || '',
        glName: r[4] || '',
        department: r[5] || '',
        memo: r[6] || '',
        category: r[7] || '',
        subcategory: r[8] || '',
        month: r[9] || '',
        quarter: r[10] || '',
        year: parseInt(r[11]) || 2026,
        status: r[12] || 'Actual',
        isCarryover: (r[13] || '').toLowerCase() === 'yes',
        employeeType: r[14] || ''
    })).filter(t => t.amount !== 0 || t.vendor);
}

function parseBudget(rows) {
    if (!rows || rows.length < 2) return;
    appState.budget = rows.slice(1).map(r => ({
        category: r[0] || '',
        annual: parseNum(r[1]),
        months: CONFIG.MONTHS.reduce((o, m, i) => { o[m] = parseNum(r[i + 2]); return o; }, {})
    })).filter(b => b.category && b.category !== 'Notes');
}

function parseCommitments(rows) {
    if (!rows || rows.length < 2) return;
    appState.commitments = rows.slice(1).map(r => ({
        vendor: r[0] || '',
        monthly: parseNum(r[1]),
        category: r[2] || '',
        gl: r[3] || '',
        startMonth: r[4] || '',
        endMonth: r[5] || '',
        status: r[6] || 'Active',
        notes: r[7] || ''
    })).filter(c => c.vendor);
}

function parseVendorContracts(rows) {
    if (!rows || rows.length < 2) return;
    appState.vendorContracts = rows.slice(1).map(r => ({
        vendor: r[0] || '',
        before: parseNum(r[1]),
        after: parseNum(r[2]),
        savings: parseNum(r[3]),
        savingsPct: r[4] || '',
        category: r[5] || '',
        status: r[6] || '',
        notes: r[7] || ''
    })).filter(v => v.vendor);
}

function parseConfig(rows) {
    if (!rows || rows.length < 1) return;
    appState.config = {};
    rows.forEach(r => {
        if (r[0]) appState.config[r[0]] = r[1] || '';
    });
}

// ============================================================
// 8. FALLBACK DATA
// ============================================================
function loadFallbackData() {
    // Representative data for demo mode
    const txn = (date, vendor, amount, gl, glName, dept, memo, cat, sub, month, qtr, year, status, carry, empType) =>
        ({ _row: 0, date, vendor, amount, gl, glName, department: dept, memo, category: cat, subcategory: sub, month, quarter: qtr, year, status: status || 'Actual', isCarryover: carry || false, employeeType: empType || '' });

    const hc = (m, q, y, carry) => [
        txn(`${m === 'Oct' || m === 'Nov' || m === 'Dec' ? (y === 2025 ? m + ' 2025' : m + ' 2026') : m + ' 2026'}`, 'Kendall Woodard', 4583.33, '6101', 'Salary', '404-Creative & Brand', 'Payroll', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'FTE'),
        txn('', 'Dalton Mullins', y === 2025 ? 7500 : 2083.33, '6101', 'Salary', '408-SDRs', 'Payroll', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'FTE'),
        txn('', 'Roxana Nabavian', 5000, '6101', 'Salary', '403-Mktg Ops', 'Contractor', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'Contractor'),
        txn('', 'Kate Bertram', 2800, '6101', 'Salary', '404-Creative & Brand', 'PT Contractor', 'Headcount', 'Salary', m, q, y, 'Actual', carry, 'Contractor'),
        txn('', 'Payroll Tax', y === 2025 ? 2780 : 2016.67, '6103', 'Payroll Tax', '400-Marketing', 'Tax', 'Headcount', 'Payroll Tax', m, q, y, 'Actual', carry, ''),
        txn('', 'Benefits', 3200, '6104', 'Benefits', '400-Marketing', 'Benefits', 'Headcount', 'Benefits', m, q, y, 'Actual', carry, ''),
    ];

    const q4_2025 = [
        ...hc('Oct', 'Q4', 2025, false), ...hc('Nov', 'Q4', 2025, false), ...hc('Dec', 'Q4', 2025, false),
        txn('10/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('10/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('10/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Oct', 'Q4', 2025),
        txn('10/25/2025', 'Docebo Conference', 5200, '6405', 'Conferences/Events', '401-Education Marketing', 'Annual conference', 'Programs', 'Conferences/Events', 'Oct', 'Q4', 2025, 'Actual', true),
        txn('11/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Nov', 'Q4', 2025, 'Actual', true),
        txn('11/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('11/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('11/20/2025', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Nov', 'Q4', 2025),
        txn('12/15/2025', 'Sponge Software', 6500, '6402', 'Consulting', '400-Marketing', 'Monthly retainer', 'Programs', 'Consulting', 'Dec', 'Q4', 2025, 'Actual', true),
        txn('12/20/2025', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('12/20/2025', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
        txn('12/20/2025', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Dec', 'Q4', 2025),
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
        // Programs - Jan
        txn('01/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/20/2026', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Jan', 'Q1', 2026),
        txn('01/10/2026', 'Content Agency', 3500, '6402', 'Consulting', '402-Corp Marketing', 'Content production', 'Programs', 'Consulting', 'Jan', 'Q1', 2026),
        txn('01/22/2026', 'Trade Show Deposit', 2500, '6405', 'Conferences/Events', '401-Education Marketing', 'Spring trade show', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        txn('01/28/2026', 'Brand Photography', 2000, '6405', 'Conferences/Events', '404-Creative & Brand', 'Product photoshoot', 'Programs', 'Conferences/Events', 'Jan', 'Q1', 2026),
        // Programs - Feb
        txn('02/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('02/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('02/20/2026', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Feb', 'Q1', 2026),
        txn('02/15/2026', 'Content Agency', 2000, '6402', 'Consulting', '402-Corp Marketing', 'Blog content', 'Programs', 'Consulting', 'Feb', 'Q1', 2026),
        txn('02/25/2026', 'Email Platform', 1500, '6402', 'Consulting', '403-Mktg Ops', 'Campaign services', 'Programs', 'Consulting', 'Feb', 'Q1', 2026),
        // Programs - Mar
        txn('03/20/2026', 'LinkedIn Ads', 950, '6406', 'Advertising', '402-Corp Marketing', 'Digital ads', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('03/20/2026', 'Google Ads', 850, '6406', 'Advertising', '402-Corp Marketing', 'Search ads', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('03/20/2026', 'Paperclip Promotions', 300, '6406', 'Advertising', '405-Community & Advocacy', 'Promo items', 'Programs', 'Advertising', 'Mar', 'Q1', 2026),
        txn('03/10/2026', 'Webinar Sponsorship', 3500, '6405', 'Conferences/Events', '402-Corp Marketing', 'Sponsored webinar', 'Programs', 'Conferences/Events', 'Mar', 'Q1', 2026),
        txn('03/15/2026', 'Creative Assets', 2000, '6402', 'Consulting', '404-Creative & Brand', 'Design services', 'Programs', 'Consulting', 'Mar', 'Q1', 2026),
        txn('03/25/2026', 'Sponge Software', 7700, '6402', 'Consulting', '400-Marketing', 'Final month', 'Programs', 'Consulting', 'Mar', 'Q1', 2026, 'Outstanding'),
        // T&E
        txn('02/12/2026', 'Hotel - Sales Kickoff', 1200, '6202', 'Lodging', '400-Marketing', 'Team travel', 'T&E', 'Lodging', 'Feb', 'Q1', 2026),
        txn('03/18/2026', 'Hotel - Conference', 800, '6202', 'Lodging', '401-Education Marketing', 'Event travel', 'T&E', 'Lodging', 'Mar', 'Q1', 2026),
        // Outside Envelope Q1
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
        { vendor: 'LinkedIn Ads', monthly: 950, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Monthly digital ad spend' },
        { vendor: 'Google Ads', monthly: 850, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Monthly search ads' },
        { vendor: 'Paperclip Promotions', monthly: 300, category: 'Programs', gl: '6406', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Promo items' },
        { vendor: 'Kendall Woodard', monthly: 4583.33, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'FTE salary' },
        { vendor: 'Dalton Mullins', monthly: 2083.33, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'FTE salary (reduced)' },
        { vendor: 'Roxana Nabavian', monthly: 5000, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'Contractor' },
        { vendor: 'Kate Bertram', monthly: 2800, category: 'Headcount', gl: '6101', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: 'PT Contractor - no loaded-cost' },
        { vendor: 'Payroll Tax', monthly: 2016.67, category: 'Headcount', gl: '6103', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: '' },
        { vendor: 'Benefits', monthly: 3200, category: 'Headcount', gl: '6104', startMonth: 'Apr', endMonth: 'Dec', status: 'Active', notes: '' },
    ];

    appState.vendorContracts = [
        { vendor: 'Salesforce', before: 93600, after: 52471, savings: 41129, savingsPct: '43.9%', category: 'CRM', status: 'Renewed', notes: 'Renegotiated Q4 2025' },
        { vendor: 'ZoomInfo', before: 63000, after: 15200, savings: 47800, savingsPct: '75.9%', category: 'Data', status: 'Renewed', notes: 'Reduced seats' },
        { vendor: 'Sponge Software', before: 78000, after: 7700, savings: 70300, savingsPct: '90.1%', category: 'Agency', status: 'Ending', notes: 'Final month Mar 2026' },
        { vendor: 'HubSpot', before: 24000, after: 16000, savings: 8000, savingsPct: '33.2%', category: 'Marketing Automation', status: 'Renewed', notes: 'Downgraded plan' },
        { vendor: 'Outreach', before: 51600, after: 25200, savings: 26400, savingsPct: '51.2%', category: 'Sales Engagement', status: 'Renewed', notes: 'Reduced seats' },
        { vendor: 'Wrike', before: 17600, after: 0, savings: 17600, savingsPct: '100%', category: 'PM Tool', status: 'Eliminated', notes: 'Migrated to native tools' },
        { vendor: 'Bynder', before: 11800, after: 0, savings: 11800, savingsPct: '100%', category: 'DAM', status: 'Eliminated', notes: 'No longer needed' },
        { vendor: 'LinkedIn Sales Nav', before: 39900, after: 0, savings: 39900, savingsPct: '100%', category: 'Sales Tool', status: 'Eliminated', notes: 'Consolidated with ZoomInfo' },
    ];

    appState.config = {
        total_budget: '446914', headcount_budget: '336000', programs_budget: '90000', te_budget: '20000',
        company_sw_budget: '871560', marketing_sw_savings: '213623', sw_savings_pct: '24.5%',
        brian_q1_marketing_programs: '85309', pantheon_reclassification: '17426', brian_adjusted_q1: '67883',
        brian_full_year_forecast: '317309', fiscal_year: '2026', budget_basis: 'salary_only_pending_clarification',
        kate_bertram_type: 'PT Contractor - no loaded-cost', sponge_outstanding: '7700',
        q4_carryover_total: '89225.50', netsuite_last_refresh: '2026-03-31'
    };

    appState.lastSynced = new Date();
    recompute();
    renderActiveTab();
}

// ============================================================
// 9. COMPUTATION ENGINE
// ============================================================
function recompute() {
    const tx2026 = appState.transactions.filter(t => t.year === 2026);
    const curMonthIdx = getCurrentMonthIdx();

    // YTD Actuals (2026 only, excluding Outside Envelope for budget tracking)
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

    // Outstanding
    const outstanding = tx2026.filter(t => t.status === 'Outstanding');
    let outstandingPrograms = 0, outstandingTE = 0, outstandingHC = 0;
    outstanding.forEach(t => {
        if (t.category === 'Programs') outstandingPrograms += t.amount;
        else if (t.category === 'T&E') outstandingTE += t.amount;
        else if (t.category === 'Headcount') outstandingHC += t.amount;
    });
    c.outstandingItems = outstanding;

    // Forecast from commitments (remaining months)
    c.forecast = { total: 0, headcount: 0, programs: 0, te: 0 };
    appState.commitments.forEach(cm => {
        if (cm.status !== 'Active') return;
        const start = Math.max(monthIdx(cm.startMonth), curMonthIdx + 1);
        const end = monthIdx(cm.endMonth);
        if (start > end) return;
        const months = end - start + 1;
        const total = cm.monthly * months;
        if (cm.category === 'Headcount') c.forecast.headcount += total;
        else if (cm.category === 'Programs') c.forecast.programs += total;
        else if (cm.category === 'T&E') c.forecast.te += total;
    });
    c.forecast.total = c.forecast.headcount + c.forecast.programs + c.forecast.te;

    // Available
    c.available = {
        headcount: CONFIG.BUDGET.headcount - c.ytdActual.headcount - outstandingHC - c.forecast.headcount,
        programs: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs,
        te: CONFIG.BUDGET.te - c.ytdActual.te - outstandingTE - c.forecast.te,
        total: 0
    };
    c.available.total = c.available.headcount + c.available.programs + c.available.te;

    // Programs Waterfall
    c.programsWaterfall = {
        budget: CONFIG.BUDGET.programs,
        spent: c.ytdActual.programs,
        outstanding: outstandingPrograms,
        committed: c.forecast.programs,
        available: CONFIG.BUDGET.programs - c.ytdActual.programs - outstandingPrograms - c.forecast.programs
    };

    // By Month (for calendar + charts)
    c.byMonth = {};
    const allMonths = [...CONFIG.MONTHS];
    allMonths.forEach(m => {
        c.byMonth[m] = { headcount: 0, programs: 0, te: 0, outside: 0, total: 0 };
    });
    tx2026.forEach(t => {
        if (!c.byMonth[t.month]) return;
        const cat = t.category === 'Headcount' ? 'headcount' :
            t.category === 'Programs' ? 'programs' :
            t.category === 'T&E' ? 'te' : 'outside';
        c.byMonth[t.month][cat] += t.amount;
        if (cat !== 'outside') c.byMonth[t.month].total += t.amount;
    });

    // By Category → Vendor → Amount (for calendar groupings)
    c.byCategory = {};
    c.byVendor = {};
    c.byGL = {};

    appState.transactions.forEach(t => {
        // By Category
        if (!c.byCategory[t.category]) c.byCategory[t.category] = {};
        const vendorKey = t.vendor || 'Other';
        if (!c.byCategory[t.category][vendorKey]) c.byCategory[t.category][vendorKey] = [];
        c.byCategory[t.category][vendorKey].push(t);

        // By Vendor
        if (!c.byVendor[vendorKey]) c.byVendor[vendorKey] = [];
        c.byVendor[vendorKey].push(t);

        // By GL
        const glKey = t.gl + ' - ' + t.glName;
        if (!c.byGL[glKey]) c.byGL[glKey] = [];
        c.byGL[glKey].push(t);
    });
}

// ============================================================
// 10. AUDIENCE FILTERING
// ============================================================
function getFilteredTransactions() {
    const af = appState.audienceFilter;
    if (af === 'full') return appState.transactions;
    if (af === 'team') return appState.transactions.filter(t => t.category !== 'Headcount');
    // CFO: aggregate headcount into subtotals per month
    return appState.transactions;
}

function getFilteredBudget() {
    const af = appState.audienceFilter;
    if (af === 'full') return appState.budget;
    if (af === 'team') return appState.budget.filter(b => b.category !== 'Headcount' && b.category !== 'TOTAL');
    return appState.budget;
}

function isHeadcountVisible() {
    return appState.audienceFilter !== 'team';
}

function shouldShowIndividualHC() {
    return appState.audienceFilter === 'full';
}

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
        calendar: renderCalendar,
        transactions: renderTransactions,
        scenario: renderScenario,
        reconciliation: renderReconciliation,
        savings: renderSavings
    };
    const fn = renderers[appState.activeTab];
    if (fn) fn();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================================
// 12. THEME MANAGEMENT
// ============================================================
function cycleTheme() {
    const themes = ['', 'dark', 'high-contrast'];
    const cur = themes.indexOf(appState.theme);
    appState.theme = themes[(cur + 1) % themes.length];
    document.documentElement.setAttribute('data-theme', appState.theme);
    // Update theme icon
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        const iconName = appState.theme === 'dark' ? 'moon' : appState.theme === 'high-contrast' ? 'contrast' : 'sun';
        icon.setAttribute('data-lucide', iconName);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [icon.parentElement] });
    }
    // Recreate charts for new theme colors
    renderActiveTab();
}

// ============================================================
// 13. PRESENTATION MODE
// ============================================================
function togglePresentation() {
    appState.presentationMode = !appState.presentationMode;
    document.body.classList.toggle('presentation-mode', appState.presentationMode);
    const btn = document.getElementById('presentationToggle');
    btn.classList.toggle('active', appState.presentationMode);
    renderActiveTab();
}

// ============================================================
// 14. DATA FRESHNESS
// ============================================================
function updateFreshness() {
    const dot = document.getElementById('freshnessDot');
    const text = document.getElementById('freshnessText');
    if (appState.isSyncing) {
        dot.className = 'freshness-dot fresh';
        text.textContent = 'Syncing...';
        return;
    }
    if (!appState.lastSynced) {
        dot.className = 'freshness-dot';
        text.textContent = 'Not synced';
        return;
    }
    const diff = Date.now() - appState.lastSynced.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) {
        dot.className = 'freshness-dot fresh';
        text.textContent = 'Synced just now';
    } else if (mins < 30) {
        dot.className = 'freshness-dot fresh';
        text.textContent = 'Synced ' + mins + 'm ago';
    } else if (mins < 120) {
        dot.className = 'freshness-dot stale';
        text.textContent = 'Synced ' + Math.floor(mins / 60) + 'h ago';
    } else {
        dot.className = 'freshness-dot error';
        text.textContent = 'Stale (' + timeAgo(appState.lastSynced) + ')';
    }
    // NetSuite freshness from config
    const nsRefresh = appState.config.netsuite_last_refresh;
    if (nsRefresh) {
        text.title = 'NetSuite synced: ' + nsRefresh + '\nSheets loaded: ' + timeAgo(appState.lastSynced);
    }
}

// ============================================================
// 15. DRILL-DOWN PANEL
// ============================================================
function showDrillDown(transactions, title) {
    const overlay = document.getElementById('drilldownOverlay');
    const titleEl = document.getElementById('drilldownTitle');
    const body = document.getElementById('drilldownBody');
    const count = document.getElementById('drilldownCount');
    const total = document.getElementById('drilldownTotal');

    titleEl.textContent = title;
    const sum = transactions.reduce((s, t) => s + t.amount, 0);
    count.textContent = transactions.length + ' transaction' + (transactions.length !== 1 ? 's' : '');
    total.textContent = fmt(sum);

    let html = '<table><thead><tr>';
    html += '<th>Date</th><th>Vendor</th><th class="num">Amount</th><th>Category</th><th>Status</th>';
    html += '</tr></thead><tbody>';
    transactions.forEach(t => {
        html += `<tr>
            <td>${esc(t.date)}</td>
            <td>${esc(t.vendor)}</td>
            <td class="num ${amountClass(t.amount)}">${fmt(t.amount)}</td>
            <td>${categoryPill(t.category)}</td>
            <td>${statusPill(t.status)}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    body.innerHTML = html;

    overlay.classList.add('active');
}

function closeDrillDown() {
    document.getElementById('drilldownOverlay').classList.remove('active');
}

// ============================================================
// 16. DASHBOARD TAB
// ============================================================
function renderDashboard() {
    const c = appState.computed;
    const el = document.getElementById('tab-dashboard');
    const showHC = isHeadcountVisible();
    const wf = c.programsWaterfall;
    const progPct = wf.budget > 0 ? (wf.budget - wf.available) / wf.budget : 0;
    const progAvailPct = wf.budget > 0 ? wf.available / wf.budget : 0;

    let html = '';

    // KPI Cards
    html += '<div class="kpi-grid">';
    // Hero: Programs Available
    html += `<div class="kpi-card hero ${wf.available < 10000 ? 'warning' : 'positive'}">
        <div class="kpi-label">Programs Available</div>
        <div class="kpi-value">${fmtWhole(wf.available)}</div>
        <div class="kpi-progress"><div class="kpi-progress-bar ${progressColor(progPct)}" style="width:${Math.min(progPct * 100, 100)}%"></div></div>
        <div class="kpi-subtext">${fmtPct(progAvailPct)} of ${fmtWhole(wf.budget)} programs budget remaining</div>
    </div>`;
    // Total Budget
    html += `<div class="kpi-card">
        <div class="kpi-label">Total Budget</div>
        <div class="kpi-value">${fmtWhole(CONFIG.BUDGET.total)}</div>
        <div class="kpi-trend neutral">FY 2026 envelope</div>
    </div>`;
    // YTD Actual
    const ytdPct = CONFIG.BUDGET.total > 0 ? c.ytdActual.total / CONFIG.BUDGET.total : 0;
    html += `<div class="kpi-card">
        <div class="kpi-label">YTD Actual</div>
        <div class="kpi-value">${fmtWhole(c.ytdActual.total)}</div>
        <div class="kpi-trend neutral">Through ${getCurrentMonth()} 2026</div>
    </div>`;
    // Forecast
    const fullYear = c.ytdActual.total + c.forecast.total;
    const fcastPct = CONFIG.BUDGET.total > 0 ? fullYear / CONFIG.BUDGET.total : 0;
    html += `<div class="kpi-card ${fcastPct > 0.95 ? 'warning' : ''}">
        <div class="kpi-label">Full Year Forecast</div>
        <div class="kpi-value">${fmtWhole(fullYear)}</div>
        <div class="kpi-trend ${fcastPct > 1 ? 'negative' : fcastPct > 0.9 ? 'warning' : 'positive'}">${fmtPct(fcastPct)} of budget</div>
    </div>`;
    // Headcount (if visible)
    if (showHC) {
        const hcPct = CONFIG.BUDGET.headcount > 0 ? c.ytdActual.headcount / CONFIG.BUDGET.headcount : 0;
        html += `<div class="kpi-card">
            <div class="kpi-label">Headcount Tracking</div>
            <div class="kpi-value">${fmtWhole(c.ytdActual.headcount)}</div>
            <div class="kpi-progress"><div class="kpi-progress-bar ${progressColor(hcPct)}" style="width:${Math.min(hcPct * 100, 100)}%"></div></div>
            <div class="kpi-subtext">of ${fmtWhole(CONFIG.BUDGET.headcount)} annual budget</div>
        </div>`;
    }
    html += '</div>';

    // Charts row
    html += '<div class="chart-grid">';

    // Programs Waterfall
    html += `<div class="chart-card">
        <div class="chart-title">Programs Waterfall</div>
        <div class="chart-wrapper" id="waterfallChartWrap"><canvas id="waterfallChart"></canvas></div>
    </div>`;

    // Spend by Category
    html += `<div class="chart-card">
        <div class="chart-title">Spend by Category</div>
        <div class="chart-wrapper" id="categoryChartWrap"><canvas id="categoryChart"></canvas></div>
    </div>`;

    html += '</div>';

    // Second row of charts
    html += '<div class="chart-grid">';

    // Monthly Trend
    html += `<div class="chart-card">
        <div class="chart-title">Monthly Spend Trend</div>
        <div class="chart-wrapper" id="trendChartWrap"><canvas id="trendChart"></canvas></div>
    </div>`;

    // Outstanding Items
    html += '<div class="chart-card">';
    html += '<div class="chart-title">Outstanding Items</div>';
    if (c.outstandingItems.length === 0) {
        html += '<div class="empty-state"><p>No outstanding items</p></div>';
    } else {
        html += '<table class="outstanding-table"><tbody>';
        c.outstandingItems.forEach(t => {
            html += `<tr>
                <td class="vendor-col">${esc(t.vendor)}</td>
                <td class="amount-col">${fmt(t.amount)}</td>
                <td class="month-col">${esc(t.month)} ${t.year}</td>
            </tr>`;
        });
        html += '</tbody></table>';
    }
    html += '</div>';
    html += '</div>';

    // Budget vs Actual progress bars
    html += '<div class="section-card">';
    html += '<div class="section-title">Budget vs Actual by Category</div>';
    const bars = [
        { label: 'Headcount', actual: c.ytdActual.headcount, budget: CONFIG.BUDGET.headcount, show: showHC },
        { label: 'Programs', actual: c.ytdActual.programs, budget: CONFIG.BUDGET.programs, show: true },
        { label: 'T&E', actual: c.ytdActual.te, budget: CONFIG.BUDGET.te, show: true },
    ];
    bars.forEach(b => {
        if (!b.show) return;
        const pct = b.budget > 0 ? b.actual / b.budget : 0;
        html += `<div class="budget-progress-item">
            <div class="budget-progress-label">${b.label}</div>
            <div class="budget-progress-track">
                <div class="budget-progress-fill ${progressColor(pct)}" style="width:${Math.min(pct * 100, 100)}%"></div>
            </div>
            <div class="budget-progress-amount">${fmtWhole(b.actual)} / ${fmtWhole(b.budget)}</div>
        </div>`;
    });
    html += '<div class="basis-note">Basis: salary-only (pending confirmation from Brian)</div>';
    html += '</div>';

    el.innerHTML = html;
    renderDashboardCharts();
}

function renderDashboardCharts() {
    destroyChart('waterfall');
    destroyChart('category');
    destroyChart('trend');

    const c = appState.computed;
    const wf = c.programsWaterfall;
    const isDark = appState.theme === 'dark' || appState.theme === 'high-contrast';
    const textColor = isDark ? '#e7e9ea' : '#0A1849';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

    const fontOpts = { family: "'Inter', sans-serif", size: 11 };

    // Waterfall Chart
    const wfCtx = document.getElementById('waterfallChart');
    if (wfCtx) {
        const runningTotal = wf.budget;
        const afterSpent = runningTotal - wf.spent;
        const afterOutstanding = afterSpent - wf.outstanding;
        const afterCommitted = afterOutstanding - wf.committed;

        appState.charts.waterfall = new Chart(wfCtx, {
            type: 'bar',
            data: {
                labels: ['Budget', 'Spent', 'Outstanding', 'Committed', 'Available'],
                datasets: [{
                    data: [
                        [0, wf.budget],
                        [afterSpent, runningTotal],
                        [afterOutstanding, afterSpent],
                        [afterCommitted, afterOutstanding],
                        [0, wf.available]
                    ],
                    backgroundColor: [
                        'rgba(71, 57, 231, 0.8)',
                        'rgba(220, 38, 38, 0.8)',
                        'rgba(217, 119, 6, 0.8)',
                        'rgba(107, 114, 128, 0.7)',
                        'rgba(5, 150, 105, 0.8)'
                    ],
                    borderRadius: 3,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const v = ctx.raw;
                                return fmt(Math.abs(v[1] - v[0]));
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { font: fontOpts, color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Category Doughnut
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
        const showHC = isHeadcountVisible();
        const labels = showHC ? ['Headcount', 'Programs', 'T&E'] : ['Programs', 'T&E'];
        const data = showHC
            ? [c.ytdActual.headcount, c.ytdActual.programs, c.ytdActual.te]
            : [c.ytdActual.programs, c.ytdActual.te];
        const colors = showHC
            ? ['rgba(10, 24, 73, 0.8)', 'rgba(71, 57, 231, 0.8)', 'rgba(255, 186, 0, 0.8)']
            : ['rgba(71, 57, 231, 0.8)', 'rgba(255, 186, 0, 0.8)'];

        appState.charts.category = new Chart(catCtx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: fontOpts, color: textColor, padding: 12 } },
                    tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmt(ctx.raw) } }
                }
            }
        });
    }

    // Monthly Trend
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        const curIdx = getCurrentMonthIdx();
        const actualData = [];
        const forecastData = [];
        CONFIG.MONTHS.forEach((m, i) => {
            const val = c.byMonth[m] ? c.byMonth[m].total : 0;
            if (i <= curIdx && val > 0) {
                actualData.push(val);
                forecastData.push(null);
            } else if (i === curIdx + 1) {
                // Bridge point
                actualData.push(null);
                // Project from commitments
                let committed = 0;
                appState.commitments.forEach(cm => {
                    if (cm.status !== 'Active' || cm.category === 'Outside Envelope') return;
                    const si = monthIdx(cm.startMonth);
                    const ei = monthIdx(cm.endMonth);
                    if (i >= si && i <= ei) committed += cm.monthly;
                });
                forecastData.push(committed);
            } else if (i > curIdx) {
                actualData.push(null);
                let committed = 0;
                appState.commitments.forEach(cm => {
                    if (cm.status !== 'Active' || cm.category === 'Outside Envelope') return;
                    const si = monthIdx(cm.startMonth);
                    const ei = monthIdx(cm.endMonth);
                    if (i >= si && i <= ei) committed += cm.monthly;
                });
                forecastData.push(committed);
            } else {
                actualData.push(null);
                forecastData.push(null);
            }
        });

        // Connect last actual to first forecast
        if (curIdx >= 0 && curIdx < 11 && actualData[curIdx] != null) {
            forecastData[curIdx] = actualData[curIdx];
        }

        appState.charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: CONFIG.MONTHS,
                datasets: [
                    {
                        label: 'Actual',
                        data: actualData,
                        borderColor: 'rgba(71, 57, 231, 1)',
                        backgroundColor: 'rgba(71, 57, 231, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgba(71, 57, 231, 1)',
                        spanGaps: false
                    },
                    {
                        label: 'Forecast',
                        data: forecastData,
                        borderColor: 'rgba(107, 114, 128, 0.6)',
                        borderDash: [6, 4],
                        backgroundColor: 'rgba(107, 114, 128, 0.05)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointStyle: 'circle',
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } },
                    tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { font: fontOpts, color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function destroyChart(name) {
    if (appState.charts[name]) {
        appState.charts[name].destroy();
        appState.charts[name] = null;
    }
}

// ============================================================
// 17. CALENDAR TAB
// ============================================================
function renderCalendar() {
    const el = document.getElementById('tab-calendar');
    const tx = getFilteredTransactions();
    const grouping = appState.calendarGrouping;
    const curMonth = getCurrentMonth();
    const curMonthI = getCurrentMonthIdx();

    // Toolbar
    let html = '<div class="calendar-toolbar">';
    html += '<div class="flex items-center gap-8">';
    html += '<label class="form-label" style="margin:0">Group by:</label>';
    html += `<select class="filter-select" id="calendarGrouping" onchange="changeCalendarGrouping(this.value)">
        <option value="category" ${grouping === 'category' ? 'selected' : ''}>Category</option>
        <option value="vendor" ${grouping === 'vendor' ? 'selected' : ''}>Vendor</option>
        <option value="gl" ${grouping === 'gl' ? 'selected' : ''}>GL Account</option>
    </select>`;
    html += '</div>';
    html += '<div class="calendar-legend">';
    html += '<div class="legend-item"><div class="legend-swatch legend-actual"></div>Actual</div>';
    html += '<div class="legend-item"><div class="legend-swatch legend-forecast"></div>Forecast</div>';
    html += '<div class="legend-item"><div class="legend-swatch legend-outstanding"></div>Outstanding</div>';
    html += '</div></div>';

    // Build column structure
    // Q4 2025: Oct, Nov, Dec, Q4 Total
    // Q1 2026: Jan, Feb, Mar, Q1 Total
    // Q2: Apr, May, Jun, Q2 Total
    // Q3: Jul, Aug, Sep, Q3 Total
    // Q4 2026: Oct, Nov, Dec, Q4 Total
    // Annual Total
    const cols = [];
    // Q4 2025
    ['Oct', 'Nov', 'Dec'].forEach(m => cols.push({ month: m, year: 2025, type: 'month' }));
    cols.push({ label: 'Q4 \'25', type: 'quarter', months: ['Oct', 'Nov', 'Dec'], year: 2025 });
    // Q1-Q4 2026
    Object.entries(CONFIG.QUARTERS).forEach(([q, ms]) => {
        ms.forEach(m => cols.push({ month: m, year: 2026, type: 'month' }));
        cols.push({ label: q, type: 'quarter', months: ms, year: 2026 });
    });
    cols.push({ label: 'Annual', type: 'annual' });

    // Build row groups
    const groups = buildCalendarGroups(tx, grouping);

    // Render table
    html += '<div class="calendar-container">';
    html += '<table class="calendar-table">';

    // Header row
    html += '<thead><tr><th class="row-label">Item</th>';
    cols.forEach(col => {
        let cls = '';
        if (col.type === 'quarter') cls = 'quarter-header';
        if (col.type === 'annual') cls = 'quarter-header';
        if (col.type === 'month' && col.month === curMonth && col.year === 2026) cls = 'current-month';
        const label = col.type === 'month' ? col.month + (col.year === 2025 ? ' \'25' : '') : col.label;
        html += `<th class="num ${cls}">${label}</th>`;
    });
    html += '</tr></thead>';

    // Body rows
    html += '<tbody>';
    const grandTotals = new Array(cols.length).fill(0);

    groups.forEach(group => {
        // Group header (category row)
        html += `<tr class="category-row"><td class="row-label-cell" colspan="${cols.length + 1}">${esc(group.label)}</td></tr>`;

        group.items.forEach(item => {
            html += '<tr>';
            html += `<td class="row-label-cell">${esc(item.label)}</td>`;
            cols.forEach((col, ci) => {
                const val = getCalendarCellValue(item.transactions, col);
                const isAct = col.type === 'month' ? isActualPeriod(col.month, col.year) : false;
                const hasOutstanding = col.type === 'month' && item.transactions.some(t =>
                    t.month === col.month && t.year === col.year && t.status === 'Outstanding');
                let cellClass = col.type === 'quarter' ? 'quarter-total-cell num' :
                    col.type === 'annual' ? 'annual-total-cell num' :
                    isAct ? 'actual-cell num' : 'forecast-cell num';
                if (hasOutstanding) cellClass += ' outstanding-cell';
                if (val !== 0) cellClass += ' clickable';
                const onclick = val !== 0 ? ` onclick="drillCalendarCell('${item.label}', ${JSON.stringify(col).replace(/"/g, '&quot;')})"` : '';
                html += `<td class="${cellClass}"${onclick}>${val !== 0 ? fmt(val) : ''}</td>`;
                grandTotals[ci] += val;
            });
            html += '</tr>';
        });

        // Group subtotal
        html += '<tr class="subtotal-row">';
        html += `<td class="row-label-cell">${esc(group.label)} Total</td>`;
        cols.forEach((col, ci) => {
            const val = getCalendarCellValue(group.allTransactions, col);
            const cls = col.type === 'quarter' ? 'quarter-total-cell' : col.type === 'annual' ? 'annual-total-cell' : '';
            html += `<td class="num ${cls}">${val !== 0 ? fmt(val) : ''}</td>`;
        });
        html += '</tr>';
    });

    // Grand total row
    html += '<tr class="grand-total-row">';
    html += '<td class="row-label-cell">Grand Total</td>';
    cols.forEach((col, ci) => {
        const val = grandTotals[ci];
        html += `<td class="num">${val !== 0 ? fmt(val) : ''}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function buildCalendarGroups(transactions, grouping) {
    const groups = [];
    if (grouping === 'category') {
        const cats = ['Headcount', 'Programs', 'T&E', 'Outside Envelope'];
        const showHC = isHeadcountVisible();
        cats.forEach(cat => {
            if (cat === 'Headcount' && !showHC) return;
            const catTx = transactions.filter(t => t.category === cat);
            if (catTx.length === 0) return;
            // Group by vendor within category
            const vendors = {};
            catTx.forEach(t => {
                const v = t.vendor || 'Other';
                if (!vendors[v]) vendors[v] = [];
                vendors[v].push(t);
            });
            // For CFO view, aggregate headcount
            if (cat === 'Headcount' && !shouldShowIndividualHC()) {
                groups.push({
                    label: cat,
                    items: [{ label: 'Headcount (aggregated)', transactions: catTx }],
                    allTransactions: catTx
                });
            } else {
                groups.push({
                    label: cat,
                    items: Object.entries(vendors).map(([v, txs]) => ({ label: v, transactions: txs })),
                    allTransactions: catTx
                });
            }
        });
    } else if (grouping === 'vendor') {
        const vendors = {};
        transactions.forEach(t => {
            const v = t.vendor || 'Other';
            if (!vendors[v]) vendors[v] = [];
            vendors[v].push(t);
        });
        Object.entries(vendors).sort(([a], [b]) => a.localeCompare(b)).forEach(([v, txs]) => {
            groups.push({
                label: v,
                items: [{ label: v, transactions: txs }],
                allTransactions: txs
            });
        });
    } else { // gl
        const gls = {};
        transactions.forEach(t => {
            const key = t.gl + ' - ' + t.glName;
            if (!gls[key]) gls[key] = [];
            gls[key].push(t);
        });
        Object.entries(gls).sort(([a], [b]) => a.localeCompare(b)).forEach(([gl, txs]) => {
            groups.push({
                label: gl,
                items: [{ label: gl, transactions: txs }],
                allTransactions: txs
            });
        });
    }
    return groups;
}

function getCalendarCellValue(transactions, col) {
    if (col.type === 'month') {
        return transactions.filter(t => t.month === col.month && t.year === col.year).reduce((s, t) => s + t.amount, 0);
    }
    if (col.type === 'quarter') {
        return transactions.filter(t => col.months.includes(t.month) && t.year === col.year).reduce((s, t) => s + t.amount, 0);
    }
    if (col.type === 'annual') {
        return transactions.filter(t => t.year === 2026).reduce((s, t) => s + t.amount, 0);
    }
    return 0;
}

function changeCalendarGrouping(val) {
    appState.calendarGrouping = val;
    renderCalendar();
}

function drillCalendarCell(label, col) {
    const tx = getFilteredTransactions();
    let filtered;
    if (col.type === 'month') {
        filtered = tx.filter(t => t.month === col.month && t.year === col.year &&
            (t.vendor === label || t.category === label || (t.gl + ' - ' + t.glName) === label));
    } else if (col.type === 'quarter') {
        filtered = tx.filter(t => col.months.includes(t.month) && t.year === col.year &&
            (t.vendor === label || t.category === label || (t.gl + ' - ' + t.glName) === label));
    } else {
        filtered = tx.filter(t => t.year === 2026 &&
            (t.vendor === label || t.category === label || (t.gl + ' - ' + t.glName) === label));
    }
    if (filtered.length > 0) {
        const title = label + (col.type === 'month' ? ' — ' + col.month + ' ' + col.year : col.type === 'quarter' ? ' — ' + col.label : ' — Annual');
        showDrillDown(filtered, title);
    }
}

// ============================================================
// 18. TRANSACTIONS TAB
// ============================================================
function renderTransactions() {
    const el = document.getElementById('tab-transactions');
    const allTx = getFilteredTransactions();
    const f = appState.txFilters;

    // Apply filters
    let filtered = allTx.filter(t => {
        if (f.search) {
            const s = f.search.toLowerCase();
            if (!(t.vendor.toLowerCase().includes(s) || t.memo.toLowerCase().includes(s) ||
                t.glName.toLowerCase().includes(s) || t.department.toLowerCase().includes(s))) return false;
        }
        if (f.category && t.category !== f.category) return false;
        if (f.quarter) {
            const tq = t.quarter + (t.year === 2025 ? ' 2025' : ' 2026');
            if (tq !== f.quarter) return false;
        }
        if (f.status && t.status !== f.status) return false;
        return true;
    });

    // Sort
    if (appState.txSort.col) {
        const col = appState.txSort.col;
        const dir = appState.txSort.dir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (col === 'amount') return (va - vb) * dir;
            if (col === 'date') return (new Date(va) - new Date(vb)) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });
    }

    // Build HTML
    let html = '';

    // Filter bar
    const showHC = isHeadcountVisible();
    html += '<div class="filter-bar">';
    html += `<input type="text" class="filter-input" placeholder="Search vendor, memo, GL..." value="${esc(f.search)}" oninput="updateTxFilter('search', this.value)">`;
    html += `<select class="filter-select" onchange="updateTxFilter('category', this.value)">
        <option value="">All Categories</option>
        ${showHC ? '<option value="Headcount"' + (f.category === 'Headcount' ? ' selected' : '') + '>Headcount</option>' : ''}
        <option value="Programs" ${f.category === 'Programs' ? 'selected' : ''}>Programs</option>
        <option value="T&E" ${f.category === 'T&E' ? 'selected' : ''}>T&E</option>
        <option value="Outside Envelope" ${f.category === 'Outside Envelope' ? 'selected' : ''}>Outside Envelope</option>
    </select>`;
    html += `<select class="filter-select" onchange="updateTxFilter('quarter', this.value)">
        <option value="">All Quarters</option>
        <option value="Q4 2025" ${f.quarter === 'Q4 2025' ? 'selected' : ''}>Q4 2025</option>
        <option value="Q1 2026" ${f.quarter === 'Q1 2026' ? 'selected' : ''}>Q1 2026</option>
        <option value="Q2 2026" ${f.quarter === 'Q2 2026' ? 'selected' : ''}>Q2 2026</option>
        <option value="Q3 2026" ${f.quarter === 'Q3 2026' ? 'selected' : ''}>Q3 2026</option>
        <option value="Q4 2026" ${f.quarter === 'Q4 2026' ? 'selected' : ''}>Q4 2026</option>
    </select>`;
    html += `<select class="filter-select" onchange="updateTxFilter('status', this.value)">
        <option value="">All Status</option>
        <option value="Actual" ${f.status === 'Actual' ? 'selected' : ''}>Actual</option>
        <option value="Outstanding" ${f.status === 'Outstanding' ? 'selected' : ''}>Outstanding</option>
    </select>`;
    html += `<button class="filter-clear" onclick="clearTxFilters()">Clear filters</button>`;
    html += `<button class="btn btn-secondary" onclick="exportCSV()"><i data-lucide="download" style="width:14px;height:14px"></i> CSV</button>`;
    if (!appState.presentationMode) {
        html += `<button class="btn btn-primary" data-action="add" onclick="openAddTxModal()"><i data-lucide="plus" style="width:14px;height:14px"></i> Add</button>`;
    }
    html += '</div>';

    // Table
    html += '<div class="table-container"><div class="table-scroll">';
    html += '<table>';

    // Header
    const sortIcon = (col) => {
        if (appState.txSort.col !== col) return '<span class="sort-indicator">↕</span>';
        return appState.txSort.dir === 'asc' ? '<span class="sort-indicator">↑</span>' : '<span class="sort-indicator">↓</span>';
    };
    const sortClass = (col) => {
        if (appState.txSort.col !== col) return 'sortable';
        return 'sortable sort-' + appState.txSort.dir;
    };
    html += '<thead><tr>';
    html += `<th class="${sortClass('date')}" onclick="sortTx('date')">Date ${sortIcon('date')}</th>`;
    html += `<th class="${sortClass('vendor')}" onclick="sortTx('vendor')">Vendor ${sortIcon('vendor')}</th>`;
    html += `<th class="num ${sortClass('amount')}" onclick="sortTx('amount')">Amount ${sortIcon('amount')}</th>`;
    html += `<th class="${sortClass('category')}" onclick="sortTx('category')">Category ${sortIcon('category')}</th>`;
    html += '<th>Subcategory</th>';
    html += '<th>GL</th>';
    html += '<th>Department</th>';
    html += '<th>Memo</th>';
    html += '<th>Status</th>';
    if (!appState.presentationMode) html += '<th></th>';
    html += '</tr></thead>';

    // Group by category
    html += '<tbody>';
    const catOrder = showHC ? ['Headcount', 'Programs', 'T&E', 'Outside Envelope'] : ['Programs', 'T&E', 'Outside Envelope'];
    const grouped = {};
    filtered.forEach(t => {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
    });

    catOrder.forEach(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return;
        const catTotal = items.reduce((s, t) => s + t.amount, 0);
        const colSpan = appState.presentationMode ? 9 : 10;
        html += `<tr class="category-row"><td colspan="${colSpan}">${esc(cat)} (${items.length}) — ${fmt(catTotal)}</td></tr>`;

        items.forEach(t => {
            html += '<tr>';
            html += `<td>${esc(t.date)}</td>`;
            html += `<td>${esc(t.vendor)}</td>`;
            html += `<td class="num ${amountClass(t.amount)}">${fmt(t.amount)}</td>`;
            html += `<td>${categoryPill(t.category)}</td>`;
            html += `<td>${esc(t.subcategory)}</td>`;
            html += `<td>${esc(t.gl)}</td>`;
            html += `<td>${esc(t.department)}</td>`;
            html += `<td>${esc(t.memo)}</td>`;
            html += `<td>${statusPill(t.status)}</td>`;
            if (!appState.presentationMode) {
                html += `<td><div class="row-actions">
                    <button class="row-action-btn" onclick="openEditTxModal(${t._row})" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="row-action-btn danger" onclick="confirmDeleteTx(${t._row})" title="Delete"><i data-lucide="trash-2"></i></button>
                </div></td>`;
            }
            html += '</tr>';
        });
    });

    // Grand total
    const grandTotal = filtered.reduce((s, t) => s + t.amount, 0);
    const colSpan = appState.presentationMode ? 9 : 10;
    html += `<tr class="grand-total-row"><td colspan="2">Total (${filtered.length} transactions)</td><td class="num">${fmt(grandTotal)}</td><td colspan="${colSpan - 3}"></td></tr>`;

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
}

function updateTxFilter(key, val) {
    appState.txFilters[key] = val;
    if (key === 'search') {
        debounce(renderTransactions, 300)();
    } else {
        renderTransactions();
    }
}

function clearTxFilters() {
    appState.txFilters = { search: '', category: '', quarter: '', status: '' };
    renderTransactions();
}

function sortTx(col) {
    if (appState.txSort.col === col) {
        appState.txSort.dir = appState.txSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        appState.txSort.col = col;
        appState.txSort.dir = 'asc';
    }
    renderTransactions();
}

function exportCSV() {
    const tx = getFilteredTransactions();
    const headers = ['Date', 'Vendor', 'Amount', 'GL_Account', 'GL_Name', 'Department', 'Memo', 'Category', 'Subcategory', 'Month', 'Quarter', 'Year', 'Status'];
    const rows = tx.map(t => [t.date, t.vendor, t.amount, t.gl, t.glName, t.department, t.memo, t.category, t.subcategory, t.month, t.quarter, t.year, t.status]);
    const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketing_budget_transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
}

// Transaction Modal
function openAddTxModal() {
    showTxModal(null);
}

function openEditTxModal(row) {
    const tx = appState.transactions.find(t => t._row === row);
    if (tx) showTxModal(tx);
}

function showTxModal(tx) {
    const isEdit = !!tx;
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');

    title.textContent = isEdit ? 'Edit Transaction' : 'Add Transaction';

    const glOptions = Object.entries(CONFIG.GL_MAP).map(([code, info]) =>
        `<option value="${code}" ${tx && tx.gl === code ? 'selected' : ''}>${code} — ${info.sub}</option>`).join('');

    body.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" id="txDate" value="${tx ? tx.date : new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label class="form-label">Amount</label>
                <input type="number" class="form-input" id="txAmount" step="0.01" value="${tx ? tx.amount : ''}">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Vendor</label>
            <input type="text" class="form-input" id="txVendor" value="${tx ? esc(tx.vendor) : ''}">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">GL Account</label>
                <select class="form-select" id="txGL">${glOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label">Department</label>
                <select class="form-select" id="txDept">
                    <option value="400-Marketing" ${tx && tx.department === '400-Marketing' ? 'selected' : ''}>400-Marketing</option>
                    <option value="401-Education Marketing" ${tx && tx.department === '401-Education Marketing' ? 'selected' : ''}>401-Education Marketing</option>
                    <option value="402-Corp Marketing" ${tx && tx.department === '402-Corp Marketing' ? 'selected' : ''}>402-Corp Marketing</option>
                    <option value="403-Mktg Ops" ${tx && tx.department === '403-Mktg Ops' ? 'selected' : ''}>403-Mktg Ops</option>
                    <option value="404-Creative & Brand" ${tx && tx.department === '404-Creative & Brand' ? 'selected' : ''}>404-Creative & Brand</option>
                    <option value="405-Community & Advocacy" ${tx && tx.department === '405-Community & Advocacy' ? 'selected' : ''}>405-Community & Advocacy</option>
                    <option value="406-Sales Enablement" ${tx && tx.department === '406-Sales Enablement' ? 'selected' : ''}>406-Sales Enablement</option>
                    <option value="407-Mktg Leadership" ${tx && tx.department === '407-Mktg Leadership' ? 'selected' : ''}>407-Mktg Leadership</option>
                    <option value="408-SDRs" ${tx && tx.department === '408-SDRs' ? 'selected' : ''}>408-SDRs</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Memo</label>
            <input type="text" class="form-input" id="txMemo" value="${tx ? esc(tx.memo) : ''}">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="txStatus">
                    <option value="Actual" ${tx && tx.status === 'Actual' ? 'selected' : ''}>Actual</option>
                    <option value="Outstanding" ${tx && tx.status === 'Outstanding' ? 'selected' : ''}>Outstanding</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Employee Type</label>
                <select class="form-select" id="txEmpType">
                    <option value="" ${!tx || !tx.employeeType ? 'selected' : ''}>(none)</option>
                    <option value="FTE" ${tx && tx.employeeType === 'FTE' ? 'selected' : ''}>FTE</option>
                    <option value="Contractor" ${tx && tx.employeeType === 'Contractor' ? 'selected' : ''}>Contractor</option>
                </select>
            </div>
        </div>`;

    footer.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveTxModal(${isEdit ? tx._row : 'null'})">${isEdit ? 'Save' : 'Add'}</button>`;

    overlay.classList.add('active');
}

async function saveTxModal(editRow) {
    const dateVal = document.getElementById('txDate').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const vendor = document.getElementById('txVendor').value.trim();
    const gl = document.getElementById('txGL').value;
    const dept = document.getElementById('txDept').value;
    const memo = document.getElementById('txMemo').value.trim();
    const status = document.getElementById('txStatus').value;
    const empType = document.getElementById('txEmpType').value;

    if (!dateVal || isNaN(amount) || !vendor) {
        showToast('Please fill in required fields (Date, Amount, Vendor)', 'warning');
        return;
    }

    const d = new Date(dateVal);
    const dateFormatted = (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
        d.getDate().toString().padStart(2, '0') + '/' + d.getFullYear();
    const month = CONFIG.MONTHS[d.getMonth()];
    const quarter = quarterOf(month);
    const year = d.getFullYear();
    const glInfo = CONFIG.GL_MAP[gl] || { cat: 'Programs', sub: '' };
    const category = glInfo.cat;
    const subcategory = glInfo.sub;
    const glName = subcategory;
    const isCarryover = year < 2026 ? 'Yes' : 'No';

    const row = [dateFormatted, vendor, amount, gl, glName, dept, memo, category, subcategory, month, quarter, year, status, isCarryover, empType];

    // Optimistic update
    const newTx = {
        _row: editRow || appState.transactions.length + 2,
        date: dateFormatted, vendor, amount, gl, glName, department: dept, memo,
        category, subcategory, month, quarter, year, status,
        isCarryover: isCarryover === 'Yes', employeeType: empType
    };

    if (editRow) {
        const idx = appState.transactions.findIndex(t => t._row === editRow);
        if (idx >= 0) appState.transactions[idx] = newTx;
        writeToSheets(`Transactions!A${editRow}:O${editRow}`, [row]);
    } else {
        appState.transactions.push(newTx);
        appendToSheets('Transactions!A:O', [row]);
    }

    recompute();
    closeModal();
    renderActiveTab();
}

function confirmDeleteTx(row) {
    if (confirm('Delete this transaction?')) {
        appState.transactions = appState.transactions.filter(t => t._row !== row);
        recompute();
        renderActiveTab();
        showToast('Transaction deleted locally. Refresh to sync with Sheets.', 'info');
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ============================================================
// 19. SCENARIO TAB
// ============================================================
function renderScenario() {
    const el = document.getElementById('tab-scenario');
    const s = appState.scenarioInput;
    const c = appState.computed;

    const catBudget = s.category === 'Programs' ? CONFIG.BUDGET.programs : CONFIG.BUDGET.te;
    const catLabel = s.category;
    const catActual = s.category === 'Programs' ? c.ytdActual.programs : c.ytdActual.te;
    const catOutstanding = s.category === 'Programs' ? c.programsWaterfall.outstanding : 0;
    const catCommitted = s.category === 'Programs' ? c.programsWaterfall.committed :
        appState.commitments.filter(cm => cm.category === 'T&E' && cm.status === 'Active').reduce((s, cm) => {
            const start = Math.max(monthIdx(cm.startMonth), getCurrentMonthIdx() + 1);
            const end = monthIdx(cm.endMonth);
            return s + (end >= start ? cm.monthly * (end - start + 1) : 0);
        }, 0);
    const available = catBudget - catActual - catOutstanding - catCommitted;
    const remaining = available - (s.amount || 0);
    const verdict = remaining >= catBudget * 0.1 ? 'ok' : remaining >= 0 ? 'tight' : 'over';
    const verdictLabel = verdict === 'ok' ? 'Within Budget' : verdict === 'tight' ? 'Tight' : 'Over Budget';
    const pctOfBudget = catBudget > 0 ? (s.amount || 0) / catBudget : 0;

    let html = '<div class="scenario-layout">';

    // Input panel
    html += '<div class="scenario-input-panel section-card">';
    html += '<div class="section-title">Scenario Input</div>';
    html += `<div class="form-group">
        <label class="form-label">Amount ($)</label>
        <input type="number" class="form-input" id="scenarioAmount" step="100" value="${s.amount || ''}" placeholder="e.g. 8000"
            oninput="updateScenario('amount', parseFloat(this.value) || 0)">
    </div>`;
    html += `<div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="scenarioCategory" onchange="updateScenario('category', this.value)">
            <option value="Programs" ${s.category === 'Programs' ? 'selected' : ''}>Programs</option>
            <option value="T&E" ${s.category === 'T&E' ? 'selected' : ''}>T&E</option>
        </select>
    </div>`;
    html += `<div class="form-group">
        <label class="form-label">Quarter</label>
        <select class="form-select" id="scenarioQuarter" onchange="updateScenario('quarter', this.value)">
            <option value="Q2" ${s.quarter === 'Q2' ? 'selected' : ''}>Q2 2026</option>
            <option value="Q3" ${s.quarter === 'Q3' ? 'selected' : ''}>Q3 2026</option>
            <option value="Q4" ${s.quarter === 'Q4' ? 'selected' : ''}>Q4 2026</option>
        </select>
    </div>`;
    html += `<div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input type="text" class="form-input" id="scenarioDesc" value="${esc(s.description)}" placeholder="e.g. Sponsored webinar"
            oninput="updateScenario('description', this.value)">
    </div>`;
    html += '</div>';

    // Results panel
    html += '<div>';
    html += '<div class="section-card">';
    html += '<div class="section-title">Impact Analysis</div>';

    if (s.amount > 0) {
        html += `<div class="scenario-verdict verdict-${verdict}">${verdictLabel}</div>`;

        html += '<table class="scenario-impact-table">';
        html += `<tr><td>${catLabel} Budget:</td><td>${fmt(catBudget)}</td></tr>`;
        html += `<tr><td>YTD Actual Spend:</td><td class="amount-negative">-${fmt(catActual)}</td></tr>`;
        if (catOutstanding > 0) {
            html += `<tr><td>Outstanding:</td><td class="amount-negative">-${fmt(catOutstanding)}</td></tr>`;
        }
        html += `<tr><td>Committed Forecast:</td><td class="amount-negative">-${fmt(catCommitted)}</td></tr>`;
        html += `<tr class="divider"><td>Currently Available:</td><td>${fmt(available)}</td></tr>`;
        html += `<tr><td>This Request:</td><td class="amount-negative">-${fmt(s.amount)}</td></tr>`;
        html += `<tr class="result"><td>Remaining After:</td><td class="${amountClass(remaining)}">${fmt(remaining)}</td></tr>`;
        html += '</table>';

        html += `<div class="kpi-subtext mt-12">This represents ${fmtPct(pctOfBudget)} of the ${catLabel} budget.</div>`;
    } else {
        html += '<div class="empty-state"><p>Enter an amount to see the impact analysis.</p></div>';
    }
    html += '</div>';

    // Copyable summary
    if (s.amount > 0) {
        const desc = s.description || '[description]';
        const summaryText = `Marketing ${catLabel} budget: ${fmt(catBudget)}. Through Q1, ${fmt(catActual)} spent${catOutstanding > 0 ? ' with ' + fmt(catOutstanding) + ' outstanding' : ''}. Known commitments for Q2-Q4: ${fmt(catCommitted)}. Available for new allocation: ${fmt(available)}.\n\nProposed: ${fmt(s.amount)} for ${desc} in ${s.quarter}. Remaining after approval: ${fmt(remaining)} (${fmtPct(remaining / catBudget)} of ${catLabel.toLowerCase()} budget).`;

        html += '<div class="section-card">';
        html += '<div class="section-title">Summary (Copy for Email/Slack)</div>';
        html += `<div class="scenario-summary">
            <button class="copy-btn" onclick="copyScenarioSummary()"><i data-lucide="copy"></i> Copy</button>
            <pre style="white-space:pre-wrap;font-family:var(--font-family);font-size:13px;margin:0" id="scenarioSummaryText">${esc(summaryText)}</pre>
        </div>`;
        html += '</div>';
    }

    html += '</div></div>';
    el.innerHTML = html;
}

function updateScenario(key, val) {
    appState.scenarioInput[key] = val;
    renderScenario();
}

function copyScenarioSummary() {
    const text = document.getElementById('scenarioSummaryText').textContent;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
}

// ============================================================
// 20. RECONCILIATION TAB
// ============================================================
function renderReconciliation() {
    const el = document.getElementById('tab-reconciliation');
    const cfg = appState.config;
    const brianQ1 = parseNum(cfg.brian_q1_marketing_programs);
    const pantheon = parseNum(cfg.pantheon_reclassification);
    const adjusted = parseNum(cfg.brian_adjusted_q1);
    const brianFull = parseNum(cfg.brian_full_year_forecast);

    // Find Q4 2025 carryovers paid in Q1 2026
    const carryovers = appState.transactions.filter(t =>
        t.isCarryover && t.year === 2025 && t.category === 'Programs');
    const carryoverTotal = carryovers.reduce((s, t) => s + t.amount, 0);

    let html = '';

    // Bridge walkdown
    html += '<div class="section-card recon-bridge">';
    html += '<div class="section-title">Q1 Reconciliation Bridge</div>';
    html += '<table class="bridge-table">';
    html += `<tr class="bridge-start"><td>Brian's Cash-Basis Q1 Marketing Programs</td><td>${fmt(brianQ1)}</td></tr>`;
    html += `<tr class="bridge-adjustment"><td>Pantheon reclassification (website hosting &#8594; software)</td><td class="amount-negative">-${fmt(pantheon)}</td></tr>`;
    html += `<tr class="bridge-adjustment"><td>= Adjusted Marketing Programs</td><td>${fmt(adjusted)}</td></tr>`;
    if (carryoverTotal > 0) {
        html += `<tr class="bridge-adjustment"><td>Q4 2025 carryovers paid in Q1 2026</td><td class="amount-negative">-${fmt(carryoverTotal)}</td></tr>`;
        html += `<tr class="bridge-result"><td>Q1 2026 Marketing Programs Actual</td><td>${fmt(adjusted - carryoverTotal)}</td></tr>`;
    } else {
        html += `<tr class="bridge-result"><td>Q1 2026 Adjusted Marketing Programs</td><td>${fmt(adjusted)}</td></tr>`;
    }
    html += '</table>';
    html += '</div>';

    // Categorization differences
    html += '<div class="section-card">';
    html += '<div class="section-title">Categorization Notes</div>';
    html += '<div class="table-container"><table class="recon-notes-table">';
    html += '<thead><tr><th>Item</th><th>Brian\'s Category</th><th>Russell\'s Category</th><th class="num">Amount</th><th>Rationale</th></tr></thead>';
    html += '<tbody>';
    html += `<tr>
        <td>Pantheon</td>
        <td>${categoryPill('Programs')}</td>
        <td>${categoryPill('Outside Envelope')}</td>
        <td class="num">${fmt(pantheon)}</td>
        <td>Website CMS hosting infrastructure (GL 6303). Not a marketing program.</td>
    </tr>`;
    html += '</tbody></table></div>';
    html += '</div>';

    // Q4 2025 Carryover Reference
    if (carryovers.length > 0) {
        html += '<div class="section-card">';
        html += '<div class="section-title">Q4 2025 Carryover Reference</div>';
        html += '<p class="text-muted mb-12" style="font-size:12px">Transactions accrued in Q4 2025 with cash payments in Q1 2026. These represent timing differences between cash and accrual views.</p>';
        html += '<div class="table-container"><table>';
        html += '<thead><tr><th>Vendor</th><th>Accrual Month</th><th class="num">Amount</th><th>Category</th></tr></thead>';
        html += '<tbody>';
        carryovers.forEach(t => {
            html += `<tr>
                <td>${esc(t.vendor)}</td>
                <td>${esc(t.month)} ${t.year}</td>
                <td class="num">${fmt(t.amount)}</td>
                <td>${categoryPill(t.category)}</td>
            </tr>`;
        });
        html += `<tr class="subtotal-row"><td colspan="2">Total Carryover</td><td class="num">${fmt(carryoverTotal)}</td><td></td></tr>`;
        html += '</tbody></table></div>';
        html += '</div>';
    }

    // Brian's Reference Numbers
    html += '<div class="section-card">';
    html += '<div class="section-title">Brian\'s Reference Numbers (from Cash Flow Tracker)</div>';
    html += '<table class="scenario-impact-table">';
    html += `<tr><td>Q1 Marketing Programs:</td><td>${fmt(brianQ1)}</td></tr>`;
    html += `<tr><td>Full Year Forecast:</td><td>${fmt(brianFull)}</td></tr>`;
    html += `<tr><td>Company SW Budget:</td><td>${fmt(parseNum(cfg.company_sw_budget))}</td></tr>`;
    html += `<tr><td>NetSuite Last Refresh:</td><td>${cfg.netsuite_last_refresh || 'N/A'}</td></tr>`;
    html += '</table>';
    html += '</div>';

    el.innerHTML = html;
}

// ============================================================
// 21. SAVINGS TAB
// ============================================================
function renderSavings() {
    const el = document.getElementById('tab-savings');
    const vendors = appState.vendorContracts;
    const totalBefore = vendors.reduce((s, v) => s + v.before, 0);
    const totalAfter = vendors.reduce((s, v) => s + v.after, 0);
    const totalSavings = vendors.reduce((s, v) => s + v.savings, 0);
    const companySW = parseNum(appState.config.company_sw_budget) || 871560;
    const savingsPct = companySW > 0 ? totalSavings / companySW : 0;

    let html = '';

    // KPIs
    html += '<div class="savings-kpi-grid">';
    html += `<div class="kpi-card positive">
        <div class="kpi-label">Marketing SW Savings</div>
        <div class="kpi-value">${fmtWhole(totalSavings)}</div>
        <div class="kpi-trend positive">${fmtPct(totalSavings / totalBefore)} reduction</div>
    </div>`;
    html += `<div class="kpi-card">
        <div class="kpi-label">Company SW Budget</div>
        <div class="kpi-value">${fmtWhole(companySW)}</div>
        <div class="kpi-trend neutral">FY 2026 total</div>
    </div>`;
    html += `<div class="kpi-card gold">
        <div class="kpi-label">Marketing Savings Impact</div>
        <div class="kpi-value">${fmtPct(savingsPct)}</div>
        <div class="kpi-trend positive">of company SW budget</div>
    </div>`;
    html += '</div>';

    // Vendor table + chart
    html += '<div class="two-col">';

    // Table
    html += '<div class="table-container"><table>';
    html += '<thead><tr><th>Vendor</th><th class="num">Previous</th><th class="num">Current</th><th class="num">Savings</th><th class="num">%</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    vendors.forEach(v => {
        html += `<tr>
            <td>${esc(v.vendor)}</td>
            <td class="num">${fmtWhole(v.before)}</td>
            <td class="num">${fmtWhole(v.after)}</td>
            <td class="num text-positive">${fmtWhole(v.savings)}</td>
            <td class="num">${esc(v.savingsPct)}</td>
            <td>${statusBadge(v.status)}</td>
        </tr>`;
    });
    html += `<tr class="grand-total-row">
        <td>Total</td>
        <td class="num">${fmtWhole(totalBefore)}</td>
        <td class="num">${fmtWhole(totalAfter)}</td>
        <td class="num text-positive">${fmtWhole(totalSavings)}</td>
        <td class="num">${fmtPct(totalSavings / totalBefore)}</td>
        <td></td>
    </tr>`;
    html += '</tbody></table></div>';

    // Chart
    html += `<div class="chart-card">
        <div class="chart-title">Vendor Cost Comparison</div>
        <div class="chart-wrapper tall" id="savingsChartWrap"><canvas id="savingsChart"></canvas></div>
    </div>`;

    html += '</div>';

    // Company Impact
    html += '<div class="section-card">';
    html += '<div class="section-title">Company Impact</div>';
    html += `<p style="font-size:13px;margin-bottom:12px;color:var(--text-color)">Marketing vendor renegotiations account for ${fmtWhole(totalSavings)} of the company's annual software expenses, representing a ${fmtPct(savingsPct)} reduction in the marketing-attributed portion.</p>`;
    html += '<div class="impact-bar-container">';
    html += '<div class="impact-bar-track">';
    html += `<div class="impact-bar-fill" style="width:${Math.max(savingsPct * 100, 5)}%">${fmtPct(savingsPct)}</div>`;
    html += '</div>';
    html += `<div class="impact-labels"><span>Marketing savings: ${fmtWhole(totalSavings)}</span><span>Company SW budget: ${fmtWhole(companySW)}</span></div>`;
    html += '</div>';
    html += '</div>';

    el.innerHTML = html;
    renderSavingsChart();
}

function renderSavingsChart() {
    destroyChart('savings');
    const vendors = appState.vendorContracts;
    const isDark = appState.theme === 'dark' || appState.theme === 'high-contrast';
    const textColor = isDark ? '#e7e9ea' : '#0A1849';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
    const fontOpts = { family: "'Inter', sans-serif", size: 11 };

    const ctx = document.getElementById('savingsChart');
    if (!ctx) return;

    appState.charts.savings = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: vendors.map(v => v.vendor),
            datasets: [
                {
                    label: 'Previous',
                    data: vendors.map(v => v.before),
                    backgroundColor: 'rgba(107, 114, 128, 0.4)',
                    borderRadius: 3
                },
                {
                    label: 'Current',
                    data: vendors.map(v => v.after),
                    backgroundColor: 'rgba(71, 57, 231, 0.8)',
                    borderRadius: 3
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: fontOpts, color: textColor } },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtWhole(ctx.raw) } }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: v => fmtWhole(v), font: fontOpts, color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { font: fontOpts, color: textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

// ============================================================
// 22. EVENT HANDLERS & INITIALIZATION
// ============================================================
function bindEvents() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Auth
    document.getElementById('signInBtn').addEventListener('click', signIn);
    document.getElementById('signOutBtn').addEventListener('click', signOut);

    // Theme
    document.getElementById('themeToggle').addEventListener('click', cycleTheme);

    // Presentation
    document.getElementById('presentationToggle').addEventListener('click', togglePresentation);

    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (appState.isSignedIn) {
            fetchAllSheets();
        } else {
            loadFallbackData();
            showToast('Refreshed with fallback data. Sign in for live data.', 'info');
        }
    });

    // Audience filter
    document.getElementById('audienceFilter').addEventListener('change', (e) => {
        appState.audienceFilter = e.target.value;
        recompute();
        renderActiveTab();
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Drill-down close
    document.getElementById('drilldownClose').addEventListener('click', closeDrillDown);
    document.getElementById('drilldownOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDrillDown();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDrillDown();
            if (appState.presentationMode) togglePresentation();
        }
        if (e.key === 'p' && e.ctrlKey) {
            e.preventDefault();
            togglePresentation();
        }
    });

    // Freshness timer
    setInterval(updateFreshness, 60000);
}

function init() {
    bindEvents();
    initAuth();

    // Load fallback data immediately (will be replaced on sign-in)
    loadFallbackData();

    // Hide loading overlay
    const loader = document.getElementById('loadingOverlay');
    setTimeout(() => loader.classList.add('hidden'), 300);

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    console.log('Class 2026 Marketing Budget Tracker initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
