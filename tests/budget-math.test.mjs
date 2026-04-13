/**
 * Budget math and utility function tests.
 * Uses Node.js built-in test runner (node:test) — no npm dependencies required.
 *
 * Run: node --test tests/budget-math.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Replicate pure functions from app.js (no DOM, no Google API)
// ---------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUDGET = { headcount: 336914, programs: 90000, te: 20000, total: 446914 };

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

function monthIdx(m) { return MONTHS.indexOf(m); }

function quarterOf(m) {
    const i = monthIdx(m);
    if (i < 3) return 'Q1'; if (i < 6) return 'Q2'; if (i < 9) return 'Q3'; return 'Q4';
}

/**
 * Simplified recompute — mirrors the core budget math from app.js recompute().
 * Takes explicit inputs instead of reading global appState.
 */
function computeBudget({ transactions, vendorMonthly, disabledVendors, curMonthIdx }) {
    const tx2026 = transactions.filter(t => t.year === 2026);
    const actuals = tx2026.filter(t => t.status === 'Actual');

    const ytdActual = { total: 0, headcount: 0, programs: 0, te: 0 };
    actuals.forEach(t => {
        if (t.category === 'Headcount') ytdActual.headcount += t.amount;
        else if (t.category === 'Programs') ytdActual.programs += t.amount;
        else if (t.category === 'T&E') ytdActual.te += t.amount;
    });
    ytdActual.total = ytdActual.headcount + ytdActual.programs + ytdActual.te;

    const outstanding = tx2026.filter(t => t.status === 'Outstanding');
    let outstandingPrograms = 0, outstandingTE = 0, outstandingHC = 0;
    outstanding.forEach(t => {
        if (t.category === 'Programs') outstandingPrograms += t.amount;
        else if (t.category === 'T&E') outstandingTE += t.amount;
        else if (t.category === 'Headcount') outstandingHC += t.amount;
    });

    const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const forecast = { total: 0, headcount: 0, programs: 0, te: 0 };
    (vendorMonthly || []).forEach(vm => {
        if (disabledVendors[vm.vendor]) return;
        let vendorForecast = 0;
        MONTH_KEYS.forEach((mk, mi) => {
            if (mi >= curMonthIdx && (vm[mk] || 0) > 0) vendorForecast += vm[mk];
        });
        if (vm.category === 'Headcount') forecast.headcount += vendorForecast;
        else if (vm.category === 'Programs') forecast.programs += vendorForecast;
        else if (vm.category === 'T&E') forecast.te += vendorForecast;
    });
    forecast.total = forecast.headcount + forecast.programs + forecast.te;

    let disabledBudgetDelta = 0;
    Object.keys(disabledVendors).forEach(vendor => {
        if (!disabledVendors[vendor]) return;
        const vm = (vendorMonthly || []).find(v => v.vendor === vendor);
        if (vm) {
            MONTH_KEYS.forEach((mk, mi) => {
                if (mi > curMonthIdx) disabledBudgetDelta += (vm[mk] || 0);
            });
        }
    });

    const available = {
        headcount: BUDGET.headcount - ytdActual.headcount - outstandingHC - forecast.headcount,
        programs: BUDGET.programs - ytdActual.programs - outstandingPrograms - forecast.programs + disabledBudgetDelta,
        te: BUDGET.te - ytdActual.te - outstandingTE - forecast.te,
    };
    available.total = available.headcount + available.programs + available.te;

    return { ytdActual, forecast, outstanding: { programs: outstandingPrograms, te: outstandingTE, headcount: outstandingHC }, available, disabledBudgetDelta };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseNum', () => {
    it('passes through numbers', () => {
        assert.equal(parseNum(42), 42);
        assert.equal(parseNum(0), 0);
        assert.equal(parseNum(-5.5), -5.5);
    });

    it('strips $ and commas from strings', () => {
        assert.equal(parseNum('$1,234.56'), 1234.56);
        assert.equal(parseNum('$90,000'), 90000);
        assert.equal(parseNum('7700'), 7700);
    });

    it('returns 0 for falsy/invalid input', () => {
        assert.equal(parseNum(null), 0);
        assert.equal(parseNum(undefined), 0);
        assert.equal(parseNum(''), 0);
        assert.equal(parseNum('abc'), 0);
    });
});

