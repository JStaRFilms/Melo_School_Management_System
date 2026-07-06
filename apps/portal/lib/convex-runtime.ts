export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * This repository is being used as a Remotion/video fork. Keep the portal in
 * mock-data mode by default so real Convex/auth env vars do not pull the UI
 * back into live runtime dependencies. Set NEXT_PUBLIC_PORTAL_DEMO_MODE=false
 * only when intentionally testing the live Convex portal.
 */
export function isPortalDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_PORTAL_DEMO_MODE !== "false";
}

/**
 * Check if Convex is configured for live data.
 */
export function isConvexConfigured(): boolean {
  return !isPortalDemoMode() && Boolean(convexUrl);
}

/**
 * Validate Convex URL format
 */
export function isValidConvexUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.convex.cloud') ||
           parsed.hostname.endsWith('.convex.site') ||
           parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}
