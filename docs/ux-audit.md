# UX Audit Report: Class 2026 Marketing Budget Tracker

**Auditor**: UX Research Agent
**Date**: April 6, 2026
**App version**: v4 (4-tab Budget Command Center)
**Methodology**: Heuristic evaluation against Nielsen's 10 usability heuristics, WCAG 2.1 AA compliance review, cognitive walkthrough of primary user tasks, and code-level inspection of `index.html`, `styles.css`, and `app.js`.

---

## 1. Information Architecture

### Current Structure

The app exposes three visible tabs in the HTML (Dashboard, Budget, Expenses) plus a fourth hidden tab (Software, rendered via `tab-software` but absent from the `<nav>`). The Budget tab internally switches between "Quarterly Detail" and "Monthly Summary" views using a toggle. The Software tab is only reachable through `renderSoftware()` in the tab routing map, which references `data-tab="software"`, but no button exists in the navigation bar to surface it.

### Assessment

**The 3-tab visible structure is right for the primary user (Russell), but the hidden Software tab is a gap.** Russell uses the software savings narrative as a negotiating asset with the CFO. Burying it means he cannot navigate to it through the UI without editing the DOM or calling `switchTab('software')` from the console.

**Strengths:**
- Dashboard as the landing tab is correct. It surfaces the single most important question first: "How much Programs budget is available for new spend?"
- Budget tab combining quarterly drill-down with a monthly spreadsheet view respects the two modes Russell uses: executive review (quarterly) and operational planning (monthly).
- Expenses tab as a searchable, filterable transaction log is the right place for line-item auditing and data entry.

**Gaps:**
- The Software tab is inaccessible through normal navigation. It exists in the JS routing (`software: renderSoftware`) and has a `tab-content` div (`tab-software`), but no `tab-btn` exists in the `<nav>`.
- No reconciliation view is surfaced in this version, despite the CLAUDE.md referencing one. The CFO reconciliation walkdown (bridging Brian's $85K cash-basis view to Russell's accrual view) is a documented requirement with no tab.
- No scenario planner tab is surfaced either, despite being a documented feature in the project spec.

### Recommendation

Add `<button class="tab-btn" data-tab="software">Software</button>` to the `<nav>`. Consider whether the reconciliation and scenario planner deserve their own tabs or should be integrated as modals/panels accessible from the Dashboard.

---

## 2. Data Comprehension: The 5-Second Budget Status Test

### Test: Can a user answer "Am I over or under budget?" within 5 seconds of loading?

**Result: Partial pass for Programs, fail for total budget.**

The Dashboard opens with a hero KPI card labeled "Programs Available for New Spend" showing a dollar figure with a progress bar and a breakdown line ("$90,000 budget - $X spent - $Y committed"). For Programs specifically, a VP-level user can assess budget health within 3-4 seconds. The green/amber/red progress bar and color-coded value reinforce the signal.

**Blockers to a full pass:**

1. **No single "total budget health" number.** The $446K total budget has no hero card. Russell sees Programs, T&E, and Headcount as separate cards with separate math. Answering "Am I over or under on my $446K envelope?" requires mental addition across three KPIs.

2. **"Available" is ambiguous without context on timeline.** The available figure subtracts actuals + outstanding + committed forecast, but the card does not indicate what months are covered. A user cannot tell whether "available" means "remaining for the rest of the year" or "remaining for this quarter."

