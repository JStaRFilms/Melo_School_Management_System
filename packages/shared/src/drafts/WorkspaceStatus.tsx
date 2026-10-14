"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DraftConnection } from "./useFormDraft";

export const DraftHeaderContext = createContext<HTMLElement | null | undefined>(undefined);

/** Keep draft actions in the reserved header, with an inline fallback outside a workspace. */
export function DraftHeaderStatus({ children }: { children: ReactNode }) {
  const target = useContext(DraftHeaderContext);
  return target ? createPortal(children, target) : target === undefined ? <>{children}</> : null;
}

export function WorkspaceConnectionStatus({ connected, authenticated }: Pick<DraftConnection, "connected" | "authenticated">) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const label = !online ? "Browser offline" : !authenticated ? "Sign in required" : !connected ? "Server reconnecting" : "Connected";
  return <span role="status" aria-live="polite" className="shrink-0 text-[11px] text-slate-600">{label}</span>;
}
