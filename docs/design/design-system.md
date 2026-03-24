# Design System: School Management Platform

**Date:** 2026-03-15  
**Architect:** Vibe Architect Mode  
**Version:** 1.0  
**Status:** Foundation Ready for Implementation

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Typography](#2-typography)
3. [Colors](#3-colors)
4. [Spacing & Layout](#4-spacing--layout)
5. [Components](#5-components)
6. [Accessibility](#6-accessibility)
7. [Print Styles](#7-print-styles)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. Design Tokens

Design tokens are the visual design atoms of the design system — specifically, they are named entities that store visual design attributes. All tokens use CSS custom properties for runtime theming.

### Token Categories

| Category | Description | Location |
|:---------|:------------|:---------|
| Colors | Platform colors, school branding, semantic colors | `colors.css` |
| Typography | Font families, sizes, line heights, tracking | `typography.css` |
| Spacing | Margins, paddings, gaps | `spacing.css` |
| Components | Component-specific tokens | `components.css` |

---

## 2. Typography

### Font Stack

| Token | Value | Usage |
|:------|:------|:------|
| `--font-heading` | Plus Jakarta Sans | Headings |
| `--font-body` | Plus Jakarta Sans | Body text |
| `--font-mono` | JetBrains Mono | Code, IDs |

**Google Fonts Import:**
```
https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap
```

### Type Scale

| Token | Value | Example |
|:------|:------|:--------|
| `--text-xs` | 0.75rem (12px) | Labels, captions |
| `--text-sm` | 0.875rem (14px) | Secondary text |
| `--text-base` | 1rem (16px) | Body text |
| `--text-lg` | 1.125rem (18px) | Lead paragraphs |
| `--text-xl` | 1.25rem (20px) | Section headers |
| `--text-2xl` | 1.5rem (24px) | Page titles |
| `--text-3xl` | 1.875rem (30px) | Marketing headlines |
| `--text-4xl` | 2.25rem (36px) | Hero text |

### Typography Guidelines

- **Line Height:** 1.5 for body text (`--leading-normal`), 1.2 for headings (`--leading-tight`)
- **Letter Spacing:** -0.01em for body (`--tracking-tight`), 0 for headings
- **Maximum Line Length:** 65 characters for readability

---

## 3. Colors

### 3.1 Platform Primary (Non-Brandable)

These colors remain consistent across all schools to maintain platform identity:

| Token | Value | Usage |
|:------|:------|:------|
| `--platform-primary-50` | #EEF6FF | Lightest backgrounds |
| `--platform-primary-100` | #DBEAFE | Hover states, badges |
| `--platform-primary-200` | #BFDBFE | Secondary backgrounds |
| `--platform-primary-300` | #93C5FD | Disabled states |
| `--platform-primary-400` | #60A5FA | Icons, decorative |
| `--platform-primary-500` | #3B82F6 | Primary buttons, links |
| `--platform-primary-600` | #2563EB | Button hover |
| `--platform-primary-700` | #1D4ED8 | Active states |
| `--platform-primary-800` | #1E40AF | Sidebar, headers |
| `--platform-primary-900` | #1E3A8A | Dark backgrounds |

### 3.2 Platform Neutral

| Token | Value | Usage |
|:------|:------|:------|
| `--platform-neutral-50` | #FAFAFA | Page backgrounds |
| `--platform-neutral-100` | #F5F5F5 | Card backgrounds |
| `--platform-neutral-200` | #E5E5E5 | Borders |
| `--platform-neutral-300` | #D4D4D4 | Dividers |
| `--platform-neutral-400` | #A3A3A3 | Placeholder text |
| `--platform-neutral-500` | #737373 | Secondary text |
| `--platform-neutral-600` | #525252 | Body text |
| `--platform-neutral-700` | #404040 | Headings |
| `--platform-neutral-800` | #262626 | Dark text |
| `--platform-neutral-900` | #171717 | Darkest text |

### 3.3 Semantic Colors

| Token | Value | Usage |
|:------|:------|:------|
| `--platform-success` | #10B981 | Positive results, payments received |
| `--platform-warning` | #F59E0B | Pending items, upcoming deadlines |
| `--platform-error` | #EF4444 | Errors, overdue payments |
| `--platform-info` | #06B6D4 | Informational notices |

### 3.4 School-Branded Variables (White-Label)

These tokens can be customized per school tenant:

| Token | Default | Description |
|:------|:--------|:------------|
| `--school-primary` | #1E40AF | School's main brand color |
| `--school-primary-hover` | #1E3A8A | School primary hover state |
| `--school-secondary` | #0F766E | Complementary accent |
| `--school-secondary-hover` | #0D9488 | School secondary hover |
| `--school-background` | #FFFFFF | Page backgrounds |
| `--school-surface` | #F8FAFC | Card/component backgrounds |
| `--school-text-primary` | #1E293B | Main text color |
| `--school-text-secondary` | #64748B | Secondary text |
| `--school-border` | #E2E8F0 | Borders and dividers |

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

| Token | Value | Usage |
|:------|:------|:------|
| `--space-1` | 0.25rem (4px) | Tight spacing |
| `--space-2` | 0.5rem (8px) | Component internal |
| `--space-3` | 0.75rem (12px) | Small gaps |
| `--space-4` | 1rem (16px) | Default spacing |
| `--space-5` | 1.25rem (20px) | Medium gaps |
| `--space-6` | 1.5rem (24px) | Section padding |
| `--space-8` | 2rem (32px) | Large gaps |
| `--space-10` | 2.5rem (40px) | XL spacing |
| `--space-12` | 3rem (48px) | Section margins |
| `--space-16` | 4rem (64px) | Hero spacing |

### 4.2 Layout Breakpoints

| Token | Value | Device |
|:------|:------|:-------|
| `--breakpoint-sm` | 640px | Mobile landscape |
| `--breakpoint-md` | 768px | Tablet |
| `--breakpoint-lg` | 1024px | Desktop |
| `--breakpoint-xl` | 1280px | Wide desktop |
| `--breakpoint-2xl` | 1536px | Extra wide |

### 4.3 Container Max Widths

| Token | Value |
|:------|:------|
| `--container-sm` | 640px |
| `--container-md` | 768px |
| `--container-lg` | 1024px |
| `--container-xl` | 1280px |
| `--container-2xl` | 1536px |

---

## 5. Components

### 5.1 Buttons

**Platform Standard** - Buttons use platform primary colors and follow consistent sizing. School branding is NOT applied to buttons to maintain platform consistency.

#### Variants

| Class | Description |
|:------|:------------|
| `.btn-primary` | Primary action (platform blue) |
| `.btn-secondary` | Secondary action (surface background) |
| `.btn-ghost` | Tertiary action (transparent) |
| `.btn-danger` | Destructive action (red) |

#### Sizes

| Class | Height | Usage |
|:------|:-------||:------|
| `.btn-sm` | 32px | Compact contexts |
| `.btn` (default) | 40px | Most buttons |
| `.btn-lg` | 48px | Important CTAs |

#### States

- Default
- Hover: Slightly darker background
- Active: Even darker, slight scale
- Disabled: 50% opacity, not-allowed cursor
- Loading: Spinner animation, transparent text

#### CSS Variables

```css
--btn-border-radius: var(--radius-md);
--btn-height: 40px;
--btn-padding-x: var(--space-4);
--btn-font-size: var(--text-sm);
--btn-font-weight: 500;
```

---

### 5.2 Form Inputs

**Platform Standard** - Form inputs are platform-consistent and support school theming through CSS variables.

#### Components

| Component | Class | Description |
|:----------|:------|:------------|
| Text Input | `.form-input` | Standard text field |
| Textarea | `.form-textarea` | Multi-line input |
| Select | `.form-select` | Dropdown with custom arrow |
| Checkbox | `.form-checkbox` | Custom styled checkbox |
| Radio | `.form-radio` | Custom styled radio |

#### States

- Default: Border color `--school-border`
- Hover: Border color `--platform-neutral-400`
- Focus: Border `--platform-primary-500`, ring `rgba(59, 130, 246, 0.1)`
- Error: Border `--platform-error`
- Disabled: Background `--platform-neutral-100`

#### CSS Variables

```css
--input-height: 44px;
--input-border-radius: var(--radius-md);
--input-border-width: 1px;
--input-font-size: var(--text-base);
--input-focus-ring: 0 0 0 3px var(--platform-primary-100);
```

---

### 5.3 Cards

**School-Brandable** - Cards accept school branding through CSS variables.

#### Variants

| Class | Description |
|:------|:------------|
| `.card` | Default with border and shadow-sm |
| `.card-elevated` | No border, shadow-md |
| `.card-interactive` | Hover effects (lift + shadow) |

#### Structure

```html
<div class="card">
  <div class="card-header">
    <h4 class="card-title">Title</h4>
    <!-- Optional badge or actions -->
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
  <div class="card-footer">
    <!-- Actions -->
  </div>
</div>
```

#### CSS Variables

```css
--card-border-radius: var(--radius-lg);
--card-padding: var(--space-6);
--card-shadow: var(--shadow-sm);
```

---

### 5.4 Tables

**Platform Standard** - Tables maintain consistent styling across all schools.

#### Features

- Striped rows (`.table-striped`)
- Sticky headers (`.table-sticky-header`)
- Hover states
- Responsive wrapper (`.table-wrapper`)

#### CSS Variables

```css
--table-border-radius: var(--radius-lg);
--table-header-bg: var(--school-surface);
--table-row-hover: var(--school-surface);
```

---

### 5.5 Navigation

#### Sidebar Navigation

- Fixed left position, 260px width
- Platform primary color background (deep blue)
- White text with 80% opacity
- Active state: lighter background, full opacity
- Mobile: slide-out drawer with overlay

#### Components

| Component | Class | Description |
|:----------|:------|:------------|
| Sidebar | `.sidebar` | Main navigation container |
| Section | `.sidebar-section` | Grouped links |
| Link | `.sidebar-link` | Individual navigation item |
| Breadcrumbs | `.breadcrumbs` | Path navigation |

---

### 5.6 Modals

**Platform Standard** - Modal styling is consistent across all schools.

#### Features

- Centered overlay with backdrop blur
- Max-width 500px (customizable)
- Header with close button
- Footer with action buttons
- Focus trap for accessibility

#### CSS Variables

```css
--modal-overlay-bg: rgba(0, 0, 0, 0.5);
--modal-bg: var(--school-background);
--modal-border-radius: var(--radius-lg);
--modal-max-width: 500px;
```

---

### 5.7 Toast Notifications

**Platform Standard** - Toast notifications use semantic platform colors.

#### Types

| Class | Border Color | Icon |
|:------|:-------------|:-----|
| `.toast-success` | `--platform-success` | Checkmark |
| `.toast-warning` | `--platform-warning` | Triangle |
| `.toast-error` | `--platform-error` | X circle |
| `.toast-info` | `--platform-info` | Info circle |

#### Behavior

- Position: Bottom-right
- Auto-dismiss: 5 seconds
- Animation: Slide in from right
- Manual dismiss: Close button

---

### 5.8 Additional Components

#### Badges

| Class | Background | Text Color |
|:------|:-----------|:-----------|
| `.badge-primary` | `--platform-primary-100` | `--platform-primary-700` |
| `.badge-success` | #D1FAE5 | #065F46 |
| `.badge-warning` | #FEF3C7 | #92400E |
| `.badge-error` | #FEE2E2 | #991B1B |
| `.badge-neutral` | `--platform-neutral-100` | `--platform-neutral-600` |

#### Alerts

- Similar to toasts but for inline messages
- Larger padding for visibility
- Icon on left side

#### Avatars

| Class | Size |
|:------|:-----|
| `.avatar-sm` | 32px |
| `.avatar-md` | 40px |
| `.avatar-lg` | 48px |
| `.avatar-xl` | 64px |

#### Progress Bars

| Class | Color |
|:------|:------|
| `.progress-bar` | `--platform-primary-500` |
| `.progress-bar-success` | `--platform-success` |
| `.progress-bar-warning` | `--platform-warning` |
| `.progress-bar-error` | `--platform-error` |

#### Tabs

- Horizontal tab list
- Active state: bottom border in platform primary
- Smooth transition between tabs

---

## 6. Accessibility

### Requirements

All interactive elements meet WCAG 2.1 AA standards:

- [ ] All interactive elements keyboard accessible
- [ ] Color contrast ratio minimum 4.5:1 for text
- [ ] Focus indicators visible on all focusable elements
- [ ] ARIA labels on icon-only buttons
- [ ] Form inputs have associated labels
- [ ] Skip link provided for keyboard users
- [ ] Reduced motion support via `prefers-reduced-motion`

### Focus States

```css
:focus-visible {
  outline: 2px solid var(--platform-primary-500);
  outline-offset: 2px;
}
```

### Skip Link

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### Screen Reader Only

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## 7. Print Styles

The design system includes print-specific styles for generating printable documents like report cards and invoices.

### Print Rules

| Rule | Implementation |
|:-----|:---------------|
| Backgrounds | Removed, white background |
| Text | Black color |
| Shadows | Removed |
| Links | Show URL in parentheses |
| Page breaks | Avoid inside cards |
| Buttons | Render as dark blocks |

### Media Query

```css
@media print {
  body {
    background: white;
    color: black;
  }

  .no-print {
    display: none !important;
  }

  .card {
    box-shadow: none;
    border: 1px solid #ddd;
    break-inside: avoid;
  }

  .btn-primary {
    background: #333 !important;
    color: white !important;
  }

  a {
    text-decoration: underline;
  }

  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 10px;
    color: #666;
  }
}
```

---

## 8. Implementation Notes

### CSS Architecture

```css
/* Layer order (CSS cascade) */
@layer platform-base;    /* Platform defaults */
@layer school-theme;     /* School overrides via CSS variables */
@layer component-styles;  /* Component-specific styles */
```

### File Structure

```
apps/shared/design-tokens/
├── colors.css
├── typography.css
├── spacing.css
├── components.css
└── themes/
    ├── platform-default.css
    └── school-placeholder.css
```

### Theme Resolution

1. Request hits platform with school identifier (subdomain or path)
2. Server fetches school theme configuration from database
3. CSS custom properties injected as inline styles on document root
4. Components use CSS variables; school theme applied automatically

### Component States Summary

| Component | States |
|:----------|:-------|
| Buttons | default, hover, active, disabled, loading |
| Inputs | default, hover, focus, error, disabled |
| Cards | default, elevated, interactive |
| Toasts | success, warning, error, info |
| Badges | primary, success, warning, error, neutral |

---

## Verification Checklist

Before implementation, confirm:

- [ ] Platform colors applied to all navigation and core components
- [ ] School branding applied correctly to cards, backgrounds
- [ ] Mobile layouts tested at 320px width
- [ ] All text meets WCAG contrast requirements
- [ ] Focus states visible on all interactive elements
- [ ] Print styles tested with report card template
- [ ] Reduced motion respected on animations

---

## References

- Design Skills: `frontend-design`, `ui-ux-pro-max`
- Related Documents:
  - [`docs/design/brand-brief.md`](brand-brief.md)
  - [`docs/Project_Requirements.md`](../Project_Requirements.md)
  - [`docs/Coding_Guidelines.md`](../Coding_Guidelines.md)

---

*This design system provides the shared foundation for all School Management Platform applications. It balances platform consistency with school-specific branding flexibility.*
