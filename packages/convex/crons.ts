import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Per-draft schedules provide prompt expiry; this bounded sweep retries missed or failed runs.
crons.interval(
  "expire retained form drafts",
  { hours: 1 },
  internal.functions.academic.drafts.expireFormDrafts,
  {},
);
crons.interval(
  "retry asset retention cleanup",
  { hours: 1 },
  internal.functions.academic.assets.cleanupExpiredAssetStorage,
  {},
);

export default crons;
