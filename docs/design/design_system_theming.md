# Melo Design System: Dynamic School Theming Architecture

## 1. Overview & Core Philosophy
Melo provides school-level white-labeling and brand customization configured in **School Settings** (`/admin/settings`). Each school defines:
* **Primary Brand Color** (`primaryColor`): The deep/primary school color (e.g. Royal Navy, Forest Green, Deep Burgundy, Slate `#0f172a`).
* **Accent Brand Color** (`accentColor`): The vibrant highlight color (e.g. Gold, Electric Blue, Amber `#2563eb`).

## 2. Hard Rule: Brand Identity vs. Status Semantics
To prevent visual confusion (e.g., if a school selects Crimson Red as their brand color, an "Active Term" must NOT turn red like an error), we strictly separate **Brand Identity** from **Status Semantics**:

| Token Domain | Intended Usage | Colors |
| :--- | :--- | :--- |
| **Brand Identity** | Active navigation pills, Primary CTA buttons (`bg-brand-primary`), Focus rings, Header watermarks, Report card headers | School Theme: `--school-primary`, `--school-accent` |
| **Operational Status** | "Active" Session/Term pills, System Online, Verified records | **Emerald Green** (`bg-emerald-600`, `text-emerald-700`) |
| **System Danger** | Archived records, Delete, Suspension lock screen | **Rose Red** (`bg-rose-600`, `text-rose-700`) |
| **System Warning** | Pending review, Expiring timers, Audit alerts | **Amber** (`bg-amber-500`, `text-amber-800`) |

## 3. CSS Custom Properties
Injected at the root container by `WorkspaceNavbar`:
```css
:root {
  --school-primary: #0f172a;        /* Default or School-configured primary */
  --school-accent: #2563eb;         /* Default or School-configured accent */
  --school-primary-light: rgba(15, 23, 42, 0.06);
  --school-primary-border: rgba(15, 23, 42, 0.15);
  --school-accent-light: rgba(37, 99, 235, 0.10);
}
```

## 4. Tailwind Token Classes
Use these Tailwind utility classes across admin and shared components:
* `bg-brand-primary` / `text-brand-primary`: Primary action buttons and major identity accents.
* `bg-brand-accent` / `text-brand-accent`: Secondary highlights and interactive link accents.
* `bg-brand-light`: 6% background tint for branded surfaces.
* `border-brand-border`: Subtle 15% border outline.
* `bg-brand-accent-light`: 10% accent wash for subtle highlight cards.
