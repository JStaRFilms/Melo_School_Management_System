# Melo Realistic School Setup Test Book

**Purpose:** Manually test Melo as if you were onboarding and operating a real school.

**Environment:** Development only. The development Convex database currently mirrors the production snapshot. Never run these tests against production.

## Before You Start

1. Start the applications from the repository root:

   ```bash
   pnpm dev
   ```

2. Confirm these local URLs open:

   | Application | Local URL | Primary tester |
   |---|---|---|
   | Public website | `http://localhost:3000` | Visitor |
   | Teacher | `http://localhost:3001` | Main teacher |
   | Admin | `http://localhost:3002` | Main admin |
   | Parent/student portal | `http://localhost:3003` | Portal user |
   | School website | `http://localhost:3005` | Visitor |
   | Platform administration | `http://localhost:3006` | Platform admin |

3. Credentials are stored locally in `tmp/demo_school_credentials.md`. Use the **main admin** for the Admin app and the **main teacher** for the Teacher app. Do not paste passwords into screenshots, issue reports, commits, or chat.
4. Open a private/incognito browser for each persona so sessions do not overwrite one another.
5. Record the school, active academic session, active term, and starting counts for students, teachers, classes, and subjects.

### Remote access over Tailscale

The configured admin, teacher, portal, platform, and public-web development scripts bind to `0.0.0.0`. On the current machine, replace `localhost` with `100.84.230.66`, for example:

- Admin: `http://100.84.230.66:3002`
- Teacher: `http://100.84.230.66:3001`
- Portal: `http://100.84.230.66:3003`

Binding to `0.0.0.0` may also expose the server to the local network depending on Windows Firewall and network settings. It does not make the server Tailscale-only. The Sites app may require an explicit `0.0.0.0` host override before it is remotely reachable.

---

# Test Journey A — Platform Operator Creates a School

Use this only if your account has Platform Administration access. Otherwise begin with Journey B using the existing school.

## A1. Review existing schools

1. Sign in at `http://localhost:3006/sign-in`.
2. Open `/schools`.
3. Confirm the list loads without exposing credentials or payment secrets.
4. Open an existing school's actions and verify **Assign Admin** and **Migration** are clearly separate operations.

**Expected:** Only authorized platform administrators can enter. School rows are distinct and actions identify their target school.

## A2. Create a test school

1. Select **Create school** or open `/schools/create`.
2. Enter a clearly disposable name such as `QA School — <today's date>`.
3. Use non-production contact details.
4. Review all values before submitting.
5. Submit once, then verify the new school appears in `/schools`.

**Try deliberately:**

- Submit with required fields missing.
- Double-click submit.
- Navigate back with unsaved edits.
- Try a duplicate school name if the form permits it.

**Expected:** Validation is clear, duplicate submission does not create duplicate schools, and failures preserve useful form data.

## A3. Assign the initial administrator

1. From `/schools`, select the QA school.
2. Open `/schools/<schoolId>/assign-admin` through the provided action.
3. Assign only a disposable QA identity—never replace the real main administrator.
4. Confirm the selected school name before submitting.
5. Sign out and verify the assigned administrator can enter the correct school only.

**Expected:** Assignment is scoped to the selected school and does not grant platform-level access.

---

# Test Journey B — Administrator Sets Up the School

Sign in at `http://localhost:3002/sign-in` with the main admin credentials.

## B1. Dashboard and identity boundary

1. Confirm sign-in lands on `/admin/dashboard`.
2. Verify the displayed school is correct.
3. Refresh the page and open it in another tab.
4. Attempt to open a copied URL from a different school, if you have a safe known test URL.

**Expected:** The session persists, the active school remains clear, and unauthorized school data is denied rather than silently shown.

## B2. School settings

1. Open `/admin/settings`.
2. Review school identity, branding, and configuration sections.
3. Change one harmless value, such as a QA-only display field or color.
4. Save, reload, and verify persistence.
5. Restore the original value.

