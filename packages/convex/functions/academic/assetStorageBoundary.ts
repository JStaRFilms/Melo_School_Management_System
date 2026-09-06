import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export const SECURE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Uploads unavailable: the current storage transport cannot prove tenant and caller provenance or guarantee abandoned-upload cleanup";

/** Generic upload URLs cannot prove the tenant, caller, and final owner. */
export function secureUploadUnavailable<T>(): T {
  throw new ConvexError(SECURE_UPLOAD_UNAVAILABLE_MESSAGE);
}

/** Compatibility read path for storage already bound by an owning record. */
export function getUnboundStorageUrl(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  return ctx.storage.getUrl(storageId);
}
