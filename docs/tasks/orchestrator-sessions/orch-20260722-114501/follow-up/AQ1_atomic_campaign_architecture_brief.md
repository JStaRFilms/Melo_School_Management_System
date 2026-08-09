## AQ-1 implementation brief

### Current browser mutation sequences

**Create**
1. `createProgramme`
2. `createIntake`
3. `createProduct`
4. `createDraftForm`
5. `createDeclaration`; if publishing, `publishDeclaration`
6. One `addDraftField` per non-default question (sections/defaults are not persisted)
7. `addDraftDocumentRequirement` for birth certificate, then selected passport/medical/transcript requirements
8. If publishing: `publishForm`, then `setIntakeStatus(open)`

**Edit**
1. `updateIntakeDetails`
2. If amount changed: `publishPrice`
3. `createDeclaration`; if publishing, `publishDeclaration`
4. `createDraftForm`
5. Add fields and requirements as above
6. If publishing: `retireForm` current published form, `publishForm` new form, and possibly `setIntakeStatus(open)`

Each call commits separately. Notable failure points: intake/price/declaration may already be mutated before a later invalid custom field, invalid document, or network failure. The UI offers `email` and `phone` custom kinds, but the server only permits `text|textarea|select|date|number|boolean|checkbox|multi_select`; this can currently fail after earlier writes.

### Recommended command boundary

Add exactly two public transactional mutations in `functions/admissions/settings.ts`:

1. **`createCampaignConfiguration`**
   - Creates programme, intake, one product, declaration, form, fields, and requirements in one transaction.
   - Supports `targetStatus: "draft" | "published"`.
   - New paid price creation remains rejected; AQ-2 owns evidence acquisition and paid-campaign workflow.
   - For `published`, requires `admissions.publish` before writing and atomically publishes form/declaration plus transitions programme to `published`, product to `active`, and intake to `open`.

2. **`replaceCampaignConfiguration`**
   - Targets one existing intake and receives a complete replacement configuration.
   - Creates new immutable declaration/form versions; never edits a published version’s contents or children.
   - `draft` leaves published configuration untouched.
   - `published` validates all publication conditions, creates the replacements, retires exactly one prior published form/declaration, publishes the new versions, and applies allowed metadata/status transitions in the same transaction.
   - May publish a changed existing price only with current, exact finance evidence for server-computed next product price version.

Do not compose existing public mutations with `ctx.runMutation`; extract shared private helpers and perform one transaction.

### Input and validator shapes

Use explicit Convex validators; retain JSON strings because existing storage and grammar validators use them.

```ts
const fieldInput = v.object({
  fieldKey: v.string(),
  sectionKey: v.string(),
  kind: v.union(
    v.literal("text"), v.literal("textarea"), v.literal("select"),
    v.literal("date"), v.literal("number"), v.literal("boolean"),
    v.literal("checkbox"), v.literal("multi_select"),
  ),
  label: v.string(),
  requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
  dataClass: admissionsDataClassValidator,
  purpose: v.optional(v.string()),
  retentionPolicyKey: v.optional(v.string()),
  audience: v.optional(v.string()),
  approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
  validationJson: v.string(),
  conditionalRuleJson: v.optional(v.string()),
  order: v.number(),
});

const requirementInput = v.object({
  requirementKey: v.string(),
  category: v.string(),
  label: v.string(),
  requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
  acceptedMimeTypes: v.array(v.string()),
  maxBytes: v.number(),
  maxFiles: v.number(),
  sensitivity: admissionsDataClassValidator,
  purpose: v.string(),
  retentionPolicyKey: v.optional(v.string()),
  audience: v.optional(v.string()),
  approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
  conditionJson: v.optional(v.string()),
  order: v.number(),
});

const declarationInput = v.object({
  title: v.string(),
  body: v.string(),
  purpose: v.string(),
});
```

`createCampaignConfiguration` args:
- `schoolId`, `operationKey`, `targetStatus`
- `programme: { slug, name, description? }`
- `intake: { slug, name, cycleLabel, opensAt, closesAt, targetClassId? }`
- `product: { slug, name }` (`slotCount` is server-fixed to `1`)
- `declaration`, `fields`, `requirements`

`replaceCampaignConfiguration` args:
- `schoolId`, `intakeId`, `operationKey`, `targetStatus`
- `intake: { name, cycleLabel, opensAt, closesAt, description? }`
- `declaration`, `fields`, `requirements`
- `price: { amountMinor, currency, refundPolicyKey, feeDisclosure, approvalEvidenceId? }`

Return from both:
`{ programmeId, intakeId, productId, formVersionId, declarationVersionId, priceId: Id | null, status: "draft" | "published", replayed }`.

### Pre-write validation

Perform all validation and reads before the first insert/patch:

- authenticated tenant membership and applicable catalogue/publish/sensitive capabilities;
- source programme/intake/product/class ownership and status;
- trimmed text bounds, date finiteness, `opensAt < closesAt`, and slug format;
- max 200 fields and 100 requirements;
- unique normalized field keys, unique requirement keys, unique integer non-negative orders;
- closed field kind vocabulary and `assertClosedValidationGrammar`;
- conditional rule grammar plus referenced controller key must exist in the submitted fields and have a lower order;
- requirement condition references must likewise resolve to a submitted field;
- document MIME/count/size limits already enforced by `addDraftDocumentRequirement`;
- sensitive field/requirement governance, including current evidence, same-school approver, exact subject type/key, purpose, retention, audience, and `admissions.sensitive.configure`;
- declaration title/body/purpose bounds and body digest;
- price changes compare all price fields, compute the next version server-side, then require active exact finance evidence for `${productId}:${nextVersion}`;
- reject a new campaign price entirely rather than fabricating finance evidence.