**Expected:** Save state is visible; reload shows the saved value; validation errors explain what to fix.

**Do not test yet:** Provider credentials, real bank details, live payment routing, or production email provisioning.

## B3. Academic session and term

1. Open `/academic/sessions`.
2. Identify the current session and terms.
3. If the UI supports creation, add a future QA session rather than modifying historical sessions.
4. Verify term dates and ordering.
5. Try overlapping or invalid dates.

**Expected:** Invalid dates are blocked, active/current states are unambiguous, and historical data is not silently reassigned.

## B4. Classes

1. Open `/academic/classes`.
2. Record the existing class count.
3. Create a disposable class such as `QA Class <timestamp>` if creation is available.
4. Edit its name or metadata.
5. Reload and search for it.
6. Archive it rather than permanently deleting it when lifecycle controls are available.

**Expected:** Creation is school-scoped, duplicate names receive clear treatment, and archival does not erase historical references.

## B5. Subjects

1. Open `/academic/subjects`.
2. Inspect existing subjects before adding anything.
3. Add a disposable subject if supported.
4. Associate it with the QA class if the flow permits.
5. Try creating the same subject twice.

**Expected:** Subject identity and class assignment are clear; duplicate handling is deterministic.

## B6. Teachers

1. Open `/academic/teachers`.
2. Find the main teacher used later in Journey D.
3. Verify the teacher's assigned classes/subjects match what the Teacher app displays.
4. Make only reversible assignment changes.
5. Confirm the teacher cannot gain administrative authority merely from a title or assignment.

**Expected:** Teaching assignments and administrative permissions remain separate.

## B7. Student onboarding

1. Open `/academic/students/onboarding`.
2. Start a new disposable student record.
3. Test required-field validation before completing it.
4. Enter a unique QA admission identifier only if the system requests one.
5. Assign the student to the QA class.
6. Submit once and verify the student appears at `/academic/students`.
7. Reload and search by name/admission identifier.

**Try deliberately:**

- Duplicate admission identifier.
- Missing guardian/contact information.
- Navigate away with unsaved changes.
- Submit twice.

**Expected:** No duplicate student is created, validation is deterministic, and an abandoned form does not consume a final admission number.

## B8. Student import review

1. Open `/academic/students/import` or `/students/import`.
2. Use a tiny de-identified QA file—never upload a production export.
3. Include one valid row, one duplicate, and one malformed row.
4. Review proposed mappings and confidence/error information.
5. Confirm uncertain or invalid rows cannot be committed silently.
6. Approve only the valid QA row.
7. Retry the commit once to check idempotency.

**Expected:** AI-assisted interpretation never writes directly; human approval and deterministic validation precede commit; retry does not duplicate records.

## B9. Grading bands

1. Open `/assessments/setup/grading-bands`.
2. Record the existing approved bands before editing.
3. Verify ranges have no gaps or overlaps.
4. Change one QA-safe color if the UI exposes color configuration.
5. Save and inspect score-entry/report-card previews.
6. Restore the original configuration.

**Expected:** Grade meaning remains readable without color, ranges are validated, and the standard preset is not duplicated.

## B10. Exam recording setup

1. Open `/assessments/setup/exam-recording`.
2. Review assessment components and weights.
3. Try a total below and above 100%.
4. Save only a valid QA configuration.

**Expected:** Invalid totals are rejected and valid configuration is visible to the Teacher app.

## B11. Enter and inspect results

1. Open `/assessments/results/entry`.
2. Select the QA class, subject, session, and term.
3. Enter distinctive QA scores for the disposable student.
4. Save and reload.
5. Open `/assessments/report-cards` and locate the student.
6. Inspect print preview and verify the grade/score remains understandable in grayscale.

**Expected:** Scores persist in the selected academic context only; report output matches grading configuration and does not mutate historical issued records.

