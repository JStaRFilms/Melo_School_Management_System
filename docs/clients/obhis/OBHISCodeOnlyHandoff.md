# OBHIS code-only handoff

## What this branch contains

`feature/obhis-website-code` is a clean source export for the public Melo repository. Its first snapshot copies the verified local renderer, private gate, exact-key asset handler, tests, prototype source and documentation from local checkpoint `2656065`. It starts from the existing public `origin/master`, not from the private-review commit history.

All 55 image entries from the local feature changes were omitted. There are no new photos, generated image files, screenshots, GIFs or SVG image files in the export. Untracked Blender work and uncommitted design refinements were not included. This does not remove any files already present in the public master branch.

The full image-bearing `feature/obhis-website` branch remains local. Do not push or merge that original history into the public repository while the photo permissions remain pending. Removing images in a later commit does not remove earlier image blobs from history.

## For the production-core agent

Fetch `origin/feature/obhis-website-code` and inspect this branch read-only while implementing production infrastructure on your separate branch. Use paths relative to your checkout. The absolute Windows paths in the earlier task prompt refer to the original development computer.

The current integration points are:
- `apps/sites/core/private-review.ts`, the typed private fixture contract and development-only gate.
- `apps/sites/core/renderer-registry.ts`, exact local renderer matching.
- `apps/sites/renderers/obhis-v1/`, React composition and lifecycle-owned interactions.
- `apps/sites/app/review/obhis/`, the gated developer page and asset endpoint.
- `docs/features/OBHISLocalHomepageReview.md`, scope and local verification history.

This is a private local renderer, not a production published-content adapter. Keep production context separate from `PrivateReviewContext`. Do not activate the developer page publicly, import its fixture as approved content or migrate the fabricated legacy `obhisSchool` record into authoritative data.

## Assets and checks

The guarded endpoint still refers to private review files in the original docs directories. Those image files are intentionally absent here. The visual preview and tests that read those images need a separately authorized local asset package. Do not fetch pupil photographs, put substitutes in `public`, or loosen the development/production gate to make those tests pass.

The recorded browser/build verification was performed in the full local worktree, with the private assets available. It is not a claim that the image-dependent suite passes in this stripped export. Report missing-asset checks honestly as not run until the required local fixtures are supplied.

School facts, photographer rights, child-publication permissions and public deployment remain separate approvals. No DNS change, deployment or public school-site activation accompanies this source push.
