# School Sites restoration review

## Scope and verdict

Takomi GPT-6.1 Sol reviewed the staged/working restoration against `eb30018`, with overall PR base `d2ba632a09776e43684a99b4739885974790e094` and approved source `c03047629d09e206113ecb6a2ffd01ca3384a784`.

Verdict: **REVIEW CLEAR**. No correctness, security, contract or scope findings. All 36 restored paths and relevant surrounding callers/contracts were inspected, with no restoration-path coverage gap. No implementation correction was required.

## Verified behavior and source boundaries

- Transaction-local validated-asset reuse remains intact, along with tenant, checksum, reviewer independence, rights, classification, child consent and lifetime gates.
- Admin/Platform controls, private logo copy, optional favicon, published icon metadata and required image-alt fields agree with backend/shared contracts.
- Persistent domain adoption requires exact-host confirmation, valid legacy proof and fresh readiness. Rotation, provider locks and fail-closed serving remain intact.
- Schema, grant provenance and generated API declarations support the restored callers.
- The optimization fixture returns to the approved contract, rather than weakening assertions to hide a failure.
- All 36 restored paths match approved source in both index and worktree. The entire `apps` and `packages` trees also match that source.
- Academic optimizations and Admin consumers are unchanged from `eb30018`.
- Marketing and launch artifacts have no tracked delta. Private launch files remain untracked, and their original ancestor is not reachable from the release branch. The only staged binary change is the intended static icon deletion.
- Staged and working whitespace checks pass.

## Prior review history

The OpenCode S3 attempt was interrupted after the owner reported quota exhaustion. It produced no final verdict and is not a pass. Its sole unresolved observation concerned rejecting another live operator package versus one document sentence about overlapping grants. Sol dismissed this as a confirmed defect because the documented duplicate/extension denial supports the stricter behavior. No permission widening or speculative correction was made. No BR finding ID was finalized.

Original R1 remains clear. R2/R3 remain incomplete historical attempts. This scoped restoration review does not claim a fresh independent review of unrelated old academic-test sections.

## Evidence and limitations

The reviewer inspected existing logs and ran no tests, operator scripts or remote operations. Parent evidence records 94 passing focused tests, all five typechecks and all three affected frontend builds. The Windows browser bridge still times out, including its pre-restoration baseline. Isolated-backend browser QA is blocked by the missing private profile. Neither is reported as passed or as a demonstrated restoration regression. The verdict establishes scoped code-review clearance, not full browser acceptance or release readiness.

## Execution records

Interrupted OpenCode attempt:
`node:delegated-task:command%3Amcp%3A925029ef-e78b-40b9-adaa-f5b2a958694c%3Adelegate-task%3Amelo-sites-S3-deepseek-review-20261023-r1`

Completed Takomi Sol review:
`node:delegated-task:command%3Amcp%3Ae309fb96-ca86-4ab7-94d4-6ef287c8aba2%3Adelegate-task%3Amelo-sites-S3-sol-review-20261024-r2`