## B12. Report-card extras and adjustments

1. Open `/assessments/report-card-extras`.
2. Enter a reversible QA remark or extra value.
3. Open `/assessments/report-cards/manual-adjustments` if authorized.
4. Confirm any manual adjustment requires a reason and is visibly distinguishable from calculated results.

**Expected:** Manual changes are attributable and do not silently overwrite calculated history.

## B13. Billing

1. Open `/billing`.
2. Review existing plans and invoices without exposing payment-provider secrets.
3. Create a QA fee plan only if it can be clearly isolated and reversed.
4. Assign it to the QA student/class.
5. Inspect generated invoice details.
6. Confirm receipts do not display unpaid transfer instructions by default.

**Expected:** Financial values remain school-scoped, issued document values remain stable after later settings changes, and no live Paystack payment is triggered.

## B14. Archived records

1. Open `/academic/archived-records`.
2. Verify archived entities remain distinct from active records.
3. If restore is available, restore one disposable QA item and confirm it returns to the correct school/context.

**Expected:** Archive and restoration preserve history and tenant ownership.

---

# Test Journey C — Permission and Security Checks

Use the main admin and main teacher in separate private browser sessions.

1. While signed in as the teacher, paste an Admin URL such as `/admin/settings` into the Teacher app or attempt the equivalent Admin URL at port 3002.
2. Try opening billing and manual-adjustment pages without the necessary role.
3. Sign out, then revisit previously authenticated URLs.
4. Use the browser Back button after sign-out.
5. If multiple schools are available, attempt to reuse a URL containing another school's identifier.

**Expected:** Backend access is denied, not merely hidden from navigation. Sensitive data must not flash before redirect. Direct URLs should show an understandable denial or sign-in state—not unrelated data or a misleading success screen.

---

# Test Journey D — Teacher Performs Daily Work

Sign in at `http://localhost:3001/sign-in` with the main teacher credentials.

## D1. Teacher scope

1. Confirm the app opens `/assessments/exams/entry` or the appropriate teacher workspace.
2. Record the classes and subjects shown.
3. Compare them with the assignments reviewed in Admin Journey B6.

**Expected:** Only explicitly assigned classes/subjects appear.

## D2. Exam entry

1. Open `/assessments/exams` and `/assessments/exams/entry`.
2. Select the same class, subject, session, and term used in B11.
3. Find the disposable QA student.
4. Enter or adjust a reversible score.
5. Save, reload, and check from the Admin results page.
6. Try entering values outside allowed ranges.

**Expected:** Valid scores persist; invalid values are blocked; teacher scope is enforced by the backend.

## D3. Report cards

1. Open `/assessments/report-cards`.
2. Confirm only authorized students/classes are available.
3. Open `/assessments/report-card-workbench`.
4. Add a disposable comment if permitted.
5. Verify it appears in the Admin report-card view.

**Expected:** Teacher edits are attributable and cannot affect an unassigned class.

## D4. Subject enrollment

1. Open `/enrollment/subjects`.
2. Review the QA student's subject selection.
3. Make one reversible selection change if authorized.
4. Confirm the change appears in relevant assessment entry screens.

**Expected:** Subject eligibility and teacher authority are validated.

## D5. Planning workspace

Test these routes:

- `/planning`
- `/planning/lesson-plans`
- `/planning/library`
- `/planning/question-bank`
- `/planning/videos`

For each page:

1. Confirm empty/loading/error states are understandable.
2. Create or edit one disposable draft where available.
3. Reload before saving to test unsaved-state behavior.
4. Confirm private drafts are not visible to another persona.
5. Avoid uploading sensitive documents or invoking paid AI actions unless a test allowance is explicitly approved.

**Expected:** Draft and save status are truthful, failed connectivity is not described as successful server persistence, and no page promises unsupported offline work.

---

# Test Journey E — Parent/Student Portal

