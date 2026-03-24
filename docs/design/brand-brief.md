# Brand Brief: School Management System

**Date:** 2026-03-15  
**Architect:** Vibe Architect Mode  
**Version:** 1.0  
**Status:** Approved for Implementation

---

## 1. Executive Summary

This brand brief establishes the visual identity framework for a white-label school management platform. The design system balances **platform consistency** with **school-specific branding flexibility**, enabling a premium initial deployment while supporting clean adaptation for future tenant schools.

**Core Challenge:** Create a visual identity that feels trustworthy and professional for educational institutions while remaining flexible enough for white-label deployment across multiple schools.

---

## 2. Design Principles

### 2.1 Primary Principles

| Principle | Definition | Rationale |
|:----------|:-----------|:----------|
| **Trust-First Aesthetics** | Every visual decision reinforces reliability, security, and institutional credibility | Parents entrust schools with their children; schools entrust us with data and finances |
| **Clarity Over Cleverness** | Information hierarchy takes precedence over visual novelty | School users range from tech-savvy teachers to less-digital parents; clarity ensures adoption |
| **Warm Professionalism** | Balance institutional gravitas with human warmth | Education is personal—avoid cold corporate SaaS feel |
| **Mobile-Primary Thinking** | Design for phone screens first, enhance for desktop | Many parents and some teachers access primarily via mobile |

### 2.2 Secondary Principles

- **Progressive Enhancement:** Core functionality works everywhere; richer experiences on larger screens
- **Accessibility Baseline:** WCAG 2.1 AA compliance is non-negotiable; aim for AAA where practical
- **Data Visualization Clarity:** Academic and financial data must be instantly comprehensible

---

## 3. Visual Mood & Personality

### 3.1 Mood Keywords

```
Primary:      Trustworthy • Professional • Calm
Secondary:    Warm • Approachable • Modern
Accent:       Confident • Clear • Supportive
```

### 3.2 Emotional Targets by User Role

| User Role | Emotional Goal | Visual Translation |
|:----------|:---------------|:-------------------|
| **Parent** | "My child is safe and progressing" | Soft, reassuring colors; clear progress indicators |
| **Student** | "I belong here and can succeed" | Encouraging tones; friendly iconography |
| **Teacher** | "I have tools to do my job well" | Efficient layouts; clear information hierarchy |
| **Admin** | "This system runs my school professionally" | Comprehensive dashboards; clear status indicators |
| **Prospective Family** | "This school is excellent and trustworthy" | Polished public website; professional imagery |

### 3.3 Visual Tone

- **Avoid:** Generic blue-gradient SaaS aesthetics, overused "education" icons (graduation caps, books), sterile hospital-like whiteness
- **Embrace:** Thoughtful color applications, distinctive but readable typography, purposeful whitespace, human-centric photography

---

## 4. Color System

### 4.1 Platform Color Palette (Non-Brandable)

These colors remain consistent across all schools to maintain platform identity:

```css
/* Platform Primary - Trust Blue */
--platform-primary-50: #EEF6FF;
--platform-primary-100: #DBEAFE;
--platform-primary-200: #BFDBFE;
--platform-primary-300: #93C5FD;
--platform-primary-400: #60A5FA;
--platform-primary-500: #3B82F6;  /* Primary action buttons */
--platform-primary-600: #2563EB;
--platform-primary-700: #1D4ED8;
--platform-primary-800: #1E40AF;
--platform-primary-900: #1E3A8A;

/* Platform Neutral */
--platform-neutral-50: #FAFAFA;
--platform-neutral-100: #F5F5F5;
--platform-neutral-200: #E5E5E5;
--platform-neutral-300: #D4D4D4;
--platform-neutral-400: #A3A3A3;
--platform-neutral-500: #737373;
--platform-neutral-600: #525252;
--platform-neutral-700: #404040;
--platform-neutral-800: #262626;
--platform-neutral-900: #171717;

/* Platform Semantic */
--platform-success: #10B981;      /* Positive results, payments received */
--platform-warning: #F59E0B;      /* Pending items, upcoming deadlines */
--platform-error: #EF4444;        /* Errors, overdue payments */
--platform-info: #06B6D4;         /* Informational notices */
```

### 4.2 School-Branded Variables (White-Label Overrides)

These values are configurable per school tenant:

```css
/* School Configurable - with sensible defaults */
--school-primary: #1E40AF;        /* School's main brand color */
--school-primary-hover: #1E3A8A;
--school-secondary: #0F766E;     /* Complementary accent */
--school-secondary-hover: #0D9488;
--school-background: #FFFFFF;   /* Page backgrounds */
--school-surface: #F8FAFC;       /* Card/component backgrounds */
--school-text-primary: #1E293B;  /* Main text */
--school-text-secondary: #64748B; /* Secondary text */
--school-border: #E2E8F0;        /* Dividers and borders */
--school-logo-url: "";           /* School logo upload */
--school-favicon-url: "";        /* School favicon upload */
```

