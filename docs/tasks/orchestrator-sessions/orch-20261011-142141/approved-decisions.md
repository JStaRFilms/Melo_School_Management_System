# Approved decisions and later additions

The user approved one admission form with linked contact default and an optional different emergency contact; safe permanent deletion only for unused school-local parents; stable login IDs; simple account notices first.
The user explicitly deferred secure setup/reset links until the end of the backlog.

Later clarification includes bulk/student-first onboarding. "Parents and guardians" replaces duplicated guardian-versus-parent labels. Common relationship choices plus custom relationship avoid inconsistent free-text entry without losing existing values.

Later login clarification: schools should be able to choose the @ suffix using configured school domains. A .local fallback is acceptable until then. Domain policy only applies to new admissions; working IDs stay stable. This is separate from real inbox provisioning and Resend sender identity.

D1-contract.md and D2-contract.md give read-only implementation proposals. Treat those as guidance, not authorization for speculative abstractions, extra indexes, cross-school writes or provider calls. Existing domain registry/governance is reused, and no public "mark verified" shortcut is allowed.
