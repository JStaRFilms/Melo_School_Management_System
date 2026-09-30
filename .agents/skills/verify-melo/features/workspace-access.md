# Workspace access

Unsigned visitors reach sign-in, while the Teacher cannot open Admin template editing with the Teacher's real session.

## Sub-features

- `unsigned-route`: Admin templates redirect to sign-in before editable data is shown.
- `teacher-admin-denial`: the Teacher's session sees the authoritative forbidden view on the Admin template route.
- `hidden-editing`: template creation/title controls are absent from that forbidden view.
- Backend endpoint authorization, cross-tenant isolation, branch switching, suspension, and other roles need separate security criteria; a hidden control is not endpoint protection proof.

## How to get to it (user POV)

- Open `/academic/knowledge/templates` on the Admin host in a new unsigned context.
- Sign in on the Teacher host, then visit that Admin route with the same role session.

## Driving it with qa

Preconditions: both Admin and Teacher are owned QA servers and use the same verified isolated backend. Use separate contexts for different accounts.

Run `pnpm qa:smoke` for unsigned Admin redirect/sign-in. Run `pnpm qa:roles --roles teacher` for the role-denial branch. Expect the `403 Forbidden` / `Access Denied` heading and no New Template or editable Title control. Review the Teacher admin-denied screenshot.

For authorization changes, add a feature module or the project's backend tests that call the relevant protected endpoint with the wrong authenticated role and cross-school fixture. Report that coverage separately from this UI denial recipe. Establish the second tenant fixture through an approved isolated plan rather than bypassing the existing cohort inspector.

## Gotchas

- Cookies on localhost are shared across ports within one browser context. Creating a new page is not a new identity boundary; create a new context for another account.
- A browser-origin guard restricts browser requests, not arbitrary Node code or every server-side provider action.
- A denial view caused by broken fixture membership is not proof of the intended capability rule. Confirm the same account's allowed Teacher workflow first.
