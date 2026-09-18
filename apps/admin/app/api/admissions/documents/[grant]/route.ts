import { getToken } from "@/auth-server";
import { createDocumentGrantProxy } from "@school/shared/server/proxyRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createDocumentGrantProxy("admin", { getToken });