### 4.3 Color Usage Guidelines

| Context | Color Source | Example |
|:--------|:-------------|:--------|
| Platform navigation | `--platform-primary-*` | Sidebar, platform branding |
| School branding | `--school-primary` | School-specific headers, logos |
| Actions | `--platform-primary-500` | Primary buttons, links |
| Alerts | Platform semantic colors | Success/warning/error states |
| Text | School variables | All readable content |
| Backgrounds | School variables | Page and card backgrounds |

---

## 5. Typography System

### 5.1 Font Stack

```css
/* Primary: Readable, professional, distinct */
--font-heading: 'Plus Jakarta Sans', system-ui, sans-serif;
--font-body: 'Plus Jakarta Sans', system-ui, sans-serif;

/* Monospace: For codes, IDs */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Rationale:** Plus Jakarta Sans offers excellent readability at all sizes, feels modern but not generic, and has sufficient character for headings. It also supports the Latin Extended character set needed for diverse naming conventions.

### 5.2 Type Scale

```css
--text-xs: 0.75rem;    /* 12px - Labels, captions */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Lead paragraphs */
--text-xl: 1.25rem;    /* 20px - Section headers */
--text-2xl: 1.5rem;    /* 24px - Page titles */
--text-3xl: 1.875rem;  /* 30px - Hero text */
--text-4xl: 2.25rem;   /* 36px - Marketing headlines */
```

### 5.3 Typography Guidelines

- **Line Height:** 1.5 for body text, 1.2 for headings
- **Letter Spacing:** -0.01em for body, 0 for headings
- **Maximum Line Length:** 65 characters for readability
- **School Font Override:** Schools may provide a custom font family via CSS import

---

## 6. Spacing & Layout System

### 6.1 Spacing Scale

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### 6.2 Layout Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Wide desktop */
--breakpoint-2xl: 1536px; /* Extra wide */
```

### 6.3 Container System

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

---

## 7. Component Guidelines

### 7.1 Core Components (Platform-Standard)

These components maintain consistent styling across all schools:

| Component | Platform Standard Elements |
|:----------|:---------------------------|
| **Buttons** | Border radius: 8px; Height: 40px (default); Platform primary color |
| **Cards** | Border radius: 12px; Padding: 24px; Subtle shadow |
| **Inputs** | Border radius: 8px; Height: 44px; Focus ring in platform color |
| **Tables** | Striped rows; Sticky headers; Hover states |
| **Navigation** | Collapsible sidebar on mobile; Clear active states |
| **Modals** | Centered; Max-width 500px; Clear close actions |
| **Toast Notifications** | Bottom-right; Auto-dismiss after 5s; Semantic colors |

### 7.2 School-Brandable Components

These components accept school branding overrides:

| Component | Brandable Elements |
|:----------|:-------------------|
| **Header** | School logo, school name, school primary color accents |
| **Login Page** | School logo, school primary color for branding elements |
| **Report Cards** | School letterhead, school logo, school seal area |
| **Invoice/Fee Documents** | School branding header, school contact details |
| **Public Website** | Full school theming (see Section 8) |

---

## 8. White-Label Rules

### 8.1 Platform-Consistent Elements (Non-Brandable)

The following elements remain identical across all schools to maintain platform identity:

1. **Authentication Flow:** Login pages, password reset, verification screens
2. **Navigation Structure:** Sidebar items, menu organization, breadcrumb patterns
3. **Core Interaction Patterns:** Button behaviors, form validation, loading states
4. **Platform Branding:** "Powered by [Platform]" attribution (footer)
5. **Error States:** Error pages, fallback content, maintenance screens
6. **System Notifications:** Platform-level alerts, maintenance notices
7. **Component Library Base:** Input fields, dropdowns, checkboxes, toggles

### 8.2 School-Brandable Elements

Schools may customize:

1. **Logo Upload:** PNG/SVG, max 200x60px, transparent background preferred
2. **Brand Colors:** Primary and secondary colors with automatic contrast checking
3. **School Name:** Display name throughout the system
4. **Contact Information:** Address, phone, email on documents
5. **Favicon:** 32x32 PNG for browser tab
6. **Public Website:** Full theme application per school (see Section 8.3)
7. **Report Card Templates:** School-specific header/footer layouts

### 8.3 Public Website White-Label Scope

For the `www` application, schools have full theming control:

