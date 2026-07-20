import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@school/convex/_generated/api";
import { toCurriculumGenerationFailure } from "@school/ai";
import { getToken } from "@/auth-server";

const requestSchema = z.object({ importId: z.string().trim().min(1) });

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
}

export async function POST(request: Request) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const convexUrl = getConvexUrl();
  if (!convexUrl) return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const importId = parsedBody.data.importId as never;
  try {
    const result = await client.action(
      api.functions.academic.curriculumGeneration.requestCurriculumGeneration,
      { importId }
    );
    return NextResponse.json(result);
  } catch (error) {
    const failure = toCurriculumGenerationFailure(error);
    const status = failure.errorCode === "source_evidence_unavailable" || failure.errorCode === "evidence_citation_invalid" || failure.errorCode === "source_context_mismatch"
      ? 422
      : failure.errorCode.startsWith("provider_")
        ? 502
        : 500;
    return NextResponse.json(
      { error: failure.errorMessage },
      { status }
    );
  }
}
