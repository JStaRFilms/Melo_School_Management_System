import { getToken } from "@/lib/auth-server";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const contentLengthValue = request.headers.get("content-length");
  if (!contentLengthValue || !/^\d+$/.test(contentLengthValue)) return Response.json({ error: "A valid Content-Length header is required." }, { status: 411 });
  const contentLength = Number(contentLengthValue);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_UPLOAD_BYTES) return Response.json({ error: "Upload size must be between 1 byte and 20 MiB." }, { status: 413 });
  const token = await getToken();
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!token || !siteUrl) return Response.json({ error: "Secure upload is unavailable because its server connection is not configured." }, { status: 503 });
  const target = new URL("/admissions/document-upload", siteUrl);
  const contentType = request.headers.get("content-type"), intent = request.headers.get("x-admissions-upload-intent"), uploadToken = request.headers.get("x-admissions-upload-token");
  if (!contentType || !intent || !uploadToken) return Response.json({ error: "Upload credentials are missing." }, { status: 400 });
  if (!request.body) return Response.json({ error: "Upload body is missing." }, { status: 400 });
  const init: RequestInit & { duplex: "half" } = { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType, "Content-Length": String(contentLength), "X-Admissions-Upload-Intent": intent, "X-Admissions-Upload-Token": uploadToken }, body: request.body, cache: "no-store", duplex: "half" };
  const response = await fetch(new Request(target, init));
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
}
