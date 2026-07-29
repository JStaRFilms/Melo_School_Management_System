export function previewTokenFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "__preview" && parts[1] ? parts[1] : undefined;
}

export function previewPathPrefix(token: string | undefined): string | undefined {
  return token ? `/__preview/${encodeURIComponent(token)}` : undefined;
}
