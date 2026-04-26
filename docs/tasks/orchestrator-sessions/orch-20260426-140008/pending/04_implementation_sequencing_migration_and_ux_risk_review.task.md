# Task: Implementation sequencing, migration, and UX risk review
**Task ID:** 04
**Stage:** design
**Status:** pending
**Role:** review
**Preferred Agent:** reviewer
**Conversation ID:** reviewer-04
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260426-140008

Task title: Implementation sequencing, migration, and UX risk review
## Objective
Turn the redesign into a safe implementation sequence with migration and regression guardrails.
## Scope
- Break implementation into safe slices that avoid breaking the existing teacher library and portal topic flows
- Identify migration needs for existing broad planning sources and saved drafts
- Call out risky overlap between lesson-plan, question-bank, library, and topic-governance surfaces
- Define QA scenarios for topic-first authoring, exam-scope authoring, adding sources mid-workflow, and resume-after-refresh
## Checklist
- No checklist yet.
## Definition of Done
- Build order is justified and dependency-aware
- Known regressions to guard against are documented
- QA checklist exists for the new flow
## Expected Artifacts
- Migration notes
- Risk register
- QA and rollout checklist
## Dependencies
- None specified.
## Review Checkpoint
Approve sequencing before Build stage execution.
## Instructions
- Favor sequential implementation where file overlap is high.
- Assume the existing closed session remains the baseline and this session layers a v2 workflow on top of it.