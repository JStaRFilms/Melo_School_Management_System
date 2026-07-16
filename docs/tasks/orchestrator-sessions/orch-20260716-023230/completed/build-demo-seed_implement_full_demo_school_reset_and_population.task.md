# Task build-demo-seed: Implement full demo-school reset and population
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Replace the narrow demo-school seed with a safe, deterministic full-capacity seed covering every visible product workflow while preserving current e2e login compatibility.
## Scope
- packages/convex/functions/academic demo seed modules
- packages/convex/schema.ts only if a run-tracking table is justified
- Local/frozen synthetic portrait and school-brand assets
- Seed unit/integration tests
- Root/package scripts and concise operator documentation
## Context
Parent session: orch-20260716-023230

Task title: Implement full demo-school reset and population
## Definition Of Done
- Reset touches only schools.slug=demo-school and requires explicit confirmation
- Seed creates linked academics, families, attendance, report cards, billing, events, knowledge, lesson artifacts, and assessment banks
- Operational gateway secrets/OCR/AI logs remain empty
- Admin, teacher, and portal login accounts are deterministic
- Profile photos and school logo resolve through Convex storage
- Rerun after partial state is safe
- Typecheck and focused tests pass
## Expected Artifacts
- Seed implementation
- Deterministic data definitions
- Media assets or asset generator with provenance
- Automated tests
- Operator commands and demo login summary
## Dependencies
- design-demo-genesis
## Constraints
- Read packages/convex/_generated/ai/guidelines.md first.
- Do not modify or deploy any environment.
- Preserve unrelated next-env.d.ts working-tree changes.
- Keep existing admin@demo-academy.school and teacher@demo-academy.school login compatibility unless technically unsafe; add a portal demo login.
- Do not perform real payments or external AI calls during seeding.
- Use internal functions for destructive writes and strong runner gates.
- Prefer 36–48 polished students over 72 if transaction/test cost materially improves, but all visible flows must have rich data.
- Do not embed secrets in committed source; fixed public demo credentials may be documented only if intentionally treated as public demo accounts.