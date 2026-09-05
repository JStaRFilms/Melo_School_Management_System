"use client";
export default function ErrorBoundary({ reset }: { reset: () => void }) { return <div className="space-y-3 p-4"><p role="alert">Asset workspace unavailable or permission changed. No successful upload, purge or freed storage is claimed.</p><button className="rounded border px-3 py-2" onClick={reset}>Retry asset workspace</button></div>; }
