import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";

// Shared by the admin family editor and the scoped parent correction transaction.
export function contactAddressPatch(
  args: { addressMode?: "residential" | "different"; addressOverride?: string | null },
  existing?: Doc<"familyMembers">,
): Pick<Doc<"familyMembers">, "addressMode" | "addressOverride"> {
  if (args.addressMode === undefined && args.addressOverride === undefined)
    return existing ? { addressMode: existing.addressMode, addressOverride: existing.addressOverride } : { addressMode: "residential" };
  const mode = args.addressMode ?? existing?.addressMode;
  if (!mode) throw new ConvexError("Choose same residential address or different address");
  const addressOverride = mode === "different"
    ? (args.addressOverride === undefined ? existing?.addressOverride : args.addressOverride)?.trim() || undefined
    : undefined;
  if (mode === "different" && !addressOverride) throw new ConvexError("Enter the different contact address");
  return { addressMode: mode, addressOverride };
}