describe('fmt', () => {
    it('formats positive values', () => {
        assert.equal(fmt(1234.5), '$1,234.50');
        assert.equal(fmt(0), '$0.00');
        assert.equal(fmt(90000), '$90,000.00');
    });

    it('formats negative values with leading minus', () => {
        assert.equal(fmt(-500), '-$500.00');
    });

    it('handles null/NaN', () => {
        assert.equal(fmt(null), '$0.00');
        assert.equal(fmt(NaN), '$0.00');
        assert.equal(fmt(undefined), '$0.00');
    });
});

describe('fmtWhole', () => {
    it('formats without cents', () => {
        assert.equal(fmtWhole(90000), '$90,000');
        assert.equal(fmtWhole(-1500), '-$1,500');
    });

    it('handles null/NaN', () => {
        assert.equal(fmtWhole(null), '$0');
        assert.equal(fmtWhole(NaN), '$0');
    });
});

describe('fmtPct', () => {
    it('formats decimal as percentage', () => {
        assert.equal(fmtPct(0.245), '24.5%');
        assert.equal(fmtPct(1), '100.0%');
        assert.equal(fmtPct(0), '0.0%');
    });

    it('handles null/NaN', () => {
        assert.equal(fmtPct(null), '0.0%');
    });
});

describe('monthIdx', () => {
    it('maps month names to 0-indexed values', () => {
        assert.equal(monthIdx('Jan'), 0);
        assert.equal(monthIdx('Dec'), 11);
        assert.equal(monthIdx('Jul'), 6);
    });

    it('returns -1 for unknown months', () => {
        assert.equal(monthIdx('Foo'), -1);
    });
});

describe('quarterOf', () => {
    it('maps Q1 months', () => {
        assert.equal(quarterOf('Jan'), 'Q1');
        assert.equal(quarterOf('Feb'), 'Q1');
        assert.equal(quarterOf('Mar'), 'Q1');
    });

    it('maps Q2 months', () => {
        assert.equal(quarterOf('Apr'), 'Q2');
        assert.equal(quarterOf('May'), 'Q2');
        assert.equal(quarterOf('Jun'), 'Q2');
    });

    it('maps Q3 months', () => {
        assert.equal(quarterOf('Jul'), 'Q3');
        assert.equal(quarterOf('Aug'), 'Q3');
        assert.equal(quarterOf('Sep'), 'Q3');
    });

    it('maps Q4 months', () => {
        assert.equal(quarterOf('Oct'), 'Q4');
        assert.equal(quarterOf('Nov'), 'Q4');
        assert.equal(quarterOf('Dec'), 'Q4');
    });
});

