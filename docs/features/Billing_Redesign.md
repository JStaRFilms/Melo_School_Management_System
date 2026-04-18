# Feature Blueprint: Billing Page Redesign

## Goal
Overhaul the `/billing` page to improve spacing, reduce card overuse, simplify typography, and align with the established Admin UI patterns. The current implementation is a 2800+ line "God Component" that needs to be decomposed.

## UI/UX Redesign Strategy
1. **Decomposition**: Split the massive `page.tsx` into smaller, functional components.
2. **Layout Alignment**:
   - Use `AdminHeader` with `StatGroup` for high-level metrics (Outstanding, Collected, Invoices, Overdue).
   - Use a **Main + Sidebar** layout consistent with other Admin pages.
   - **Main Area**: Interactive tables/lists for Invoices and Payments with robust filtering.
   - **Sidebar Area**: Contextual forms (Create Fee Plan, Apply Fee Plan, Settings).
3. **Visual Clean-up**:
   - Remove "technical" explanations that clutter the UI (e.g., explaining how webhooks work).
   - Improve spacing using Tailwind's `gap` and `padding` utilities.
   - Replace redundant cards with `AdminSurface` or flat sections with clear hierarchies.
   - Use a **Tabs** system to clean up the dashboard: `[Overview, Invoices, Payments, Fee Plans, Configuration]`.

## Components Structure
Proposed split:
- `page.tsx`: Entry point and data fetching orchestrator.
- `components/SummaryCards.tsx`: Top stats.
- `components/InvoiceManager.tsx`: Invoice list and filters.
- `components/PaymentManager.tsx`: Payment list and filters.
- `components/FeePlanList.tsx`: Fee plan management.
- `components/BillingConfig.tsx`: All settings (Prefix, Gateway, Modes).
- `components/PaymentLinkHandoff.tsx`: The front-desk payment tool.

## Data Flow
- Unified Convex query `getBillingDashboard` provides initial state.
- Real-time updates for payment status reconciliations.
- Zod validation for all form inputs.

## Performance Improvements
- Use `useDeferredValue` for search filters.
- Virtualize large lists or implement pagination at the Convex level.
- Extract logic into a `useBilling` custom hook.
