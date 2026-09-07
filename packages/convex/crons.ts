import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire private form drafts",
  { hours: 1 },
  internal.functions.academic.drafts.expireFormDrafts,
  {},
);

export default crons;
