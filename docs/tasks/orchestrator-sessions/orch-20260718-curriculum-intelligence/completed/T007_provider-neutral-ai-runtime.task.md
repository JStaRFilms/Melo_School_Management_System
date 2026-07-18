# T007 - Provider neutral AI runtime

## Objective

Implement a small AI runtime and schema-validated curriculum extraction contracts with deterministic mock mode and OpenRouter as the only network provider.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Define a typed runtime contract returning actual provider, model ID, and model handle.
- [x] Support deterministic `mock` and pinned `openrouter` modes without changing OCR configuration.
- [x] Add schema-validated curriculum extraction contracts and a deterministic mock fixture path.
- [x] Preserve existing document-generation behavior and environment overrides.
- [x] Add focused tests for routing, production mock protection, and runtime metadata.
- [x] Keep modules focused and below the project's 200-line guideline.
- [x] Record verification commands and results in this task file.

## Notes

Own `packages/ai` only. Do not add a direct OpenAI SDK or modify the root lockfile. The exact GPT/OpenRouter model is selected through `SCHOOL_AI_CURRICULUM_MODEL`. Do not edit teacher routes, Convex files, or app packages in this batch. Use `apply_patch` for edits. Do not call paid model APIs.

## Update 2026-07-18T01:11:49

Delegated to a balanced-tier implementer.

## Outcome 2026-07-18

- Added `runtime.ts`: isolated curriculum routing with `mock` and OpenRouter modes. The production default is the pinned `openai/gpt-5-mini` OpenRouter model; `SCHOOL_AI_CURRICULUM_MODEL` overrides the model ID while runtime metadata continues to record OpenRouter as the actual provider.
- Added `curriculum.ts`: page-aware Zod contracts and a deterministic mock extraction fixture. The fixture validates input and output but never invokes a provider.
- Preserved the existing document-generation provider/model implementation and OCR configuration. No direct OpenAI SDK or root lockfile change was added.
- Added Node's built-in test runner for three focused checks: mock metadata and fixture evidence, configured OpenRouter/GPT routing without a provider request, and production mock blocking.

## Verification

- `pnpm --filter @school/ai test` — PASS (3 tests)
- `pnpm --filter @school/ai typecheck` — PASS
- `pnpm --filter @school/ai lint` — PASS

## Update 2026-07-18T01:21:27

OpenRouter-only runtime completed with deterministic mock mode, configurable curriculum model ID, schema contract, and passing focused tests/typecheck/lint. Direct OpenAI dependency removed.
