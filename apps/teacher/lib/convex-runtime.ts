export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
export const isConvexConfigured = Boolean(convexUrl);

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
