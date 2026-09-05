# S0 — Pause expansion and stabilize

User revised priority: no new feature expansion until recoverable checkpoint, reconciled staged/unstaged/untracked work, manual authorization review and coherent U1–U6 commits/PR boundaries. Never label partial packets complete.

## Checkpoint
External recoverable checkpoint: C:/Users/johno/.melo-ops/checkpoints/productization-20260905-121553. Verified Git history bundle, staged and unstaged binary patches, current/untracked file archive, original index snapshot and status, manifest and recovery instructions. Checkpoint HEAD 44086fa005db6adaf161ef2ddb070bc8a8a14d6c includes a separately authored architecture-doc commit after the original base; preserve it and do not attribute it to this program. Original starting base remains f6fc7c4817eb287daeebf78a4d143ef1a988844f.

## Reconciliation observed
Index: 319 changed paths. Status M=142, A=159, AD=13, AM=3, MM=2, untracked=2. Twelve one-off r1 scripts were staged but already deleted from working tree; archived exact staged contents outside repo for forensic review. Parent read all twelve scripts completely. Their broad string substitutions are not semantic evidence of correct authorization.

## Review required
Manually inspect actual generated endpoint bodies, helper boundaries, role/assignment conditions, actions->internal handlers, storage/export paths and tests. Especially r1-capability-adoption.mjs: nearest preceding export regex can misclassify helper calls; fallback module-wide capability does not prove operation semantics. Check teacher read/write parity and report mutation permission (preview vs adjustment/publication); broad selector capability OR sets must expose no sensitive data. No new codemod is authorized.

## Safe work
Document actual complete/partial packet status, establish a file/hunk-aware U1–U6 commit and PR split respecting shared contract dependencies. Final artifact/review commits separate. Preserve all unrelated staged changes and the independent architecture commit. No reset, discard, stash/pop or mass restaging without reviewing exact files. No production, deployment, providers or credentials.

## Resume gate
Authorization review findings fixed and tested, one-off scripts removed from index, checkpoint recoverability proved, commit/PR boundaries established and index cleanly reconciled. Then resume remaining scoped features, full checks and U7 actual browser screenshots/report.
