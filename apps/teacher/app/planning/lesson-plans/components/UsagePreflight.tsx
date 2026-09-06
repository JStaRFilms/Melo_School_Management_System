"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";

type Quote = { _id: Id<"usageOperationAttempts">; estimatedUnits: number; meterType: "ai_tokens" | "ocr_pages" | "storage_bytes"; modelProfile: string };
type LocalMutation = (args: Record<string, unknown>) => Promise<unknown>;
export function UsagePreflight({ schoolId, itemCount, task = "teacher_lesson_plan", label = "generation" }: { schoolId: Id<"schools">; itemCount: number; task?: "teacher_lesson_plan" | "provider_ocr" | "knowledge_upload" | "curriculum_generation" | "ai_import"; label?: string }) {
  const quoteOperation = useMutation("functions/academic/usageEntitlements:quoteHeavyOperation" as never) as unknown as LocalMutation;
  const confirmOperation = useMutation("functions/academic/usageEntitlements:confirmHeavyOperation" as never) as unknown as LocalMutation;
  const cancelOperation = useMutation("functions/academic/usageEntitlements:cancelHeavyOperation" as never) as unknown as LocalMutation;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function review() { setPending(true); setMessage(""); try { const result = await quoteOperation({ schoolId, task, itemCount: Math.max(1, itemCount), idempotencyKey: crypto.randomUUID() } ) as Quote; setQuote(result); } catch (error) { setMessage(error instanceof Error ? error.message : "Estimate unavailable."); } finally { setPending(false); } }
  async function confirm() { if (!quote) return; setPending(true); try { const result = await confirmOperation({ schoolId, attemptId: quote._id, expectedUnits: quote.estimatedUnits, confirmation: "CONFIRM" }) as { message: string }; setMessage(result.message); setQuote(null); } catch (error) { setMessage(error instanceof Error ? error.message : "Confirmation failed; no work dispatched."); } finally { setPending(false); } }
  async function cancel() { if (!quote) return; setPending(true); try { await cancelOperation({ schoolId, attemptId: quote._id }); setMessage("Cancelled before dispatch; no allowance reserved or charged."); setQuote(null); } finally { setPending(false); } }
  return <section className="mx-4 my-2 rounded-xl border border-slate-200 bg-white p-3 md:mx-8"><h2 className="text-sm font-bold">{label} allowance preflight</h2><p className="text-xs">Review the authoritative configured task estimate. Confirmed work reaches a disabled dispatch placeholder, releases the reservation and charges zero allowance.</p><button className="mt-2 border p-2 text-xs" disabled={pending} onClick={() => void review()}>Review {label} estimate</button><p role="status" className="text-xs">{message}</p>{quote && <div role="dialog" aria-modal="true" aria-labelledby="usage-confirm-title" className="mt-2 space-y-2 border p-3"><h3 id="usage-confirm-title" className="font-semibold">Confirm heavy operation</h3><p>{quote.estimatedUnits} {quote.meterType} for {itemCount} selected source{itemCount === 1 ? "" : "s"}. Model task profile: {quote.modelProfile}. This is allowance impact, not a money price.</p><p>Provider execution is unavailable. Confirmation cannot execute {label} and will release the reservation without charging allowance.</p><button disabled={pending} onClick={() => void confirm()}>Confirm and test safe dispatch</button> <button disabled={pending} onClick={() => void cancel()}>Cancel before work</button></div>}</section>;
}
