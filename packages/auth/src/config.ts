export interface ConvexAuthEnv {
  convexUrl: string;
  convexSiteUrl: string;
}

function deriveConvexSiteUrl(convexUrl: string): string {
  try {
    const parsed = new URL(convexUrl);
    if (parsed.hostname.endsWith(".convex.cloud")) {
      parsed.hostname = parsed.hostname.replace(".convex.cloud", ".convex.site");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return convexUrl;
  }
}

function normalizeConvexSiteUrl(convexUrl: string, convexSiteUrl: string): string {
  const trimmedSiteUrl = convexSiteUrl.trim().replace(/\/$/, "");

  if (trimmedSiteUrl.endsWith(".convex.site")) {
    return trimmedSiteUrl;
  }

  return deriveConvexSiteUrl(convexUrl);
}

export function getConvexAuthEnv(
  env: NodeJS.ProcessEnv = process.env
): ConvexAuthEnv | null {
  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return null;
  }

  const convexSiteUrl = env.NEXT_PUBLIC_CONVEX_SITE_URL
    ? normalizeConvexSiteUrl(convexUrl, env.NEXT_PUBLIC_CONVEX_SITE_URL)
    : deriveConvexSiteUrl(convexUrl);

  return {
    convexUrl,
    convexSiteUrl,
  };
}

export function hasConvexAuthEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getConvexAuthEnv(env) !== null;
}
