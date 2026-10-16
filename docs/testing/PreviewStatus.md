# Preview status and open work

This is the public status note for Melo's Preview environment, updated on 2026-10-15. The browser checks below were recorded on 2026-10-14. It omits account details, deployment identifiers, private backup locations and credential values. Read the [testing and branch workflow](PreviewWorkflow.md) before merging or testing.

## What has been checked

- Preview has protected web hosts and a separate backend. Selected unauthenticated endpoints rejected access. Website SSO does not protect the backend by itself.
- Reviewed Admin, Parent Portal and Platform accounts opened their landing pages in real browsers. Those checks do not prove every role or feature works.
- A narrow Platform identity repair is internal to the backend. The source reconciliation carries it to both branches without running the repair or deploying backend code. Key rotation remains internal in both branches.
- The last source-only pushes used `[skip vercel]`. GitHub reported the seven linked Vercel evaluations skipped and canceled. These pushes did not create new frontend builds or deploy backend code.

## Work still open

- [Finish Preview reconciliation](https://github.com/JStaRFilms/Melo_School_Management_System/issues/111). Matching Git refs alone do not update Preview's frontend or backend or prove that the newer schema and features work with copied data. Check current branch heads before targeting a PR.
- [Fix Platform operator bootstrap](https://github.com/JStaRFilms/Melo_School_Management_System/issues/112) for future accounts. The existing account-specific repair did not change bootstrap.
- [Make provider tests safe](https://github.com/JStaRFilms/Melo_School_Management_System/issues/113) before email, AI, payments, admissions writes, uploads or Sites-provider actions against Preview records.
- [Complete role and route acceptance](https://github.com/JStaRFilms/Melo_School_Management_System/issues/114). Landing pages, a successful build and a simulated backend identity are not full browser proof.
- [Put private configuration and backups under durable ownership](https://github.com/JStaRFilms/Melo_School_Management_System/issues/115) before removing the long-lived Preview worktree.

A teammate can review a feature PR before it lands, but Git-triggered application builds are restricted to eligible `master` and `preview` commits. After a reviewed feature reaches `preview`, the linked frontend projects can build and the owner can test the protected Preview URLs. One isolated Sites project is not Git-linked. A Vercel build does not update Convex functions or schema; backend changes need their own exact-target, approved deployment and data-compatibility check. A later release PR to `master` must include only the reviewed changes, not whatever happens to be on Preview.
