import { v } from "convex/values";

export const studentEnrollmentStatus = v.union(
  v.literal("active"), v.literal("withdrawn"), v.literal("suspended"),
  v.literal("graduated"), v.literal("transferred_out"),
);
export const studentEnrollmentEventType = v.union(
  v.literal("admitted"), v.literal("imported"), v.literal("withdraw"),
  v.literal("suspend"), v.literal("re_enrol"), v.literal("reinstate"),
  v.literal("graduate"), v.literal("graduation_details_corrected"),
  v.literal("graduation_corrected"), v.literal("promote"),
  v.literal("promotion_cancelled"), v.literal("placement_changed"),
  v.literal("transfer_out"), v.literal("transfer_in"),
  v.literal("transfer_reversed"), v.literal("archive"), v.literal("restore"),
);
export const studentTransitionAction = v.union(
  v.literal("withdraw"), v.literal("suspend"),
  v.literal("re_enrol"), v.literal("reinstate"),
);
export const studentLifecycleContext = {
  classId: v.id("classes"),
  className: v.optional(v.string()),
  sessionId: v.optional(v.id("academicSessions")),
  sessionName: v.optional(v.string()),
  termId: v.optional(v.id("academicTerms")),
  termName: v.optional(v.string()),
};
