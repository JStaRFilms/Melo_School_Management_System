# Master Plan: Unified Toast Notification System Genesis

**Session ID:** orch-20260428-204715
**Runtime Mode:** hybrid
**Session Intent:** full-project

## Lifecycle

### Genesis

- Status: completed
- Tasks: 01
- Expandable: yes

### Design

- Status: pending
- Tasks: 02, 03
- Expandable: yes
- Expanded At: 2026-04-28T19:57:54.368Z

### Build

- Status: pending
- Tasks: 04, 05, 06, 07, 08, 09
- Expandable: yes
- Expanded At: 2026-04-28T19:58:10.251Z

## Tasks

| ID | Stage | Title | Status | Role | Preferred Agent | Workflow | Model | Skills |
|---|---|---|---|---|---|---|---|---|
| 01 | genesis | Genesis foundation | completed | orchestrator | orchestrator | vibe-genesis | - | - |
| 02 | design | Toast architecture decision record | pending | architect | architect | vibe-design | gpt-5.5 | - |
| 03 | design | Validation UX policy | pending | design | designer | vibe-design | gpt-5.5 | - |
| 04 | build | Shared toast foundation | pending | code | coder | vibe-build | gpt-5.4 | - |
| 05 | build | Root layout toaster integration | pending | code | coder | vibe-build | gpt-5.4 | - |
| 06 | build | High-impact global error replacement | pending | code | coder | vibe-build | gpt-5.4 | - |
| 07 | build | Validation banner integration | pending | code | coder | vibe-build | gpt-5.4 | - |
| 08 | build | One-off notification component cleanup | pending | code | coder | vibe-build | gpt-5.4 | - |
| 09 | build | Deep review and regression pass | pending | review | reviewer | vibe-build | gpt-5.5 | - |

## Notes

- Human-readable task docs live in this session folder.
- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.
- Sending a task back to the same agent should reuse its conversationId when continuity is helpful.
- Sessions follow the Genesis -> Design -> Build lifecycle, but each stage may stay compact or expand into more tasks.
- The notification work must remain modular in two explicit layers:
  - System layer: `appToast`, typed options, error-message normalization, default durations, privacy rules, and import/export boundaries.
  - UI layer: `AppToaster` and any visual styling or theme tokens. The UI must be isolated enough that a later agent can redesign the toast appearance without changing the system API or app call sites.
- If multiple agents are used, assign the system layer and UI layer as separate ownership areas. If one agent implements both, require a final self-check that the UI can be changed by editing the component only.
- Toasts are for transient action feedback. They must not replace the persistent notification center or remove useful inline validation guidance.
- Before Build starts, the design blueprint must explicitly identify the shared files, root layout targets, migration targets, validation policy, and verification commands.
