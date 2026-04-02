# Design System

## Target Aesthetic

Compact, data-dense, spreadsheet-like. Think Google Sheets or Excel with charts — NOT a marketing landing page. The v1-reference.html file contains the target design. Copy its density, spacing, and font sizing.

## CSS Variables (from v1-reference.html — use these exactly)

```css
:root {
    --primary: #4739E7;
    --primary-light: #DAD7FA;
    --primary-bg: #F6F6FE;
    --background: #EDECFD;
    --card-bg: #FFFFFF;
    --text-color: #0A1849;
    --text-muted: #4A5568;
    --accent: #FFBA00;
    --border-color: #DAD7FA;
    --header-gradient: linear-gradient(135deg, #0A1849 0%, #3730a3 100%);
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04);
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 9px;
    --color-positive: #059669;
    --color-negative: #DC2626;
    --color-warning: #D97706;
    --color-neutral: #6B7280;
    --navy: #0A1849;
    --gold: #FFBA00;
    --purple: #4739E7;
    --chart-1: #4739E7;
    --chart-2: #059669;
    --chart-3: #FFBA00;
    --chart-4: #DC2626;
    --chart-5: #6366F1;
    --chart-6: #8B5CF6;
}
```

### Dark Mode Variables
```css
[data-theme="dark"] {
    --background: #0f1419;
    --card-bg: #1a1f26;
    --text-color: #e7e9ea;
    --text-muted: #8b98a5;
    --primary: #6366f1;
    --primary-light: #3730a3;
    --primary-bg: #1e1b4b;
    --border-color: #2d3748;
    --accent: #fbbf24;
    --color-positive: #22c55e;
    --color-negative: #ef4444;
    --header-gradient: linear-gradient(135deg, #0f1419 0%, #1e1b4b 100%);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.4);
}
```

## Typography

| Element | Size | Weight | Other |
|---------|------|--------|-------|
| Body | 14px | 400 | line-height 1.5 |
| Header h1 | 18px | 600 | letter-spacing -0.02em |
| Header meta | 11px | 400 | rgba white 70% |
| Tab buttons | 13px | 500 (600 active) | — |
| Section titles | 15px | 600 | — |
| KPI values | 28px | 500 | tabular-nums |
| KPI labels | 11px | 400 | uppercase, 0.05em spacing |
| KPI trends | 12px | 400 | — |
| Table headers | 10px | 600 | uppercase, 0.05em spacing |
| Table cells | 12px | 400 | tabular-nums |
| Category row | 13px | 700 | — |
| Chart titles | 12px | 600 | uppercase, 0.05em spacing |
| Filter inputs | 13px | 400 | — |
| Pill badges | 10px | 600 | — |

## Spacing

| Element | Padding/Margin |
|---------|----------------|
| Header | 12px 20px |
| Container | 16px 20px, max-width 1600px |
| Tab nav | 0 20px (horizontal), 12px 20px per tab |
| KPI cards | 16px padding, 12px grid gap |
| Chart cards | 16px padding, 16px grid gap |
| Table cells (th) | 10px 12px |
| Table cells (td) | 8px 12px |
| Filter bar | 10px gap |
| Cards gap | 12-16px |

## Component Patterns

### KPI Cards
```css
.kpi-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);  /* 6px */
    padding: 16px;
    box-shadow: var(--shadow-sm);
    position: relative;
    overflow: hidden;
}
/* 3px gradient accent at top */
.kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary), transparent);
}
/* Color variants: .positive (green), .negative (red), .warning (amber), .gold */
```

### Tables
```css
.table-container {
    background: var(--card-bg);
    border-radius: var(--radius-lg);  /* 9px */
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
}
/* 3px gradient bar at top of table container */
.table-container::before {
    content: '';
    display: block;
    height: 3px;
    background: linear-gradient(90deg, var(--primary), var(--primary-light), transparent);
}
thead th {
    background: linear-gradient(180deg, var(--primary-bg) 0%, #f7f6ff 100%);
    position: sticky;
    top: 0;
    z-index: 10;
}
/* Category rows: navy background, white text, 700 weight, 13px */
/* Pill badges for categories: .pill-programs (purple), .pill-te (amber), .pill-headcount (blue), .pill-outside (gray) */
```

### Charts
```css
.chart-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow-sm);
}
.chart-wrapper { position: relative; height: 280px; }
.chart-wrapper.compact { height: 200px; }
/* Grid: repeat(auto-fit, minmax(420px, 1fr)), 16px gap */
```

### Header Badge
```css
.header-badge {
    background: rgba(255,186,0,0.15);
    border: 1px solid rgba(255,186,0,0.3);
    color: #FFBA00;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}
```

### Filter Inputs
```css
.filter-input, .filter-select {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 13px;
    background: var(--card-bg);
    color: var(--text-color);
}
/* Focus: border-color primary, 3px box-shadow rgba(71,57,231,0.1) */
```

## Chart.js Configuration Notes

- Use Chart.js v4 from CDN: `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`
- Chart colors: use --chart-1 through --chart-6 variables
- Destroy existing chart instances before recreating (prevents canvas reuse errors)
- Chart font family should match --font-family
- Keep charts responsive with `maintainAspectRatio: false`

## Accessibility Notes

- All interactive elements should have focus styles (3px box-shadow with primary color)
- Tables should use proper th scope attributes
- Color shouldn't be the only way to convey meaning (add icons or text labels)
- Dark mode should maintain sufficient contrast ratios
