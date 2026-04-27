# Master Plan: Lesson Knowledge Hub v2 - Context-First Planning Workflow

**Session ID:** orch-20260426-140008
**Runtime Mode:** hybrid
**Session Intent:** full-project

## Lifecycle

### Genesis
- Status: completed
- Tasks: 01
- Expandable: yes
### Design
- Status: completed
- Tasks: 02, 03, 04
- Expandable: yes
- Expanded At: 2026-04-26T13:00:46.787Z
### Build
- Status: completed
- Tasks: 05, 06, 07, 08, 09, 10, 11
- Expandable: yes
- Expanded At: 2026-04-26T13:01:13.878Z
## Tasks

| ID | Stage | Title | Status | Role | Preferred Agent | Workflow | Model | Skills |
|---|---|---|---|---|---|---|---|---|
| 01 | genesis | Genesis foundation | completed | orchestrator | orchestrator | vibe-genesis | - | - |
| 02 | design | Planning information architecture and workflow redesign | completed | architect | architect | vibe-design | oauth-router/gpt-5.5 | - |
| 03 | design | Domain model and retrieval contract for context-first planning | completed | architect | architect | vibe-design | oauth-router/gpt-5.5 | - |
| 04 | design | Implementation sequencing, migration, and UX risk review | completed | review | reviewer | vibe-design | oauth-router/gpt-5.5 | - |
| 05 | build | Teacher planning hub and context launcher | completed | code | coder | vibe-build | oauth-router/gpt-5.5 | - |
| 06 | build | Context-aware query layer and draft identity refactor | completed | code | coder | vibe-build | oauth-router/gpt-5.5 | - |
| 07 | build | Topic workspace source pane and add-material flow | completed | code | coder | vibe-build | oauth-router/gpt-5.5 | - |
| 08 | build | Question bank workspace refactor for topic-first and exam-scope flows | completed | code | coder | vibe-build | oauth-router/gpt-5.5 | - |
| 09 | build | Lesson-plan workspace refactor for topic-first planning | completed | code | coder | vibe-build | oauth-router/gpt-5.5 | - |
| 10 | build | Library repositioning, filters, and classification cleanup | completed | code | coder | vibe-build | oauth-router/gpt-5.4-mini | - |
| 11 | build | Migration pass, verification, and rollout handoff | completed | review | reviewer | vibe-build | oauth-router/gpt-5.5 | - |

## Notes

- Human-readable task docs live in this session folder.
- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.
- Sending a task back to the same agent should reuse its conversationId when continuity is helpful.
- Sessions follow the Genesis -> Design -> Build lifecycle, but each stage may stay compact or expand into more tasks.
