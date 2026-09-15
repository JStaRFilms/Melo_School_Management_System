---
name: tailscale-app-serve
description: Use when the user asks to expose, save, serve, open, or test one or more Melo apps through Tailscale, wants remote access to local apps without Vercel Preview builds, or names `tailscale-app-serve`. Builds production applications by default and uses a dev server only when the user explicitly requests one.
---

# Tailscale app serve

Treat "expose this app on Tailscale" as a production-mode local handoff. Configure origins before building, keep any existing production server alive while working, build the affected app, then expose or verify its built server through tailnet-only HTTPS.

## Melo port map

| App | Package | Local port | Tailscale HTTPS port | Smoke route |
|---|---|---:|---:|---|
| Website | `@school/www` | 3000 | 3400 | `/` |
| Teacher | `@school/teacher` | 3001 | 3401 | `/` |
| Admin | `@school/admin` | 3002 | 3402 | `/admin/admissions` |
| Portal | `@school/portal` | 3003 | 3403 | `/` |
| Apply | `@school/apply` | 3004 | 3404 | `/s/meridian-crest-academy` |
| School Sites | `@school/sites` | 3005 | 3405 | `/` or a published site slug |
| Platform | `@school/platform` | 3006 | 3406 | `/schools` |

Derive the current tailnet DNS name from `tailscale status --json`. Do not hard-code a machine name.

## Run the workflow

1. Confirm the intended worktree and requested apps. Read its `AGENTS.md`, `package.json`, app package scripts, `.env.example`, and existing non-secret origin settings.
2. Inspect `tailscale status --json` and `tailscale serve status --json`. Preserve every existing Serve route.
3. Treat Tailscale Serve changes, local origin changes, and Convex environment changes as separate mutations. Get explicit authorization before the first change. Confirm the development Convex target before changing its environment.
4. Use production servers unless the user explicitly says "run a dev server". If a dev server occupies a requested port, replace it with a production server before editing. Build a baseline first only when no usable production build exists.
5. Keep the existing `pnpm start` production server running throughout editing, testing, and building. It continues serving the last completed build while the next build is prepared.
6. Configure build-time origins, then build the requested or modified apps.
7. Configure one tailnet-only HTTPS proxy per requested app:

```sh
tailscale serve --bg --https=<tailscale-port> http://127.0.0.1:<local-port>
```

8. Make server activation the final work step. Stop and restart the affected production server set from the intended worktree so it serves the new build. Restart all apps for an all-app or tightly coupled multi-app change. Restart only the affected package processes for isolated work when they are independently managed. If one root process owns the affected apps, restart that root process.
9. Verify the restarted server through its local port and Tailscale URL. Do not reply while an old build is still running or a requested app is unavailable.

## Build rules

For every requested or modified app, run:

```sh
pnpm --filter <package> build
```

Run `pnpm build` when the user requests all seven apps or explicitly requests a full build. Run affected typechecks and focused tests before the build when code changed.

Inspect the current root scripts before choosing a restart command. Use the root start when it covers the requested app set. Use package-specific starts when only one or two independently managed apps changed, or when the root script does not yet include a requested app:

```sh
pnpm --filter <package> start
```

A successful build does not update an already running production server. The agent must perform the final restart and verify the new build before handoff unless the user explicitly reserves server control.

## Convex development process

`pnpm convex:dev` is a backend deployment watcher, not an application server and not a Tailscale target. Hosted development Convex continues serving the apps after the watcher exits.

Leave the watcher off by default so partial backend edits are not deployed while work is in progress. For an authorized backend change:

1. Confirm the exact development deployment.
2. Finish backend tests and typechecks.
3. Run `pnpm exec convex dev --once` near final activation.
4. Use persistent `pnpm convex:dev` only when the user explicitly requests live backend watching.

A Tailscale request alone does not authorize a Convex function deployment.

## Origin and callback contract

Build the Tailscale origin as `https://<tailnet-dns-name>:<tailscale-port>`.

For authenticated apps:

- Set the local `SITE_URL` to that app's Tailscale origin.
- Keep localhost origins and add the exact Tailscale origins to `TRUSTED_ORIGINS`.
- Set Admin's `NEXT_PUBLIC_APPLY_ORIGIN` to the Tailscale Apply origin when Admin must generate remote Apply links.
- Keep the canonical Convex `APPLICATION_ORIGIN` unchanged unless the user explicitly changes that policy. Apply passes its calling origin for payment returns.
- Merge requested Tailscale origins into development Convex `TRUSTED_ORIGINS`; preserve every existing value. Never copy this change to Production without separate authorization.
- Rebuild after changing any `NEXT_PUBLIC_*` value.

The repository maps Tailscale workspace switching for Admin, Teacher, and Portal to ports 3402, 3401, and 3403 on the same `.ts.net` host. Run its focused workspace-navigation test when touching that mapping.

## Safety

Use Tailscale Serve. Keep Funnel disabled unless the user explicitly requests public internet access and approves that exposure.

Tailscale work does not authorize:

- Vercel Preview or Production builds
- Git pushes or merges
- Convex function deployment
- Production origin changes
- application data mutation
- replacing unrelated Serve routes

Never print credentials or complete environment files. Read and update only named origin variables.

## Verification

Complete all checks that apply:

1. The production build exits successfully for every requested app.
2. `tailscale serve status --json` maps each HTTPS port to the expected localhost port.
3. Each smoke route returns its expected status through the `.ts.net` URL.
4. Authenticated apps return a valid response from `/api/auth/get-session` on their Tailscale origin.
5. Admin-generated Apply links use the Tailscale Apply origin.
6. Development Convex contains every exact Tailscale origin needed by Better Auth and payment return validation.
7. Workspace switches stay on the same `.ts.net` hostname and select the correct app port.
8. Funnel remains off and existing Serve routes remain present.

A 404 from School Sites can be valid when no static site is published. Prove the proxy reached the app before classifying it as a Tailscale failure.

Do not promise callback correctness from configuration checks alone. For final callback proof, run or request one authenticated Tailscale sign-in, one verification-link return when relevant, and one non-production payment return. These checks may send email or create test records, so obtain authorization first.

## Handoff

Always include clickable Markdown links for every requested or exposed app. Link directly to the route the user needs, not merely the app root when a useful route is known. Put the links near the top of the handoff so the user never has to remember hostnames or ports.

Report:

- clickable Tailscale links for every requested or exposed app
- builds, tests, and route checks
- which production servers were restarted and their current process state
- proof that the restarted servers expose the new build
- whether auth, verification, and payment callbacks were exercised or only configured
- any app-level 404 or missing published data
- confirmation that no Vercel build, Funnel, Production change, push, or merge occurred
