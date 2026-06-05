import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { resolveRequestedPage, resolveSiteRequest } from "@/site";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const size = { width: 1200, height: 630 } as const;

function slugFromPath(path: string | null): string[] {
  return (path ?? "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const resolution = resolveSiteRequest(request.headers);
  const school = resolution.school;
  const page = school ? resolveRequestedPage(school, slugFromPath(request.nextUrl.searchParams.get("path"))) : null;

  const name = school?.brand.name ?? "Melo School Sites";
  const tagline = school?.brand.tagline ?? "Managed public websites for schools.";
  const title = page?.key === "home" || !page ? name : `${page.title} — ${name}`;
  const description = page?.description ?? tagline;
  const primary = school?.theme.primary ?? "#173B72";
  const secondary = school?.theme.secondary ?? "#0F766E";
  const accent = school?.theme.accent ?? "#C08B2E";
  const mark = (school?.brand.logoMark || school?.brand.fallbackMark || "M").slice(0, 3).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "white",
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(255,255,255,0.42)",
              background: "rgba(255,255,255,0.14)",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            {mark}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{name}</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.78)", fontSize: 22 }}>{tagline}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 910 }}>
          <div style={{ color: accent, fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            School website
          </div>
          <div style={{ marginTop: 20, fontSize: 72, lineHeight: 1.02, fontWeight: 900, letterSpacing: -3 }}>{title}</div>
          <div style={{ marginTop: 24, color: "rgba(255,255,255,0.82)", fontSize: 30, lineHeight: 1.35 }}>{description}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,0.74)", fontSize: 22 }}>
          <div>{resolution.canonicalDomain?.hostname ?? resolution.hostname}</div>
          <div>Powered by Melo</div>
        </div>
      </div>
    ),
    size,
  );
}
