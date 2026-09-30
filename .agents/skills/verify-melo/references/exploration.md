# Exploratory feature modules

Use the owned runner for agent-authored feature checks. It supplies a real, separately authenticated synthetic role session, captures evidence after authentication, and holds the backend lease. Scripts are trusted code with Node/filesystem access, not a security sandbox.

## Start with the working example

From the project root:

```sh
cp scripts/qa/explore-example.mjs .qa/feature-check.mjs
pnpm qa:explore --role parent --script .qa/feature-check.mjs
```

The [working module](../../../../scripts/qa/explore-example.mjs) proves Parent learning search matching and clear behavior. Adapt its scope and assertions to the actual task before calling another feature verified. The module path must resolve to a regular `.mjs` file inside this worktree; sibling paths and outside symlinks are refused. Its digest is checked before execution.

## Contract

Export:

- `scope`: a concrete user-facing behavior description, including limits.
- `effects`: `read-only` or `synthetic-writes`. Read-only excludes intentional school-record changes, not the normal sign-in sessions.
- `steps`: 1-30 uniquely named objects with an async `run` callback.

Each callback receives `page`, `expect`, `capture`, `role`, and `origin`. `page` has the selected app's base URL and a 30-second default timeout. Use accessible roles/names from the current DOM. `capture('after-save')` saves a role-prefixed PNG; screenshot names must be unique, lowercase, and URL-safe.

Every step should assert a concrete acceptance result. For a write, capture the action, reload/reopen through the UI, and assert the stored value. Include validation, cancellation, errors, role restrictions, and mobile/keyboard behavior relevant to the task. Add separate steps for alternate entry points listed in the feature map.

Declared synthetic writes also require the CLI flag:

```sh
pnpm qa:explore --role admin --script .qa/feature-check.mjs --allow-synthetic-writes
```

This declaration is a cooperative scope guard, not proof that arbitrary script code is harmless. Review the module before running it. The browser request guard permits owned app origins, the isolated Convex hosts, and read-only Google font CSS/files; it does not grant permission to invoke every backend action. Confirm provider sandbox mode, recipients, and budget before external-provider behavior. The initial module contract does not support a separate external-provider effect class.

## Outcomes and evidence

A failed criterion blocks later steps; other built-in role journeys can continue in their own contexts. Empty or malformed modules are blocked, not passed. Runner time limits and interruption are blocked, and an ambiguous write needs a fresh read before retrying.

Use `qa:report` to inspect scope, checkout revision, dirty-source flag, and each criterion. Backend revision remains unverified by the ordinary preflight. Raw failures, traces, videos, and session/network data stay private; publication copies only reviewed HTML/PNG evidence. Keep evidence through `qa:stop`.
