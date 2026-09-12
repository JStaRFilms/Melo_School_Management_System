import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { processRetentionCleanupRef } from "./functions/admissions/refs";

const crons = cronJobs();

// Per-draft schedules provide prompt expiry; this bounded sweep retries missed or failed runs.
crons.interval(
  "expire retained form drafts",
  { hours: 1 },
  internal.functions.academic.drafts.expireFormDrafts,
  {},
);

crons.interval(
  "clean admissions documents",
  { hours: 6 },
  processRetentionCleanupRef,
  {},
);

export default crons;