describe('computeBudget (recompute core math)', () => {
    const baseVendorMonthly = [
        { vendor: 'LinkedIn Ads', category: 'Programs', jan: 950, feb: 950, mar: 950, apr: 950, may: 950, jun: 950, jul: 950, aug: 950, sep: 950, oct: 950, nov: 950, dec: 950 },
        { vendor: 'Google Ads', category: 'Programs', jan: 850, feb: 850, mar: 850, apr: 850, may: 850, jun: 850, jul: 850, aug: 850, sep: 850, oct: 850, nov: 850, dec: 850 },
    ];

    it('computes Programs Available with no actuals and full-year forecast', () => {
        // curMonthIdx=0 (Jan) means all 12 months are forecast
        const result = computeBudget({
            transactions: [],
            vendorMonthly: baseVendorMonthly,
            disabledVendors: {},
            curMonthIdx: 0,
        });
        // Forecast: (950*12) + (850*12) = 11400 + 10200 = 21600
        assert.equal(result.forecast.programs, 21600);
        // Available: 90000 - 0 - 0 - 21600 = 68400
        assert.equal(result.available.programs, 68400);
    });

    it('subtracts YTD actuals from budget', () => {
        const transactions = [
            { year: 2026, category: 'Programs', amount: 5000, status: 'Actual', month: 'Jan' },
            { year: 2026, category: 'Programs', amount: 3000, status: 'Actual', month: 'Feb' },
        ];
        const result = computeBudget({
            transactions,
            vendorMonthly: [],
            disabledVendors: {},
            curMonthIdx: 3, // Apr — no forecast with empty vendorMonthly
        });
        assert.equal(result.ytdActual.programs, 8000);
        assert.equal(result.available.programs, 82000); // 90000 - 8000
    });

    it('subtracts outstanding from budget', () => {
        const transactions = [
            { year: 2026, category: 'Programs', amount: 7700, status: 'Outstanding', month: 'Mar' },
        ];
        const result = computeBudget({
            transactions,
            vendorMonthly: [],
            disabledVendors: {},
            curMonthIdx: 3,
        });
        assert.equal(result.outstanding.programs, 7700);
        assert.equal(result.available.programs, 82300); // 90000 - 0 - 7700 - 0
    });

    it('includes current month in forecast', () => {
        // curMonthIdx=3 (Apr) means Apr through Dec (9 months) are forecast
        const result = computeBudget({
            transactions: [],
            vendorMonthly: baseVendorMonthly,
            disabledVendors: {},
            curMonthIdx: 3, // April
        });
        // LinkedIn: 950 * 9 = 8550, Google: 850 * 9 = 7650 => total 16200
        assert.equal(result.forecast.programs, 16200);
    });

    it('excludes disabled vendors from forecast', () => {
        const result = computeBudget({
            transactions: [],
            vendorMonthly: baseVendorMonthly,
            disabledVendors: { 'LinkedIn Ads': true },
            curMonthIdx: 0,
        });
        // Only Google Ads: 850 * 12 = 10200
        assert.equal(result.forecast.programs, 10200);
    });

    it('adds disabled vendor budget back to available', () => {
        // curMonthIdx=0 (Jan), disabled vendor's future months (Feb-Dec = 11 months) freed up
        const result = computeBudget({
            transactions: [],
            vendorMonthly: baseVendorMonthly,
            disabledVendors: { 'LinkedIn Ads': true },
            curMonthIdx: 0,
        });
        // disabledBudgetDelta: LinkedIn months > 0 (Feb-Dec = 11 months) = 950 * 11 = 10450
        assert.equal(result.disabledBudgetDelta, 10450);
        // Available: 90000 - 0 - 0 - 10200 + 10450 = 90250
        assert.equal(result.available.programs, 90250);
    });

    it('filters only 2026 transactions', () => {
        const transactions = [
            { year: 2025, category: 'Programs', amount: 999, status: 'Actual', month: 'Dec' },
            { year: 2026, category: 'Programs', amount: 100, status: 'Actual', month: 'Jan' },
        ];
        const result = computeBudget({
            transactions,
            vendorMonthly: [],
            disabledVendors: {},
            curMonthIdx: 3,
        });
        assert.equal(result.ytdActual.programs, 100); // 2025 excluded
    });

    it('handles all three budget categories independently', () => {
        const transactions = [
            { year: 2026, category: 'Headcount', amount: 28000, status: 'Actual', month: 'Jan' },
            { year: 2026, category: 'Programs', amount: 5000, status: 'Actual', month: 'Jan' },
            { year: 2026, category: 'T&E', amount: 1500, status: 'Actual', month: 'Jan' },
        ];
        const result = computeBudget({
            transactions,
            vendorMonthly: [],
            disabledVendors: {},
            curMonthIdx: 6,
        });
        assert.equal(result.ytdActual.headcount, 28000);
        assert.equal(result.ytdActual.programs, 5000);
        assert.equal(result.ytdActual.te, 1500);
        assert.equal(result.ytdActual.total, 34500);
        assert.equal(result.available.headcount, 308914); // 336914 - 28000
        assert.equal(result.available.programs, 85000);   // 90000 - 5000
        assert.equal(result.available.te, 18500);          // 20000 - 1500
    });
});
