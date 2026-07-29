import { cronJobs, type FunctionReference } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const recovery = internal as unknown as {
  functions: { admissions: { recovery: { sweep: FunctionReference<"mutation", "internal", Record<string, never>, unknown> } } };
};

crons.interval(
  "recover admissions conversion and outbox leases",
  { minutes: 5 },
  recovery.functions.admissions.recovery.sweep,
  {},
);

export default crons;
