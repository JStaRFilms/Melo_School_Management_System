# Bulk/student-first onboarding reminder

The user reports that exact-email existing-parent discovery is helpful and that this entry point now enrolls once with a clear outcome. Preserve that behavior while unifying the UI.

Regression requirement: correct existing parent email with different or mistyped supplied name/phone links the saved identity without overwriting any identity/name/contact/auth fields. Apply to both explicit ID picker and exact-email reuse. Explicit Edit is the only identity-change path.

Admission remains one atomic request with stable requestKey/idempotency; retries cannot create another student or consume another number.
Linking an existing contact cannot reset/provision their account implicitly.
Success and transient credential results must belong to the actual completed target/request. Do not leave stale Account Provisioned sidebar data that claims the current blank/new admission is already provisioned.

This reminder reinforces B1 and B2, not new scope or a return to investigation.