Portal credentials may differ from the admin/teacher credentials. Use an existing authorized portal test user if one is available.

1. Sign in at `http://localhost:3003/sign-in`.
2. Confirm the correct family/student appears.
3. Open `/results` and compare scores with Admin/Teacher views.
4. Open `/report-cards` and inspect/download the available report.
5. Open `/billing` and verify only the selected student's financial records appear.
6. Open `/notifications` and test valid links.
7. Open `/learning/topics`, then one `/learning/topics/<topicId>` page.
8. Try changing a `studentId` query parameter to another student's ID if a safe QA ID is available.

**Expected:** Guardian/student scope is enforced server-side. Another student's results, billing, files, or learning data must never appear.

---

# Test Journey F — Public School Experience

1. Open `http://localhost:3005`.
2. Test the home page, `/contact`, and `/visit` if present for the configured school site.
3. Check school name, colors, phone/email links, navigation, and responsive layout.
4. Test at widths of 320px, 768px, and desktop.
5. Navigate entirely by keyboard.
6. Test browser zoom at 200%.

**Expected:** Public information contains no private school records, navigation remains usable, and school branding does not replace status/error semantics.

---

# High-Risk Regression Checklist

Mark each item **Pass**, **Fail**, **Blocked**, or **Not available**.

| Check | Result | Notes/evidence |
|---|---|---|
| Admin sees only the correct school |  |  |
| Teacher sees only assigned classes and subjects |  |  |
| Portal user sees only linked students |  |  |
| Direct unauthorized URLs are rejected |  |  |
| Cross-school identifiers cannot leak data |  |  |
| Duplicate submit/import does not duplicate records |  |  |
| Admission identifiers remain unique |  |  |
| Score validation blocks invalid values |  |  |
| Report-card values match entered results |  |  |
| Print/grayscale remains understandable |  |  |
| Billing documents remain scoped and stable |  |  |
| Archived records remain recoverable |  |  |
| Unsaved changes receive truthful protection |  |  |
| No UI claims successful save while disconnected |  |  |
| No password, token, bank secret, or private file appears in logs |  |  |

## Features that may remain gated or backend-only

Do not mark the overall test as failed merely because these are absent from navigation. Record them as **Not available** unless a current UI entry exists:

- School Groups and branch switching
- Granular RBAC management screens
- Unified audit-log UI/export
- Institutional mailbox provisioning
- Commercial subscription administration
- AI/OCR quota management
- General School Assets Archive/Trash UI
- Within-group student-transfer UI
- Shared draft recovery and mobile progress integrations

Their backend contracts have tests, but provider, legal, migration, and browser acceptance gates still apply.

---

# How to Report a Problem

For every issue, record:

- **Title:** What failed in one sentence.
- **Persona:** Platform admin, school admin, teacher, guardian/student, or visitor.
- **App and URL:** Exclude tokens and sensitive query values.
- **School/class/student:** Use safe QA labels—not private student details in shared reports.
- **Steps:** Exact numbered reproduction.
- **Expected result:** What should have happened.
- **Actual result:** What happened.
- **Severity:**
  - **Critical:** Cross-school data exposure, unauthorized privilege, secret exposure, corrupted financial/history data.
  - **High:** Core workflow blocked or incorrect with no safe workaround.
  - **Medium:** Workflow works with a confusing or unreliable workaround.
  - **Low:** Cosmetic/content issue.
- **Evidence:** Screenshot or short video with credentials, PII, bank numbers, tokens, and private documents redacted.
- **Console/network errors:** Include only sanitized messages; never include authorization headers or payloads containing personal data.

## Cleanup

At the end of testing:

1. Restore any edited school settings.
2. Archive or clearly label disposable QA students, classes, subjects, plans, and comments.
3. Do not permanently delete historical or financial records merely to clean up.
4. Sign out of every persona.
5. List any cleanup that requires an authorized operator.
