# B6 integration request — admissions admin B1 gaps

B3 intentionally consumes only frozen B0/B1 APIs and does not add client-side authorization or workflow substitutes.

## Conversion recovery (required)

`conversions.executeAcceptedConversion` currently returns only terminal `{ conversionId, studentId, state, replayed }`. To render D1's truthful recovery state, B6 should add a scoped read projection for the application conversion ledger containing: conversion state (`requested|running|succeeded|failed_retryable|failed_terminal`), lease/worker ownership where safe, last attempt time/outcome, retry eligibility, resolution category, and entitled canonical IDs/onboarding status. The execute API must continue to reuse one ledger/application and must never create a second conversion on refresh or retry.

## Other B1 contract gaps surfaced by B3

The frozen B1 implementation has no tenant-scoped APIs for catalogue/settings draft reads/writes, form field/document requirement/declaration versioning, publish/rollback, intake discovery, document metadata listing, assignment, assessment/interview capture, or redacted audit timeline. B6 should expose bounded, capability- and programme/intake-scoped projections/mutations for these D1/D3 contracts. Do not expose storage IDs, raw document URLs, sensitive answers, or tenant-existence oracles.
