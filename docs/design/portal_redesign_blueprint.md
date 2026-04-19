# Portal Redesign Blueprint

> **Design Philosophy**: The admin surface is a *control room* — dense, utilitarian, built for power users. The portal should feel like a *living room* — warm, personal, effortless. Same underlying DNA (clean type, clear hierarchy) but fundamentally different emotional register.

## What's Wrong Now

The current portal is a **reskinned admin page**. Every mode follows the same template:
1. Giant hero banner with title + description + 2 CTAs (unnecessary — the sidebar already navigates)
2. Student selector pills crammed into the hero footer
3. 8-column / 4-column grid below

This is **structurally repetitive**. A parent opening the dashboard sees the same layout as results, as billing, as notifications. There's no sense of place. The hero description text ("Review the latest report card, historical term results...") is explaining the UI to the user — that's a sign the UI isn't self-evident.

---

## Creative Direction: "The Morning Briefing"

**Concept**: When a parent opens the portal, it should feel like opening a well-organized notebook about their child — not like logging into enterprise software. Think **Notion's personal workspace** meets **a school newsletter**, not Stripe Dashboard.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Kill the hero banner entirely** | The sidebar already tells you where you are. The hero is 200px of wasted vertical space saying "Academic Dashboard" when the sidebar already highlights "Dashboard". |
| **Lead with context, not chrome** | First thing a parent sees: their child's name, class, and a warm greeting based on time of day. Not a blue gradient. |
| **Replace stat cards with an inline summary sentence** | "Adamu scored an average of **78.3** across **12 subjects** this term" is more human than 4 identical boxes showing `78.3`, `12`, `0`, `3`. |
| **Stacked single-column for mobile-first** | Parents use phones. The 8/4 grid is desktop-first thinking. Default to single column with natural stacking. |
| **Use a proper data table for results** | The history cards are bloated. A clean table with term, class, average, and a view button is more scannable. |
| **Billing gets a receipt-style layout** | Invoices should look like actual receipts/bills — not enterprise cards with 3 sub-stat boxes. |
| **Contextual color, not decorative color** | Green = paid/good, amber = attention, red = overdue. No blue gradients for decoration. |

---

## Page-by-Page Redesign

### Dashboard (`/`)

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Greeting bar: "Good evening, Mrs. Adamu"                    │
│ [Child A] [Child B]  ← inline pill switcher                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Term Snapshot ──────────────────────────────────────────┐│
│ │ "Bola scored 78.3% across 12 subjects in Term 2"        ││
│ │ [View full report card →]                                ││
│ │                                                          ││
│ │ Top 4 subjects mini-table (inline, no card)              ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Recent Results ─────────┐ ┌─ Updates ──────────────────┐│
│ │ Term 2 · JSS1 · 78.3    │ │ Results published for T2   ││
│ │ Term 1 · JSS1 · 72.1    │ │ Fees due by March 15       ││
│ │ [See all →]              │ │                            ││
│ └──────────────────────────┘ └────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
- **Greeting bar** replaces the hero. Time-aware ("Good morning/afternoon/evening"), uses the viewer's name
- **Summary sentence** replaces stat cards. One rich sentence > 4 boxes
- **Compact results list** with just term name, score, and chevron — no card borders
- **Updates sidebar** is a simple feed, no icon boxes

### Results (`/results`)

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Academic History                                             │
│ "Bola's results across terms"                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SESSION         TERM      CLASS    AVG     SUBJECTS  →     │
│  ────────────    ───────   ─────    ────    ────────  ───   │
│  2024/2025       Term 2    JSS1     78.3    12              │
│  2024/2025       Term 1    JSS1     72.1    12              │
│  2023/2024       Term 3    Prim6    81.0    11              │
│                                                             │
│  [Open selected report card →]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key change**: Replace bloated stacked cards with a **clean data table**. Each row is clickable. The active row gets a subtle left-border accent. No 4-column sidebar — it's just noise on this page.

### Billing (`/billing`)

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Fees & Payments                                              │
│ Outstanding: ₦45,000                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Invoice ──────────────────────────────────────────────┐ │
│  │ School Fees - Term 2                    ₦75,000 total  │ │
│  │ INV-2024-0042 · Due 15 Mar 2025                        │ │
│  │                                                        │ │
│  │ Tuition ............................ ₦50,000            │ │
│  │ Books & Materials ................. ₦15,000            │ │
│  │ Technology Levy ................... ₦10,000            │ │
│  │ ──────────────────────────────────────────             │ │
│  │ Paid: ₦30,000    Balance: ₦45,000                     │ │
│  │                                                        │ │
│  │ [Pay ₦45,000 now →]                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Payment History ──────────────────────────────────────┐ │
│  │ ₦30,000 · Paystack · 12 Feb 2025 · Confirmed         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key change**: Invoice looks like an **actual invoice/receipt** — dotted leaders between label and amount, clear totals at bottom. Not a generic card with sub-stat boxes.

### Notifications (`/notifications`)

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ School Updates                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ● Results published for Term 2, 2024/2025                  │
│    View your child's report card                            │
│                                                             │
│  ● Fee reminder: ₦45,000 outstanding                        │
│    Payment due by March 15, 2025                            │
│                                                             │
│  ○ Term 3 begins April 28, 2025                             │
│    Check back for the updated class timetable               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key change**: Simple **feed layout**. No cards. No sidebars. Filled dot = actionable, hollow dot = informational. Clean and scannable.

---

## Design Tokens (Portal-specific)

| Token | Value | Why |
|-------|-------|-----|
| **Border radius** | `16px` (cards), `12px` (buttons), `8px` (inputs) | Slightly rounder than admin (which uses `1.75rem`). Feels approachable. |
| **Shadow** | `0 1px 3px rgba(0,0,0,0.04)` | Almost invisible. Cards defined by border, not shadow depth. |
| **Active accent** | `emerald-600` | Warm, academic, not corporate-blue |
| **Text hierarchy** | `slate-900` (primary), `slate-500` (secondary), `slate-400` (tertiary) | Same as admin — this is the shared DNA |
| **Section spacing** | `32px` between sections, `16px` within | More breathing room than admin's `24px` |

---

## What Stays The Same (Shared DNA)

- `slate` color family for text hierarchy
- Clean sans-serif typography (system font stack — we're inside Next.js, not a marketing page)
- Lucide icons
- The `ReportCardSheet` / print system (completely untouched)
- The `WorkspaceNavbar` sidebar/header chrome

## What's Fundamentally Different

- **No hero banner** — greeting bar instead
- **Summary sentence** instead of stat cards on dashboard
- **Tables** instead of card stacks for data lists
- **Receipt-style billing** instead of generic cards
- **Feed layout** for notifications instead of card grid
- **Single-column default** with optional 2-column on wide screens
