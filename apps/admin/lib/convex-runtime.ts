/**
 * Check if Convex is configured for live data
 */
export function isConvexConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

/**
 * Get the Convex URL for the current environment
 */
export function getConvexUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_CONVEX_URL;
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
