import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export type DocumentAccessActorV1 = {
  schoolId: Id<"schools">;
  kind: "guardian" | "staff" | "system";
  guardianId?: Id<"admissionsGuardians">;
  userId?: Id<"users">;
  assurance: "standard" | "fresh";
};

export type CheckedDocumentAccessResultV1 =
  | { status: "available"; documentKey: string; url: string; expiresAt: null }
  | { status: "unavailable"; documentKey: string };

/**
 * Shared private-document primitive. B1 supplies the owner/grant decision; this
 * helper enforces the common no-oracle return shape and audit-before-URL order.
 * The signed URL is not persisted and storage IDs never leave this function.
 */
export async function issueCheckedDocumentAccessV1(args: {
  ctx: MutationCtx;
  documentKey: string;
  actor: DocumentAccessActorV1;
  action: "view" | "download";
  requiresFreshAuth: boolean;
  authorize: (document: { schoolId: Id<"schools">; state: string }) => Promise<boolean>;
}): Promise<CheckedDocumentAccessResultV1> {
  const document = await args.ctx.db
    .query("admissionsDocuments")
    .withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey))
    .unique();

  if (!document || document.schoolId !== args.actor.schoolId) {
    return { status: "unavailable", documentKey: args.documentKey };
  }

  const allowed =
    document.state !== "quarantined" &&
    document.state !== "deleted" &&
    (!args.requiresFreshAuth || args.actor.assurance === "fresh") &&
    (await args.authorize({ schoolId: document.schoolId, state: document.state }));

  // This event intentionally occurs before ctx.storage.getUrl. Denials are
  // auditable without revealing a storage identifier or document metadata.
  await args.ctx.db.insert("admissionsDocumentAccessAudits", {
    schoolId: document.schoolId,
    documentId: document._id,
    actorKind: args.actor.kind,
    ...(args.actor.guardianId ? { guardianId: args.actor.guardianId } : {}),
    ...(args.actor.userId ? { actorUserId: args.actor.userId } : {}),
    action: args.action,
    outcome: allowed ? "granted" : "denied",
    createdAt: Date.now(),
  });

  if (!allowed) return { status: "unavailable", documentKey: document.documentKey };

  const url = await args.ctx.storage.getUrl(document.storageId);
  if (!url) return { status: "unavailable", documentKey: document.documentKey };

  return { status: "available", documentKey: document.documentKey, url, expiresAt: null };
}
