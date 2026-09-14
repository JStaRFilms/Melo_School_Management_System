export function admissionsAdminErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (/FRESH_AUTH_REQUIRED|Fresh authentication/i.test(raw)) return "Your sign-in is too old for this protected action. Sign out, sign in again, and retry.";
  if (/FORBIDDEN|UNAUTHORIZED|NOT_FOUND_OR_DENIED/i.test(raw)) return "You do not have permission to complete this action, or the application is no longer available.";
  if (/not ready for a decision|Required documents must be accepted/i.test(raw)) return "The application is not ready for that decision. Review the readiness blockers and latest document results.";
  if (/Decision transition is not allowed|current snapshot|current application evaluation/i.test(raw)) return "The workflow changed or this action is no longer allowed. Review the latest state and try again.";
  if (/completed conversion cannot be reopened/i.test(raw)) return "This decision cannot be reopened because conversion has already completed.";
  if (/evaluation must be scheduled|scheduled evaluation requires|completed evaluation requires|score must be between/i.test(raw)) return "Check the evaluation state, schedule, result, and score before saving.";
  if (/Checked document access is unavailable/i.test(raw)) return "Checked document access is unavailable. Sign in again if the document requires recent authentication.";
  if (/Failed to fetch|NetworkError|network request/i.test(raw)) return "The service could not be reached. Check your connection and try again.";
  return "The operation could not be completed safely. Review the current workflow state and try again.";
}
