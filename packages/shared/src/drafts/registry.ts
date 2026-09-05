import { z } from "zod";

const text = z.string().max(500);
const notes = z.string().max(12000);
const person = z.object({ firstName: text.optional(), lastName: text.optional(), middleName: text.optional(), email: text.optional(), phone: text.optional(), classLevel: text.optional() }).strict();
const definition = <T extends z.ZodTypeAny>(schema: T, sensitivity: "personal" | "operational", retentionDays: 30 | 90, authority: "admin" | "staff") => ({
  schema, version: 1 as const, sensitivity, retentionDays, authority,
  recovery: "server-only" as const, localRecovery: false as const, uploads: false as const,
  entityContext: "create-only" as const,
});

/** Reviewed, deliberately minimal projections, not whole form state. Extend with domain review. */
export const draftRegistry = {
  student_onboarding: definition(person, "personal", 90, "admin"),
  family_onboarding: definition(z.object({ guardians: z.array(person).max(4).optional(), students: z.array(person).max(20).optional() }).strict(), "personal", 90, "admin"),
  staff_onboarding: definition(person.extend({ name: text.optional() }).strict(), "personal", 30, "admin"),
  fee_plan_builder: definition(z.object({ planName: text.optional(), amount: z.number().finite().min(0).optional(), discount: z.number().finite().min(0).optional(), description: notes.optional() }).strict(), "operational", 30, "admin"),
  academic_setup: definition(z.object({ name: text.optional(), startDate: text.optional(), endDate: text.optional() }).strict(), "operational", 30, "admin"),
  report_card_configuration: definition(z.object({ name: text.optional(), description: notes.optional() }).strict(), "operational", 30, "admin"),
  curriculum_plan: definition(z.object({ week: z.number().int().min(1).max(53).optional(), topic: text.optional(), objectives: notes.optional(), activities: notes.optional() }).strict(), "operational", 90, "staff"),
  import_review: definition(z.object({ mappings: z.array(z.object({ column: text, target: text }).strict()).max(200).optional() }).strict(), "operational", 90, "admin"),
} as const;
export type DraftFormKey = keyof typeof draftRegistry;
export type DraftPayload<K extends DraftFormKey> = z.infer<(typeof draftRegistry)[K]["schema"]>;
export function isDraftFormKey(key: string): key is DraftFormKey {
  return Object.prototype.hasOwnProperty.call(draftRegistry, key);
}
export function parseDraftPayload<K extends DraftFormKey>(key: K, payload: unknown): DraftPayload<K> {
  // The discriminant selects the corresponding schema; Zod's indexed union cannot express that relationship.
  return draftRegistry[key].schema.parse(payload) as DraftPayload<K>;
}
