# T13 Class-Assigned Fee Plans and Student Extras

## Objective

Upgrade billing from school-wide fee-plan templates into class-targeted defaults so a bursar can define a fee plan once, choose which classes it applies to, and have students in those classes receive the expected billing coverage. Preserve the ability to add manual student-specific extras such as sportswear, books, or one-off levies.

## Requested Scope

- extend fee-plan modeling so a fee plan can target one or more classes
- support default billing coverage for students in those classes
- make it easy to generate or maintain invoices for all students covered by a class-assigned fee plan for a session/term
- prevent accidental duplicate default invoices for the same student / term / class / fee-plan combination
- preserve manual student-specific extras outside the class-default flow
- allow a bursar to add a one-off extra charge to a single student invoice or as a dedicated add-on invoice
- update the billing admin UX so fee-plan creation includes class targeting and the invoice workflow reflects default vs extra charges

## Acceptance Criteria

- [x] An admin can create a fee plan, choose one or more target classes, and save it.
- [x] The billing workflow clearly distinguishes class-default fee plans from one-off student extras.
- [x] The system can apply a class-targeted fee plan across covered students for the selected academic period without duplicate default invoices.
- [x] A bursar can still add a manual extra charge such as sportswear to a specific student.
- [x] Invoice totals, balances, waivers, and payment allocation logic remain correct after the class-targeting changes.
- [x] Existing school-billing data remains school-scoped and backward compatible.

## Notes

- Keep this task focused on fee-plan targeting, invoice coverage, and extra-charge UX.
- Do not pull Paystack checkout, QR-code payment handoff, or parent portal payment UX into this task.
- During implementation, prefer explicit and auditable invoice-generation flows over opaque background automation if a trade-off is needed.
