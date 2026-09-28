# EduClearance school transfer network and Melo integration

**Status:** Integration design agreed; not implemented in Melo.
**Existing product:** [EduClearance](https://github.com/J-StaR-Films-Studios/EduClearance), deployed independently at `educlearance.meloschool.com`.

## Goal

A school can use EduClearance without buying Melo. An eligible Melo school uses the same clearance network from a native Melo admin workflow, without a second staff login. The two entry points reach the same EduClearance cases. Keeping EduClearance's customer signup and purchase independent does not require it to share Melo's repository, authentication, or database.

A clearance request is a paid, single-student inquiry to a previous school. **No unresolved record found is not proof of clearance.** Only an explicit previous-school response or an appropriately resolved case can be described as cleared.

## Agreed product boundaries

- EduClearance remains a separate service. Its existing Next.js application, Postgres/Drizzle database, school claims, cases, evidence, disputes, Paystack wallet, and operations remain its responsibility for the initial integration. A Convex migration or monorepo move is not a prerequisite and is not approved by this design.
- All active Melo schools are automatically represented as verified schools in EduClearance, including those without the Melo feature enabled. Reuse Melo's verified school identity through a trusted provisioning and linking process. A collision with an existing EduClearance school claim requires reconciliation; names or email domains alone must not link accounts. Directory verification does not grant staff product access or imply the school is available to respond inside EduClearance.
- A platform-admin Melo feature switch grants or removes a Melo school's access to the native integration. A staff permission separately controls who can start, review, or respond to a case. Both checks happen on the server before any EduClearance operation. A disabled switch must block direct server calls, not merely hide a menu item. Suspending the school must also stop Melo-originated operations. Disabling access does not erase its verified school identity or existing cases.
- Melo staff use their Melo session and permissions within Melo. EduClearance-only customers continue to sign in to EduClearance and buy checks there. No EduClearance password or browser session is required for Melo staff.
- Checks remain metered for Melo schools at a discount to standalone checks. The exact discount, included credits if any, and where Melo users pay or see balances are open commercial decisions. Enabling the feature does not grant unlimited free checks. EduClearance owns the authoritative charge and usage record; do not debit both its wallet and a Melo ledger for one request.

## Client and server components

- **EduClearance standalone app:** Retains its own registration, school verification, case management, evidence, dispute handling, wallet, and payment screens.
- **Melo admin:** Adds an optional clearance workspace within Admin, rather than an iframe or a link requiring another login. Start with manual, staff-initiated checks and status review. Reuse the shared module registry for route visibility; add the missing backend entitlement enforcement for this module before launch.
- **Server integration:** A narrow, versioned server-to-server contract between Melo and EduClearance. Melo derives school and user identity from its authenticated session, verifies entitlement and role, and sends only the fields necessary for the operation. EduClearance authenticates the calling service, resolves the linked school, enforces its own case authorization, and returns a limited response. Browser code must not hold an integration secret or call privileged endpoints directly.
- **Account linking and provisioning:** Create or reconcile a distinct EduClearance school identity for each active Melo school. Maintain a verified, unique mapping between the two school IDs and record provisioning failures for operator review. Reuse a valid existing EduClearance organisation rather than creating a duplicate. EduClearance-only schools never need a Melo school record.

## Data flow and privacy

1. Melo provisions or links an active school's verified EduClearance identity. The Melo module can remain disabled. A conflicting claim pauses linking for review; it must not guess which school owns the account.
2. An authorized Melo staff member starts a request in Admin. Melo checks its school feature and staff permission, then calls EduClearance from the server with the linked school ID, an authenticated caller identity, an idempotency key, and the minimum student/guardian information needed for a check.
3. EduClearance creates the case and charges its own ledger atomically. A retry with the same key returns the existing case without another debit; different details with the same key are rejected. Melo stores at most the remote case ID and the minimum status needed to display it, not a second copy of the case or wallet.
4. EduClearance owns the case status and previous-school responses. Melo displays `no record found`, `possible match`, `pending`, `reported issue`, or `cleared` only when supported by the case. A possible match cannot disclose another child's debt. Network outages must not turn into a `clear` result.
5. Neither Melo withdrawal nor an unpaid Melo invoice automatically publishes a debt or creates a hold. A separate, explicitly authorized reporting flow requires a defined purpose, evidence, review, and disclosure policy before implementation. Melo's existing portable transfer record intentionally excludes debt and disciplinary notes; this integration must not alter that record by accident.

Do not add date-of-birth or disciplinary searches to this first integration by assumption. Those were in the earlier draft but are not part of EduClearance's current request and issue model. Assess their purpose, consent, and access rules as separate product changes.

## Data ownership and proposed schema changes

- **EduClearance Postgres:** Existing `schools`, `users`, `clearance_requests`, `clearance_issues`, `wallets`, `wallet_transactions`, `payments`, `disputes`, and audit records remain authoritative. Add a unique Melo-to-EduClearance school link with provenance and lifecycle state as part of integration implementation; use stable service identities and request keys for auditable calls. The exact table and API contract need their own review.
- **Melo Convex:** Keep its existing `schools.features` compatibility shape and add an optional EduClearance entitlement key through the staged module-rollout procedure in `ProductWideModuleEntitlements.md`. Store a remote school/case reference only if required for reconciliation or UI, never a duplicate EduClearance wallet or clearance-case table for the initial integration. Existing Melo billing, admissions, and transfers retain their own ownership and permission boundaries.

## Rollout and verification

1. Finish and verify EduClearance paid-request retry safety and matching/privacy corrections before opening the integration. Run a disposable-database rehearsal of any schema migration before production approval.
2. Define the service authentication, linked-school provisioning, versioned requests and responses, discount and settlement rules, and failure/reconciliation process. Confirm how an off-module verified school receives or declines incoming requests.
3. Build server-side Melo entitlement and staff authorization, then the native Admin workflow. Test disabled, suspended, conflicting-link, and cross-school requests; replay after timeout; same key with changed details; a match past 100 unresolved issues; payment failures; and `no record` versus `cleared` wording. Verify that no details of a possible match leak to an unrelated school.
4. Enable for a limited set of schools only after both services have operational monitoring, audit trails, and an agreed billing path. Do not treat an Admin save as synchronization proof without a confirmed provisioning result.

## Out of scope for the initial integration

- Moving EduClearance into this monorepo or porting its database to Convex.
- Automatically copying Melo student records, invoices, or withdrawal debts into EduClearance.
- A parent-facing search portal, disciplinary registry, debt collection, or a general third-party plugin framework.
