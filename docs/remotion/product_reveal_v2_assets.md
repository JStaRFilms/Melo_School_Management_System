# 🎨 Asset Manifest: Product Reveal V2

## 1. Code-Generatable Components ✅
*These can be built entirely with React/SVG code*

| Component | Description | Complexity |
|-----------|-------------|------------|
| `VideoWorkspaceNavbar.tsx` | Faithful clone of `WorkspaceNavbar` (Sidebar + Top bar) | Medium |
| `VideoReportCard.tsx` | Faithful clone of `ReportCardSheet` | High |
| `VideoBillingDashboard.tsx` | Mock dashboard for billing stats/tables | Medium |
| `VideoPortalDashboard.tsx` | Mock dashboard for parent portal | Medium |
| `CursorV2.tsx` | Optimized cursor with better easing | Low |

---

## 2. Image Assets 🖼️
*Using existing assets or simple code-generated ones*

- `school-logo.png`: Use a generic placeholder or the OS initials SVG.
- `student-photo.png`: Use the generate_image tool for a professional-looking student.

---

## 3. External Assets Needed 📦
- None. Everything will be built as code components for maximum control and "live product" feel.

---

## 4. Implementation Strategy
- **Video-Safe Clones**: I will copy the JSX from the real components but remove all `next.js` specific imports and hooks.
- **Mock Data**: Pre-filled static data to avoid Convex or Auth dependencies.