3. **Outside Envelope spend is visible but unlabeled.** The headcount card mentions "salary-only basis" and the assumptions panel explains Outside Envelope, but a first-time viewer (or the CFO viewing the screen over Russell's shoulder) could mistake the total for the full spend picture.

4. **The loading state obscures time-to-answer.** The app requires Google OAuth before displaying data. The loading overlay says "Loading budget data..." while the auth prompt renders behind it. Unauthenticated users see "Sign in to view budget data" on all tabs with no fallback summary. The actual time to first meaningful data is OAuth round-trip + Sheets API call + recompute + render, which under normal conditions is 3-8 seconds after clicking "Sign In."

### Recommendation

Add a hero KPI card that shows total envelope status: "$446K Budget: $X spent YTD, $Y remaining (XX% through fiscal year)." Include a pace indicator: "On pace" / "Under pace" / "Over pace" relative to the month-of-year.

---

## 3. Interaction Patterns

### Expand/Collapse

**Assessment: Functional but inconsistent.**

Three separate collapse state objects exist: `budgetCollapsed` (Budget tab quarterly view), `calendarCollapsed` (Budget tab monthly view), and `expCollapsed` (Expenses tab). Each operates independently, which is correct since they govern different views. The interaction model (click category header row to toggle) is consistent across all three.

**Friction points:**
- The toggle icon (triangle characters `&#9654;` / `&#9660;`) is rendered inline with the category label. The click target is the entire `<tr>`, but the visual affordance (small triangle) suggests only the triangle is clickable. Users may not realize the full row is a toggle.
- Expand All / Collapse All buttons exist but are positioned at the far right of the toolbar, separated from the data they control. Users scanning left-to-right may miss them.
- Collapse state resets on every re-render because `renderActiveTab()` reconstructs the DOM. The state persists in `appState` objects, but if a render cycle is triggered by a theme change or audience filter switch, the user's collapse preferences survive. This is correct behavior.

### Quarter Selection

**Assessment: Good, with one disorientation risk.**

The Budget tab quarter selector (`Q1 | Q2 | Q3 | Q4 | YTD | Full Year`) uses pill-style buttons with clear active state (purple background, white text). Green dots on buttons with data (`has-data` class) provide a useful hint.

**Friction:** Switching from "Quarterly Detail" to "Monthly Summary" view resets the visual context. The quarter selector remains in "Quarterly Detail" mode even when the monthly spreadsheet is showing, because both views share the same toolbar. A user might click Q2 while in Monthly Summary view and unexpectedly switch to Quarterly Detail view (because `selectBudgetQuarter()` forces `budgetView = 'quarterly'`).

### View Toggles

**Assessment: Two view toggles compete on the Budget tab.**

The Budget tab toolbar contains both a view toggle ("Quarterly Detail" / "Monthly Summary") and a quarter selector. The view toggle changes the entire rendering mode, while the quarter selector only applies in Quarterly Detail mode. In Monthly Summary mode, the quarter selector buttons are still visible and clickable, but clicking them switches back to Quarterly Detail. This is not obvious.

### Inline Editing (Double-Click)

**Assessment: Discoverable only by accident.**

Cells in the Expenses tab and monthly drill-down views respond to `ondblclick` for inline editing. No visual hint (hover cursor change, edit icon, or tooltip) indicates which cells are editable versus which are read-only. The CSS class `editable-cell` adds a subtle outline on hover (`outline: 1px solid rgba(71,57,231,0.15)`), but this is easily overlooked at 13px font size.

The `cursor: cell` style is applied, which changes the mouse cursor to a crosshair, but most users associate this with spreadsheet selection, not editing. A pencil icon or "double-click to edit" tooltip on first hover would reduce the learning curve.

### Recommendation

1. Add a "pencil" icon overlay on editable cell hover.
2. Fix the quarter selector to remain hidden or inactive when Monthly Summary view is active.
3. Add a first-use tooltip: "Double-click any highlighted cell to edit."

---

## 4. Error States

### Current Coverage

| Scenario | Handled? | Behavior |
|---|---|---|
| Sheets API returns error | Yes | Toast: "Sheets error: [message]. Using fallback." Falls back to hardcoded demo data. |
| OAuth fails | Yes | Toast: "Sign in failed: [error]" |
| Write to Sheets fails | Yes | Toast: "Save failed: [message]" |
| Append to Sheets fails | Yes | Toast: "Add failed: [message]" |
| Delete from Sheets fails | Partial | Silently deletes locally, toast: "Deleted locally only" |
| No data for a quarter | No | Renders empty table body with category headers but zero rows. No empty-state message. |
| User loses connectivity mid-session | No | Next API call fails with a generic JS error. No offline detection, no retry, no graceful degradation. |
| Auth token expires | Yes | `sheetsApiCall()` wraps API calls and retries on 401 with a fresh token request. |
| Spreadsheet tabs missing | Yes | Discovers existing tabs via metadata before requesting ranges. Missing tabs are skipped. |

### Gaps

1. **No empty state for quarters with no data.** Selecting Q3 or Q4 (future quarters with only planned events, no actuals) renders a valid table with planned items, but selecting a quarter with neither actuals nor planned items would render an empty tbody with only the grand total row showing $0.00. No message explains why the view is empty.

2. **No offline detection.** The app does not listen for `navigator.onLine` or `window.addEventListener('offline', ...)`. A user who loses Wi-Fi while reviewing data will see stale numbers with no indication they are offline. The next refresh click will produce a cryptic fetch error.

3. **No loading state for write operations.** Saving a cell edit triggers `writeToSheets()` which is async, but the cell immediately re-renders with the new value before the API confirms success. If the write fails, the local state diverges from Sheets with no visual indication. The error toast appears, but the user has already moved on.

4. **No confirmation for destructive actions beyond `confirm()`.** Transaction deletion uses `window.confirm()`, which is a browser-native dialog. It works but breaks the design language. A custom modal confirmation aligned with the existing modal system would be more consistent.

### Recommendation

Add an `empty-state` div for empty quarters ("No transactions recorded for Q3 2026 yet"). Add a connectivity listener that updates the freshness dot to "Offline" (red) and disables write operations. Add a brief spinner or "Saving..." state to editable cells during write operations.

---

## 5. Cognitive Load

### Assessment: High density, appropriate for the primary persona, with specific overload zones.

The primary user (Russell, VP Marketing) reviews this daily and has deep context on every line item. The data density of 13px font, compact 8px padding, and tabular-nums formatting is appropriate for a power user managing 50+ vendors and 100+ monthly transactions.

**Overload zones:**

1. **Dashboard: 5 KPI cards + 5 charts + assumptions panel on one scroll.** The Dashboard renders a KPI grid (4-5 cards), three rows of chart pairs (6 charts total in some configurations), and an assumptions panel. On a 1920x1080 display, the content extends 3-4 scroll heights. The charts below the fold are invisible on load, which means the monthly trend and budget utilization charts, which are contextually important, require scrolling to reach.

2. **Monthly Summary spreadsheet: 16+ columns visible simultaneously.** The monthly spreadsheet renders 12 month columns + Annual + Budget + Variance + % columns. With vendor names in the sticky left column, the data grid is 18 columns wide. On a standard laptop (1440px width), this requires horizontal scrolling for October through December and the summary columns. The user must scroll right to see the full-year picture, losing sight of vendor names even with the sticky column.

3. **Summary bar competes with KPI cards.** The Budget tab renders a `budget-summary-bar` (Programs Budget | Spent + Outstanding | Committed | Available | T&E Budget/Spent) immediately above the detail table. On the Dashboard, similar numbers appear in KPI cards. A user switching between tabs encounters the same data in different visual formats, which creates a "which one is right?" question.

4. **Numbers without labels.** Several table cells render dollar amounts with no column header visible after scrolling. The sticky header (`position: sticky; top: 0`) mitigates this for vertical scrolling, but horizontal scrolling on the monthly spreadsheet moves the month headers out of alignment with vendor rows if the user scrolls both axes simultaneously.

### Recommendation

1. Reduce Dashboard charts from 5 to 3 by combining the quarterly stacked bar with the budget utilization chart (they answer the same question: "how much have I spent by category?"). Move the monthly actual vs. forecast chart to the Budget tab where it contextually belongs.
2. Consider freezing the Annual/Budget/Variance/% columns on the right side of the monthly spreadsheet (a second sticky zone), so the user always sees both the vendor name and the summary while scrolling through months.
3. Remove the summary bar from the Budget tab and rely on the Dashboard KPIs for summary numbers. The Budget tab should focus on detail.

---

## 6. Desktop Workflow Efficiency and Print Experience

### Desktop Workflow: Time-on-Task for Common Budget Questions

This is a desktop-only application. The following analysis estimates time-on-task for the five questions Russell asks most frequently, based on cognitive walkthrough of the current UI.

**Task 1: "How much Programs budget do I have left?"**
- Path: Load app, authenticate, Dashboard tab auto-loads.
- Time: 5-8 seconds (OAuth + API round-trip + scan hero KPI card).
- Assessment: Good. The hero card "Programs Available for New Spend" answers this directly with a single number and progress bar.

**Task 2: "Am I over or under on my total $446K budget?"**
- Path: Dashboard tab. Scan Programs KPI, T&E KPI, Headcount KPI. Mentally add three numbers.
- Time: 15-25 seconds. The mental arithmetic is the bottleneck.
- Assessment: Poor. No single total-budget KPI exists. Russell must do addition across three cards.

**Task 3: "What did we spend on Docebo Inspire?"**
- Path: Switch to Expenses tab. Type "Docebo" in search filter. Scan results.
- Time: 6-10 seconds (tab switch + type + scan).
- Assessment: Good. The search filter is responsive and filters across vendor, memo, GL name, and department fields.

**Task 4: "What is our Q2 committed spend?"**
- Path: Switch to Budget tab. Click "Q2" in quarter selector. Scan the summary bar and category rows.
- Time: 5-8 seconds.
- Assessment: Good. The quarter selector is prominent and the summary bar surfaces committed totals. Planned items are visually distinct (italic, dashed border, status chips).

**Task 5: "How much have we saved on software renegotiations?"**
- Path: No path available. The Software tab has no navigation button.
- Time: Infinite (unreachable through UI).
- Assessment: Broken. Russell must use browser dev tools or the console to reach `switchTab('software')`.

**Task 6: "Show me the monthly breakdown for Programs vendors."**
- Path: Budget tab. Click "Monthly Summary" view toggle. Expand Programs category if collapsed.
- Time: 4-6 seconds.
- Assessment: Good. The monthly spreadsheet is well-organized with sticky vendor names and clear actual/forecast distinction.

**Overall desktop efficiency**: The app is fast for its primary use case (Programs budget check) but slow for holistic budget health assessment. The missing Software tab is the single biggest workflow gap.

### Print Experience: CFO-Ready Report Assessment

The stylesheet includes a `@media print` block (lines 596-612) that hides interactive chrome: header, tab navigation, filter bar, buttons, modals, drill-down panel, loading overlay, context menu, budget toolbar, view toggle, quarter selector, and source label. The intent is to produce a clean data-only printout.

**Current print behavior:**

1. **All tab content displays on print.** The print stylesheet overrides `.tab-content { display: block !important; }`, which means printing from any tab renders all four tab panels sequentially (Dashboard, Budget, Expenses, Software). This produces a 10+ page printout with redundant data. A user printing from the Budget tab expects only the Budget view, not all four tabs.

2. **Charts render as canvas elements.** Chart.js `<canvas>` elements will print as rendered bitmaps. On high-DPI printers, these appear blurry. No `print-color-adjust: exact` or `-webkit-print-color-adjust: exact` is set, so browsers may strip background colors from KPI cards and category row highlights.

3. **Budget summary bar prints without context.** The `.budget-summary-bar` is not hidden in print, and its 1px-gap flex layout prints as expected. The `.budget-summary-item.highlight` background (`rgba(5, 150, 105, 0.04)`) is too subtle to print visibly.

4. **Category row backgrounds print inconsistently.** The print stylesheet forces `.budget-detail-table .category-row { background: #f0f0f0 !important; }` and `.grand-total-row td { background: #eee !important; }`. This is correct for ensuring visual hierarchy on paper, but the `!important` overrides compete with the inline dark-theme styles.

5. **Page breaks are partially handled.** `break-inside: avoid` is set on `.kpi-card`, `.chart-card`, `.table-container`, and `.section-card`. Tables themselves have no `break-inside: avoid` on `<tbody>` or individual category groups, so a category's transactions may split across pages.

6. **No page header/footer.** No `@page` rules define margins, headers, or footers. The printout lacks a title, date, or "Page X of Y" indicator. A CFO receiving a printed Budget tab has no context for when the data was generated.

**Verdict: Not CFO-ready in current state.**

The print stylesheet strips chrome but does not produce a focused, single-view report. Printing all four tabs at once with no page header is unusable for executive distribution.

**Recommendations for a print-ready CFO report:**

1. Change the print rule to display only the active tab: `.tab-content { display: none !important; } .tab-content.active { display: block !important; }`.
2. Add `@page { margin: 1in; @top-center { content: "Class 2026 Marketing Budget"; } }` for basic page headers.
3. Add `-webkit-print-color-adjust: exact; print-color-adjust: exact;` to the body rule so category highlights and progress bars render on paper.
4. Add `break-inside: avoid` to `.category-row` groups (the category header through its category total row).
5. Consider a "Print Report" button that enters presentation mode and triggers `window.print()`, ensuring the view is optimized before the browser print dialog opens.

---

## 7. Accessibility

### ARIA Labels

**Score: 0/10.** Zero ARIA attributes exist in the HTML or in the JavaScript-generated markup. No `role`, `aria-label`, `aria-expanded`, `aria-controls`, `aria-live`, or `aria-hidden` attributes are present anywhere in the codebase.

**Specific gaps:**
- Tab navigation buttons lack `role="tab"`, `aria-selected`, and `aria-controls` attributes. The tab panels lack `role="tabpanel"`.
- Expand/collapse toggles on category rows lack `aria-expanded`.
- The modal and drill-down panel lack `role="dialog"` and `aria-modal="true"`.
- Toast notifications lack `role="alert"` or `aria-live="polite"`, so screen readers will not announce them.
- The loading overlay lacks `role="status"` and `aria-live="assertive"`.
- Sort indicators on table headers lack `aria-sort`.
- The audience filter dropdown lacks a visible `<label>` element (it only has a `title` attribute, which screen readers may or may not announce).

### Keyboard Navigation

**Score: 3/10.** Partial keyboard support exists but is incomplete.

**Working:**
- Tab and Shift+Tab move focus between interactive elements (buttons, inputs, selects) because the app uses native HTML elements.
- Escape closes modals, drill-down panels, and cancels inline edits.
- Enter commits inline cell edits. Tab commits and moves focus.
- Ctrl+P toggles presentation mode.
- `focus-visible` outlines are styled for `.icon-btn`, `.btn`, and `.tab-btn`.

**Broken:**
- Category row expand/collapse is triggered via `onclick` on `<tr>` elements with no `tabindex` or `role="button"`. These rows are not focusable via keyboard.
- The quarter selector buttons are regular `<button>` elements (good) but are generated via `innerHTML`, so they receive no focus management after rendering.
- The context menu (right-click delete) is only accessible via `oncontextmenu`. No keyboard equivalent (e.g., Delete key or a menu button) exists.
- Inline editing requires double-click (`ondblclick`). No keyboard-triggered equivalent exists.
- After a tab switch, focus is not moved to the new tab panel content. A keyboard user must Tab through all controls to reach the newly rendered content.

### Color Contrast

**Score: 6/10.** The light theme generally passes WCAG AA for body text (`#0A1849` on `#F4F5F7` = 13.5:1 ratio), but several elements fail:

- Muted text (`#4A5568` on `#F4F5F7`) = approximately 5.7:1. Passes AA for body text but fails for the 10px labels used in KPI cards and filter bars (AA requires 4.5:1 for text below 18px, so this passes, but the effective legibility at 10px is poor).
- Gold accent text (`#92600a` on `rgba(255,186,0,0.15)` background) on T&E pills has borderline contrast.
- Forecast cell italic text uses `color: var(--text-muted)` on a hatched background pattern, which further reduces effective contrast.
- The high-contrast theme (`data-theme="high-contrast"`) improves contrast significantly and is a good accessibility option, but users must discover the theme toggle (a sun icon with no label) to activate it.

### Screen Reader Compatibility

**Score: 1/10.** The app generates all content via `innerHTML` string concatenation in JavaScript. Screen readers will read the raw content, but:

- No live regions exist, so dynamic content updates (tab switches, data refreshes, filter changes) are invisible to screen readers.
- Tables generated via `innerHTML` lack `<caption>` elements and `scope` attributes on `<th>` elements.
- Status pills and badges use color and text, which is correct for screen readers, but the pill text ("Actual", "Outstanding") has no contextual label ("Transaction status: Actual").
- Charts are `<canvas>` elements with no text alternative. Screen readers will skip them entirely.

### Recommendation

Addressing ARIA and keyboard gaps would require a focused accessibility sprint. The highest-impact items: add `role="tab"`, `role="tabpanel"`, `aria-selected`, and `aria-controls` to the tab system; add `role="alert"` to the toast container; add `aria-expanded` to collapsible category rows with `tabindex="0"` and Enter/Space key handlers; add `<caption>` and `scope="col"` to all tables.

---

## 8. Top 5 Quick Wins

Ranked by impact-to-effort ratio. Each can be implemented in under 2 hours.

### 1. Add the Software tab button to navigation

**Impact**: High. The Software tab contains the $213K savings narrative that Russell uses in CFO conversations. It is fully implemented but unreachable through the UI.
**Effort**: 1 line of HTML. Add `<button class="tab-btn" data-tab="software">Software</button>` with a divider before it in the `<nav>`.
**User benefit**: Russell can access vendor portfolio and savings data without developer intervention.

### 2. Add an "Am I on pace?" total budget KPI to the Dashboard

**Impact**: High. The single most common question ("Am I over or under on my $446K budget?") requires mental math across 3 KPI cards.
**Effort**: 15-20 lines of JS in `renderDashboard()`. Calculate `totalSpent / totalBudget`, compare to `currentMonth / 12`, render as a hero KPI card with a pace indicator.
**User benefit**: 2-second answer to the primary budget question instead of 15-second mental arithmetic.

### 3. Add empty state messages for quarters with no data

**Impact**: Medium. Prevents confusion when a user selects Q3 or Q4 and sees an empty table with only header rows and a $0.00 grand total.
**Effort**: 10 lines of JS. Check `filtered.length === 0 && planned.length === 0` in `renderQuarterlyDetail()` and render an `empty-state` div with "No transactions recorded for Q3 2026 yet. Planned events will appear here as they are confirmed."
**User benefit**: Eliminates the "is this broken or just empty?" question.

### 4. Add `role="alert"` to toast container and `role="dialog"` to modal/drill-down

**Impact**: Medium. Toast notifications are the primary feedback channel for save/error/info messages. Screen reader users receive no notification of these events.
**Effort**: 3 attribute additions in `index.html`: `role="alert" aria-live="polite"` on `#toastContainer`, `role="dialog" aria-modal="true"` on `#modal`, `role="dialog" aria-modal="true"` on `#drilldownPanel`.
**User benefit**: Screen reader users hear save confirmations and error messages.

### 5. Add a mobile header breakpoint

**Impact**: Medium. The header currently overflows on any screen below 768px, making the app unusable on phones and small tablets.
**Effort**: 20-30 lines of CSS. Add `@media (max-width: 768px)` rules to stack the header into two rows, hide low-priority controls (presentation toggle, theme toggle), and reduce title font size.
**User benefit**: Basic usability on tablets. The app will not be a full mobile experience, but the header will stop overflowing.

---

## Appendix: Heuristic Scorecard

| Heuristic | Score (1-10) | Notes |
|---|---|---|
| Visibility of system status | 6 | Freshness dot and sync indicator work well. No offline detection. No loading state for writes. |
| Match between system and real world | 8 | Financial terminology (GL codes, accrual vs. cash basis, outstanding) matches Russell's vocabulary. |
| User control and freedom | 5 | Escape to close works. Undo is absent. Delete uses native `confirm()`. No undo for cell edits. |
| Consistency and standards | 6 | Three collapse state systems with identical behavior. Two view toggles on Budget tab create confusion. |
| Error prevention | 4 | No validation on amount fields beyond `isNaN`. No confirmation before overwriting cell values. |
| Recognition over recall | 5 | Editable cells require knowing to double-click. No visual hint for editability. Quarter selector state is visible. |
| Flexibility and efficiency | 7 | Keyboard shortcuts (Escape, Ctrl+P). CSV export. Audience filtering. Presentation mode. |
| Aesthetic and minimalist design | 7 | Clean data density. Appropriate use of white space. Chart proliferation on Dashboard adds visual noise. |
| Help users recognize and recover from errors | 5 | Toast messages for API errors. No retry option. No "what went wrong" guidance. |
| Help and documentation | 2 | No help text, onboarding, or tooltips. Assumptions panel provides domain context but no UI guidance. |

**Overall UX maturity score: 5.5/10** -- A functional power-user tool with solid data architecture that needs accessibility, error handling, and discoverability improvements before broader audience use.

---

**Next steps**: Prioritize Quick Wins 1-3 (Software tab, total budget KPI, empty states) for immediate deployment. Schedule an accessibility sprint for ARIA attributes and keyboard navigation. Defer mobile optimization until the audience expands beyond Russell and the executive team viewing on desktop.
