import { ImageResponse } from "next/og";
import { siteBrand } from "@/site";

export const runtime = "edge";

export async function GET(): Promise<ImageResponse> {
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
          background: "linear-gradient(135deg, #173B72 0%, #0F766E 100%)",
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
              fontSize: 42,
              fontWeight: 900,
            }}
          >
            M
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 32, fontWeight: 900 }}>{siteBrand.name}</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.78)", fontSize: 22 }}>{siteBrand.tagline}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
          <div style={{ color: "#C08B2E", fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            School operating system
          </div>
          <div style={{ marginTop: 20, fontSize: 78, lineHeight: 1.02, fontWeight: 900, letterSpacing: -3 }}>
            School management, simplified.
          </div>
          <div style={{ marginTop: 24, color: "rgba(255,255,255,0.82)", fontSize: 30, lineHeight: 1.35 }}>
            Academics, billing, parent visibility, and managed school websites in one platform.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.74)", fontSize: 22 }}>
          <div>{siteBrand.siteUrl.replace(/^https?:\/\//, "")}</div>
          <div>Built for Nigerian schools</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
