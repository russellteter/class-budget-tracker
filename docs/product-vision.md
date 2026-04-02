# Product Vision — Russell's Detailed Description

This document captures Russell Teter's vision for the Class 2026 Marketing Budget Tracker in his own words and framing. This is the north star for what to build. Read this carefully before making any design or architectural decisions.

---

## The Core Problem

Russell described the starting point this way: "I need to pull this confusing universe together into a source of truth that works on a number of levels and for multiple purposes." The marketing budget at Class Technologies touches multiple spreadsheets, multiple stakeholders, multiple accounting bases (cash vs accrual), and multiple time periods. There is no single place where Russell can answer the question: **"Can I spend $X on a marketing program, and do I have a leg to stand on when I go to the CFO?"**

He described the specific scenario that drove this project: "If I were to go to Brian and say, 'Hypothetically, I'd like to budget $8,000 more for a marketing sponsored webinar in Q2,' do I have a leg to stand on in terms of the overall picture of expenses and budget? Or am I so wildly over budget already that that's going to get laughed at?"

The existing tools (spreadsheets, NetSuite reports, the CFO's board deck) don't answer this question in a straightforward way. The data is scattered, moment-in-time snapshots conflict with each other, and there's no mechanism for scenario modeling.

## What This Tool Must Do

Russell was explicit that this needs to go beyond a spreadsheet: "I'm beginning to wonder if there is a better method of creating a tool, coding a tool, perhaps that could be dynamic in the way that you can update it and save it, and that is maybe hosted on GitHub or through something like that. That is much more of a tool than a spreadsheet of data and is mirroring some of the exact capabilities and information that you've built already, but has more of a software feel to it, kind of like a NetSuite or a bill tracker or some kind of method of budgeting and financing properly and forecasting properly that is a bit more sophisticated than a Google Sheet."

He also emphasized the multi-audience requirement: "I'd also like a version that is straightforward and simple enough, or a view that is straightforward and simple enough, that I can actually share with my marketing team themselves once we get to that point. Right now, it doesn't seem like this is all that user-friendly and clear."

## The Calendar/Timeline View — Russell's Detailed Vision

This is the centerpiece feature Russell described in the most detail. Read this section very carefully:

> "There's also a potential valuable view to help everybody understand how the money is being spent and allocated and budgeted and forecasted. It could be a **calendar view where it's the year along the top row and then the months underneath**, broken into a view into **Q4 2025 on the left side that you can scroll over into if you need to**. Most of the screen is the **12 months of 2026**, and there's an obvious distinction between the four quarters of the year."

The layout is specifically:
- **Columns = months** along the top (Oct 2025 → Dec 2026)
- **Q4 2025 (Oct, Nov, Dec) on the far left**, scrollable — it's there for carryover context but not the primary focus
- **Q1–Q4 2026 (Jan through Dec)** as the main visible area
- **Clear visual distinction between quarters** — borders, shading, or spacing that makes Q1/Q2/Q3/Q4 immediately obvious

Within each month/quarter, Russell described the content:

> "Within each month, or within each quarter, there's a clear allocation of expenses, **categorized into their particular categories with their individual line items**. We can see things such as a **real-time tracker on when expenses were charged for the actuals**, what month they were in, what quarter they were in, and what category they ran under."

The rows should be groupable — Russell confirmed via Q&A that he wants **toggleable row grouping**: the user can switch between viewing rows grouped by Category (Headcount/Programs/T&E/Outside Envelope), by Vendor (Sponge, LinkedIn, Paperclip, etc.), or by GL Account (6101, 6402, 6405, etc.). This is a dropdown or toggle control that restructures the row hierarchy.

The key visual distinction Russell insisted on:

> "It has a kind of an **actuals view and then a roll forward that's the forecasted view**."

This means:
- **Actuals** (confirmed, already-spent money) should be visually distinct — solid fills, firm numbers
- **Forecast** (projected future spend based on commitments) should look different — lighter fill, hatched pattern, or some other clear visual signal that these are projections, not confirmed
- **Outstanding invoices** (committed but not yet paid, like the Sponge $7,700) should have their own visual treatment — perhaps a gold/amber border or indicator

Russell explicitly connected this to the CFO's board deck format:

> "The reason I'm saying this is because in one of the files I gave you originally that our CFO is using for our board of directors, he lays out the cash flow accounting in this kind of method, where he has columns and cells for actuals and a column itself for forecasted for the rest of the year. I'm envisioning a **far more sophisticated, granular, detailed, interactive, and visually clear method of going much further than that concept**, but still attaching to that foundational way of thinking and looking at the information at a very basic level so that he can understand it clearly when he looks at it."

The calendar view should also show how everything rolls up:

> "We can see how it all accounts in properly, how the numbers roll through each month and quarter, how it all ends up into the master totals, and how it all sort of **seamlessly rolls together**."

This means:
- **Row totals** on the right (total per category/vendor/GL across all months)
- **Column totals** at the bottom (total per month across all categories)
- **Quarter subtotals** visible
- **Grand total** that ties back to the dashboard KPIs
- Clicking a cell should expand to show the individual transactions that make up that number

## The Q4 2025 Carryover View — Why It Matters

Russell was emphatic about including Q4 2025 data, and explained exactly why:

> "I want to be able to see that in an October, November, and December calendar view that shows, for example, the Docebo conference, the Sponge carryovers, and things like that. Because at the end of the day, **the marketing program's budget should not be slashed down just because our finance team were slow to pay the bills that were actually from Q4**."

This is a critical business argument Russell needs to make to Brian. The Q4 2025 columns exist specifically so Russell can point to a transaction (e.g., Sponge October invoice) and say: "This was booked in October 2025. The fact that finance paid it in January 2026 doesn't mean it should count against my 2026 programs budget." The calendar view makes this argument visual and irrefutable.

## The Dashboard — Headline View

Russell described the dashboard as:

> "A kind of a **headline view of macro-level summary data** in a kind of a top area dashboard. There's the important details, however you want to lay it out."

Key elements:
- KPI cards showing budget vs actual vs forecast at a glance
- Programs waterfall showing how the $90K programs budget flows: starting budget → Q1 spend → outstanding invoices → committed forecast → available balance
- Spend by category breakdown (visual)
- Monthly trend line showing actual spend trajectory
- Outstanding invoices highlighted prominently

## The Scenario Planner

Russell's core use case: "I need to understand if I'm tracking or over, or how I'm forecasted, or what the current forecast is going to be if I do X, Y, and Z."

The scenario planner should let Russell type in a dollar amount and a category, and immediately see:
- Whether it fits within remaining budget
- What the new forecast looks like month-by-month
- A green/yellow/red verdict
- **Auto-generated talking points for CFO Brian** — specific language Russell can use in a conversation, backed by the data

## The Transaction Detail View

Russell was clear about wanting individual line item visibility:

> "It also should be broken out in a view that lists out the **specific line items that have gone into each category** so far and their totals, such as all of the program's expenses in Q1. List those out and have those roll into an overall total number. Have the categories of marketing expenses broken out in their **actual specific details listed out** so that it has a clear record of accounting on each and every individual expense."

> "There's no mystery as to, for example, when I say marketing spent 22.5k on programs in Q1. We can easily click over to the sheet that shows exactly how that 22.5k was made up of all the other line items."

This means:
- Every single transaction visible, sortable, filterable
- Category grouping with subtotals
- Ability to drill from any summary number to its constituent transactions
- Inline editing so Russell can correct entries without leaving the app
- Modal form for adding new transactions
- CSV export for sharing

## The CFO Reconciliation View

This exists to answer one specific question: **Why does Brian's number ($85,309) differ from Russell's number?**

The reconciliation must show:
- Brian's cash-basis Q1 total: $85,309
- Minus Pantheon reclassification: -$17,426 (this should be in software, not marketing programs)
- Minus Q4 2025 carryovers paid in Q1
- Equals Russell's actual Q1 marketing programs spend

Russell specifically flagged the Pantheon issue: "Brian has incorrectly attributed Pantheon to a marketing program. Pantheon is a technology service for our website and a vendor that we pay and absolutely needs to go into the vendor line items or software expenses, and not a marketing program. That's going to free up a lot of space in the budget."

## The Software Savings Narrative

Russell sees this as a strategic weapon for budget conversations:

> "I also really like the Vendor Contracts Savings element, and could see a little specific area/section for modeling out projected changes ongoing to things like HubSpot and others to see **how these important renegotiations and reductions that marketing is doing impact the overall broader picture of total software expenses budgeted for 2026 for the whole company**."

> "That's working in my favor as far as making my case for marketing programs to be funded, if I'm doing yeoman's work in the lion's share of bringing down our 2026 software expenses overall line item in the budget with all the reductions we're doing in marketing. That's an important element of this."

The savings view should show:
- Before/after/savings for each vendor contract
- Total marketing software savings: $213,623/yr
- Company-wide context: total SW budget is $871,560 (from Brian's Row 28)
- Marketing's savings as a share: 24.5% of all company software cost reductions
- The narrative: "Marketing drove $213K in vendor savings while asking for $90K in programs budget"

## Editing, Saving, and Two-Way Sync

Russell's primary question that launched the interactive app concept: "How do we create a version of this that allows for **editing and saving and adjusting and changing and tweaking**? That's the main question and the main goal I have here."

And later: "There should be a **two-way connection between the webapp and Google Sheets** as well. Meaning if we update the webapp, Google Sheets updates too."

This means:
- Edits in the web app immediately write back to Google Sheets
- Changes made directly in Google Sheets are picked up on the next refresh
- An on-demand refresh button (not auto-polling) to pull latest Sheets data
- Google OAuth sign-in for write access; read-only mode without sign-in
- Optimistic local updates (update the UI immediately, write to Sheets in background)

## Audience Views

Russell confirmed three audience levels:
1. **Full View** (Russell) — everything visible, all salary details, all contractor names, all categories
2. **CFO View** (Brian) — hides individual salary line items, shows only category totals for headcount, no contractor names visible
3. **Team View** (Marketing team) — hides all headcount/compensation data entirely, shows only Programs + T&E so the team can see program spend without seeing anyone's salary

## UI/UX Requirements

Russell was blunt about the v2 design: "The UI/UX of this is pretty lame. Looks very Generation 1 AI slop vibe-coded design."

What he wants instead: "More of a **Google Sheets-like view, or more like Excel**, thinking something that's a bit more compact. It still has charts and graphs, but the user interface is a little more resemblant of" the v1 dashboard.

Translation for developers:
- **Compact, data-dense** — every pixel should show useful information
- **Spreadsheet aesthetic** — tight rows, small fonts, minimal padding, professional
- **Not a marketing landing page** — no hero sections, no generous whitespace, no large rounded corners
- **Charts are welcome** but should be contained and compact, not dominating the layout
- The v1-reference.html file has the exact CSS values to match: 12px table cells, 8px padding, 14px body, 10px uppercase headers

## Key Constraints Russell Specified

1. **Kate Bertram** is a part-time contractor — she gets rolled into salary totals but must be labeled as contractor with NO fully-loaded cost calculations applied
2. **Forecast should use known commitments only** — $950/mo LinkedIn, $850/mo Google, $300/mo Paperclip. Don't project beyond what's committed.
3. **"Outside Envelope" items** (software subscriptions GL 6303, prepaid GL 6309) are tracked for visibility but NOT counted against the $446K budget
4. **Headcount budget interpretation is unresolved** — the $336K might be salary-only or fully-loaded. Russell needs to ask Brian. The app should handle either interpretation.
5. **Pantheon must be reclassified** from marketing programs to software/infrastructure
6. **Single-file HTML/JS/CSS** — no build tools, no npm, no frameworks
7. **GitHub Pages hosting**
8. **No localStorage** — all state in memory

## The Sophistication Standard

Russell set a high bar early: "It should be highly sophisticated in terms of its formulas and abilities to cross-sheet update dynamically with inputs and ongoing use for 2026 budget tracking and real-time changes. It should be **elegant and simple in nature for the user**, but have a **deep level of data and fields** (perhaps in a separate area or sheet tab not creating clutter and confusion) that enables it to be worked with most easily going forward."

The interface should feel simple. The data model behind it should be deep. The user shouldn't have to understand GL accounts or accounting bases to use it — but the data should be there for anyone who wants to drill in.
