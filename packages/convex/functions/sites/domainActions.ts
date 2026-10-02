"use node";
import { v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ownershipTxt, providerRead, providerWrite, providerReconcile, providerInstructions, probeTls, providerConfig } from "./providerNode";
const id = v.id("schoolDomains");
async function inspect(ctx: ActionCtx, domainId: import("../../_generated/dataModel").Id<"schoolDomains">, operator: boolean): Promise<{ready: true; observedAt: number; recommendedCNAME: {rank:number;value:string}[]; recommendedIPv4: {rank:number;value:string[]}[]}> {
  const snapshot: {hostname:string;name:string;value:string;generation:number;hash:string;startedAt:number} = await ctx.runQuery(internal.functions.sites.domains.snapshot, {domainId,operator, now: Date.now()});
  try {
    const [owner, route, tls] = await Promise.all([ownershipTxt(snapshot.name,snapshot.value),providerRead(snapshot.hostname),probeTls(snapshot.hostname)]);
    if (!owner) throw Error("TXT proof not present");
    const result: {ready:true;observedAt:number} = await ctx.runMutation(internal.functions.sites.domains.commitCheck,{domainId,hostname:snapshot.hostname,generation:snapshot.generation,hash:snapshot.hash,operator,ownership: true,projectId: route.projectId,configuredBy: route.configuredBy,fingerprint: tls.leafFingerprintSha256,notAfter: tls.leafNotAfter});
    return {...result, recommendedCNAME: route.recommendedCNAME, recommendedIPv4: route.recommendedIPv4};
  } catch (error) {
    await ctx.runMutation(internal.functions.sites.domains.failedCheck,{domainId,hostname:snapshot.hostname,generation:snapshot.generation,hash:snapshot.hash,startedAt:snapshot.startedAt});
    throw error;
  }
}
export const getRoutingInstructions = action({args: {domainId: id}, handler: async (ctx,{domainId}) => {
  const before = await ctx.runQuery(internal.functions.sites.domains.instructionsSnapshot,{domainId,now:Date.now()});
  const instructions = await providerInstructions(before.hostname);
  const after = await ctx.runQuery(internal.functions.sites.domains.instructionsSnapshot,{domainId,now:Date.now()});
  if (after.hostname !== before.hostname || after.generation !== before.generation || after.hash !== before.hash) throw Error("Domain changed during provider fetch");
  return instructions;
}});
export const checkReadiness = action({args: {domainId: id},handler: async (ctx,{domainId}) => inspect(ctx,domainId,true)});
export const maintenanceCheck = internalAction({args: {domainId: id},handler: async (ctx,{domainId}) => {try { await inspect(ctx,domainId,false); } catch { /* Failure clears the old observation or the generation was rotated. */ } return null; }});
// Explicit live operator operation. Config flag is separate from read-only checks.
export const mutateProvider = action({args: {domainId: id, operation: v.union(v.literal("attach"),v.literal("verify")), confirmation: v.string()}, handler: async (ctx,args) => {
  if (process.env.SITES_ALLOW_PROVIDER_WRITES !== "enabled") throw Error("Provider writes disabled");
  providerConfig();
  const snapshot = await ctx.runQuery(internal.functions.sites.domains.snapshot,{domainId:args.domainId,operator:true,now:Date.now()});
  if (args.confirmation !== `CONFIRM ${args.operation.toUpperCase()} ${snapshot.hostname}`) throw Error("Provider operation needs hostname confirmation");
  // This exact TXT must exist on authoritative DNS before any provider POST.
  if (!await ownershipTxt(snapshot.name,snapshot.value)) throw Error("Fresh school TXT proof required");
  const key = {domainId:args.domainId,hostname:snapshot.hostname,generation:snapshot.generation,hash:snapshot.hash,operation:args.operation};
  await ctx.runMutation(internal.functions.sites.domains.reserveProviderOperation,key);
  try {
    const result = await providerWrite(snapshot.hostname,args.operation);
    await ctx.runMutation(internal.functions.sites.domains.finishProviderOperation,{...key,confirmed:true});
    return result;
  } catch (error) {
    // The POST may already have landed. Never retry automatically or unlock on failure.
    try { await ctx.runMutation(internal.functions.sites.domains.finishProviderOperation,{...key,confirmed:false}); } catch { /* Reservation itself still blocks writes. */ }
    throw error;
  }
}});
export const reconcileProvider = action({args: {domainId: id},handler: async (ctx,{domainId}) => {
  providerConfig();
  await ctx.runMutation(internal.functions.sites.domains.markInterruptedProviderOperation,{domainId});
  const snapshot: {hostname:string;generation:number;hash:string;operation:"attach"|"verify"} = await ctx.runQuery(internal.functions.sites.domains.operationSnapshot,{domainId,now:Date.now()});
  // Only a positive read-only observation clears the reservation. Missing, ambiguous
  // or incomplete provider state remains blocked for operator investigation.
  await providerReconcile(snapshot.hostname,snapshot.operation);
  await ctx.runMutation(internal.functions.sites.domains.reconcileProviderOperation,{domainId,...snapshot});
  return {reconciled:true as const};
}});