```css
/* Public website full customization */
--www-hero-background: [school choice];
--www-accent-color: [school primary];
--www-font-heading: [school choice or default];
--www-font-body: [school choice or default];
--www-card-style: [elevated | outlined | flat];
```

**Note:** Public website must still maintain accessibility standards and cannot override platform-level security features.

### 8.4 White-Label Implementation Rules

1. **CSS Custom Properties:** All brandable values use CSS variables for runtime theming
2. **Tenant Context:** Theme resolved server-side based on school subdomain/ID
3. **Fallback Defaults:** Missing school config falls back to platform defaults
4. **Validation:** School-provided colors validated for WCAG contrast compliance
5. **Asset Storage:** School logos/images stored in school-specific storage buckets

---

## 9. Imagery & Iconography

### 9.1 Photography Guidelines

- **Style:** Authentic, diverse, warm—avoid stock photo artificiality
- **Subjects:** Real students, teachers, school environments
- **Tone:** Active learning, collaborative work, supportive environments
- **Diversity:** Reflect the school's community; inclusive representation

### 9.2 Icon System

```css
--icon-size-sm: 16px;
--icon-size-md: 20px;
--icon-size-lg: 24px;
--icon-size-xl: 32px;
```

- **Primary Icon Set:** Lucide React (consistent, readable, MIT licensed)
- **Custom Icons:** School-specific icons allowed for report cards/diplomas
- **Avoid:** Generic education icons that make all schools look identical

### 9.3 Illustration Style (If Used)

- **Style:** Flat or semi-flat, modern, approachable
- **Colors:** Use school branding when applicable
- **Purpose:** Empty states, onboarding, explanatory content

---

## 10. Application-Specific Guidance

### 10.1 Public Website (`www`)

- **Design Goal:** Convert prospective families
- **Branding:** Full school customization
- **Key Pages:** Homepage, About, Admissions, Contact, News/Events

### 10.2 Admin Application (`admin`)

- **Design Goal:** Efficient school operations
- **Branding:** School logo + platform structure
- **Key Pages:** Dashboard, Student Management, Academic Config, Billing, Reports

### 10.3 Teacher Workspace (`teacher`)

- **Design Goal:** Effective lesson delivery and assessment
- **Branding:** School logo + platform structure
- **Key Pages:** Class Dashboard, Lesson Planning, Assessment Entry, Results

### 10.4 Parent/Student Portal (`portal`)

- **Design Goal:** Family engagement and information access
- **Branding:** School logo + platform structure
- **Key Pages:** Academic Overview, Results, Fee Payment, Communications

---

## 11. Accessibility Requirements

### 11.1 Minimum Standards

- All interactive elements keyboard accessible
- Color contrast ratio minimum 4.5:1 for text
- Focus indicators visible on all focusable elements
- ARIA labels on icon-only buttons
- Form inputs have associated labels

### 11.2 School Branding Constraints

Schools cannot override:
- Minimum contrast ratios
- Focus indicator styling
- Text equivalent requirements for images

---

## 12. Implementation Notes

### 12.1 CSS Architecture

```css
/* Layer order (CSS cascade) */
@layer platform-base;    /* Platform defaults */
@layer school-theme;     /* School overrides via CSS variables */
@layer component-styles; /* Component-specific styles */
```

### 12.2 Theme Resolution

1. Request hits platform with school identifier (subdomain or path)
2. Server fetches school theme configuration from database
3. CSS custom properties injected as inline styles on document root
4. Components use CSS variables; school theme applied automatically

### 12.3 Design Tokens

All design decisions expressed as tokens in `apps/shared/design-tokens/`:

```
design-tokens/
├── colors.css
├── typography.css
├── spacing.css
├── components.css
└── themes/
    ├── platform-default.css
    └── school-placeholder.css
```

---

## 13. Verification Checklist

Before design implementation, confirm:

- [ ] Platform colors applied to all navigation and core components
- [ ] School branding applied correctly to headers, logos, documents
- [ ] Mobile layouts tested at 320px width
- [ ] All text meets WCAG contrast requirements
- [ ] Focus states visible on all interactive elements
- [ ] Public website full theming functional
- [ ] Report card templates support school branding
- [ ] Theme switcher works for white-label testing

---

## 14. References

- **Design Skills:** `frontend-design`, `ui-ux-pro-max`
- **Related Documents:**
  - [`docs/Project_Requirements.md`](../Project_Requirements.md)
  - [`docs/Coding_Guidelines.md`](../Coding_Guidelines.md)
  - [`docs/decisions/ADR-004-tenancy-model.md`](../decisions/ADR-004-tenancy-model.md)

---

*This brand brief provides the visual direction framework. It should be followed by detailed mockups for each application (T14-T17) and the shared design system foundation (T13).*