### Idempotency and replay

Add `admissionsCampaignOperations`:

- `schoolId`
- `actorUserId`
- `command: "create" | "replace"`
- `operationKey`
- `requestDigest`
- durable result IDs/status
- `createdAt`

Indexes:
- `by_school_and_actor_user_and_command_and_operation_key`
- `by_intake`

Rules:
- operation key: trimmed non-empty, maximum 128 characters;
- derive actor from membership, never client input;
- digest normalized semantic request data, not raw object ordering;
- look up operation before graph validation/writes;
- same command/key/digest returns stored result with `replayed: true`;
- same command/key but different digest throws `OPERATION_KEY_REUSED`;
- insert operation result in the same transaction as all graph rows and audit events.

### Publication immutability and legacy safety

- Published forms/declarations are append-only evidence: no content, fields, requirements, digest, publication actor, or publication timestamp mutation.
- Replacement creates new versions; retiring changes only lifecycle status.
- Require at most one currently published form for an intake and at most one published declaration for the programme; otherwise fail closed.
- Declarations are programme-scoped while forms are intake-scoped. Publishing changed declaration text when the programme has another non-archived intake is unsafe because public resolution selects the programme’s latest declaration. Reject with a clear scope-ambiguity error unless the programme has only this intake. Do not silently affect another campaign.
- Existing untracked drafts may be edited only if their bounded structural graph is complete and unambiguous (one product, usable intake/programme linkage). Missing/ambiguous graphs must fail closed rather than be “repaired” in place.

### Recovery visibility

Add `listLegacyCampaignRecovery({ schoolId })`, catalogue-manage only.

It should return bounded draft intakes lacking an atomic operation record, with:
- programme/intake IDs and names;
- created/updated timestamps;
- bounded product/form/declaration counts;
- explicit missing/ambiguous graph flags;
- `recoveryState: "review_required"`.

UI: show a non-destructive banner/list in the admissions hub or builder. Offer only existing explicit actions: review/edit a structurally complete campaign, or the existing bounded `deleteIntake` flow. Do not auto-delete, overwrite, infer an owner, or claim that every untracked draft is partial.

### UI integration

In `AdmissionsFormBuilder.tsx`:

- Replace the 12 graph-write mutation hooks with the two command hooks.
- Keep read queries and refined UI intact.
- Map cards to fields: omit default cards and section cards; sections only supply subsequent `sectionKey`.
- Map checkbox state to the existing explicit requirement objects.
- Remove unsupported custom `email` and `phone` kind options (or map them to `text`; removal is clearer).
- Preserve client validation only as UX feedback; server command is authoritative.
- Create one operation key at first submit and retain it through transport failures; clear it only after a durable success/replay response. Persist the pending key and submitted payload in session storage so a reload can retry the same command safely.
- On `OPERATION_KEY_REUSED`, stop automatic retry and require reload/reconciliation rather than submitting a changed payload under an ambiguous operation.
- Clear local browser draft only after durable command success.

### Exact focused tests

**Convex: new `packages/convex/admissionsCampaignCommands.test.ts`**
1. Valid draft create writes exactly one programme/intake/product/declaration/form and expected fields/requirements; result IDs resolve.
2. Invalid custom kind/duplicate field key/invalid conditional reference rejects with zero campaign graph rows and zero operation rows.
3. Same create operation key and payload replays exact stored IDs/status; each graph count remains one.
4. Same operation key with changed digest rejects and writes nothing.
5. Catalogue-only caller may create a draft but cannot create published configuration; publisher-only caller cannot create; cross-tenant IDs are denied.
6. Sensitive field and medical requirement reject stale/wrong-subject/no-capability evidence before writes.
7. Paid new-campaign input is rejected without creating a price or fabricated evidence.
8. Replacement creates new form/declaration versions, retires only prior lifecycle rows, preserves old body/bodyDigest/field/requirement values, and leaves exactly one published form.
9. Changed price requires exact next-version finance approval and replay creates only one price.
10. Multi-intake declaration replacement rejects scope ambiguity without writes.
11. Legacy recovery projection identifies incomplete/untracked drafts; replacement refuses ambiguous partial graphs and does not delete them.

**Admin**
- Add a focused command-payload test covering default-card omission, selected requirements, supported-kind mapping, target status, and operation-key reuse after a simulated rejected promise.
- Add a focused component test asserting one command invocation per save action, rather than individual graph mutations.

### Deployment and migration risks

- Schema deployment adds a table/index only; no production mutation or backfill is needed.
- Run normal Convex codegen after schema/function changes; do not hand-edit generated files.
- Existing browser-created drafts will have no operation record; visibility must not treat absence as proof of ownership or safe deletion.
- Current public offering resolution requires a published active product **and** a current published price. AQ-1 must not invent a zero-price/finance-evidence policy; free/paid availability behavior requires AQ-2 policy review.
- Existing declaration scoping is programme-wide; fail closed for multi-intake declaration publication until a separately scoped model is approved.
- Existing browser sequence does not promote programme/product statuses on publish; the atomic publish branch should do so transactionally, but price/provider availability remains independently fail-closed.

**Builder should read first:** `packages/convex/functions/admissions/settings.ts`, then `packages/convex/schema.ts`, then `AdmissionsFormBuilder.tsx`.