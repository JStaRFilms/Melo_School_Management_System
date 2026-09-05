"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceDeparture } from "../workspace-route-access";
import { DraftMemoryProvider } from "./DraftMemory";
import { UnsavedBranchSwitchModal } from "../components/UnsavedBranchSwitchModal";

export type FormDeparture = WorkspaceDeparture | { kind: "close" | "back" };
export interface DirtyFormRegistration {
  name: string;
  isDirty: boolean;
  save?: () => Promise<void>;
  /** Persistent drafts must await a tombstone; guard-only forms may simply reset. */
  discard: () => void | Promise<void>;
}
interface Guard {
  refresh: () => void;
  register: (id: symbol, form: () => DirtyFormRegistration) => () => void;
  requestDeparture: (departure: FormDeparture) => Promise<boolean>;
}
const Context = createContext<Guard | null>(null);
export function useDepartureGuard() {
  const guard = useContext(Context);
  if (!guard) throw new Error("Mount DepartureGuardProvider above the route tree.");
  return guard;
}
export function useDirtyForm(form: DirtyFormRegistration) {
  const guard = useDepartureGuard();
  const latest = useRef(form); latest.current = form;
  const id = useRef(Symbol("dirty-form"));
  useEffect(() => guard.register(id.current, () => latest.current), [guard]);
  useEffect(() => guard.refresh(), [guard, form.isDirty]);
  return guard.requestDeparture;
}

export function DepartureGuardProvider({ children }: { children: ReactNode }) {
  const forms = useRef(new Map<symbol, () => DirtyFormRegistration>());
  const armHistory = useRef<() => void>(() => {});
  const refresh = useCallback(() => armHistory.current(), []);
  const pending = useRef<((approved: boolean) => void) | null>(null);
  const [prompt, setPrompt] = useState<{ departure: FormDeparture; forms: DirtyFormRegistration[] } | null>(null);
  const activePrompt = useRef<typeof prompt>(null);
  const dirty = useCallback(() => [...forms.current.values()].map(get => get()).filter(form => form.isDirty), []);
  const register = useCallback<Guard["register"]>((id, get) => { forms.current.set(id, get); return () => { forms.current.delete(id); }; }, []);
  const requestDeparture = useCallback(async (departure: FormDeparture) => {
    if (pending.current) return false;
    const active = dirty();
    if (!active.length) return true;
    return new Promise<boolean>(resolve => {
      pending.current = resolve;
      const next = { departure, forms: active };
      activePrompt.current = next;
      setPrompt(next);
    });
  }, [dirty]);
  const finish = (approved: boolean) => {
    // Staying during a queued save must not let its late completion approve a newer departure.
    if (activePrompt.current !== prompt) return;
    const resolve = pending.current;
    pending.current = null; activePrompt.current = null; setPrompt(null); resolve?.(approved);
  };
  const guard = React.useMemo(() => ({ register, requestDeparture, refresh }), [register, requestDeparture, refresh]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty().length) { event.preventDefault(); event.returnValue = ""; }
    };
    const click = (event: MouseEvent) => {
      if (!dirty().length || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void requestDeparture({ kind: "link", href: url.href }).then(ok => { if (ok) { forms.current.clear(); window.location.assign(url.href); } });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); pending.current?.(false); };
  }, [dirty, requestDeparture]);

  useEffect(() => {
    // A same-URL history sentinel catches ordinary Back before the Next popstate listener.
    // No router monkey-patching: imperative push/replace/back MUST use requestDeparture.
    let armed = false; let restoring = false; let bypass = false;
    let askAfterRestore = false;
    let originalUrl = window.location.href;
    const arm = () => {
      if (window.location.href !== originalUrl) { armed = false; bypass = false; }
      if (!armed && dirty().length) {
        originalUrl = window.location.href;
        window.history.pushState(window.history.state, "", originalUrl);
        armed = true;
      }
    };
    const pop = (event: PopStateEvent) => {
      if (bypass || !armed) return;
      // An approved router navigation may have added clean routes beyond this sentinel.
      // Do not skip those routes when Back is used later.
      if (!restoring && window.location.href !== originalUrl) { armed = false; return; }
      event.stopImmediatePropagation();
      if (restoring) {
        restoring = false;
        if (askAfterRestore) {
          askAfterRestore = false;
          void requestDeparture({ kind: "back" }).then(ok => {
            if (ok) { armed = false; bypass = true; forms.current.clear(); window.history.go(-2); }
          });
        }
        return;
      }
      // Restore before opening the asynchronous dialog, including a fast Save/Discard click.
      restoring = true;
      askAfterRestore = true;
      window.history.forward();
    };
    armHistory.current = arm;
    arm();
    window.addEventListener("popstate", pop, true);
    return () => { armHistory.current = () => {}; window.removeEventListener("popstate", pop, true); };
  }, [dirty, requestDeparture]);

  return <Context.Provider value={guard}><DraftMemoryProvider>{children}</DraftMemoryProvider>{prompt && <UnsavedBranchSwitchModal
    isOpen formName={prompt.forms.map(f => f.name).join(", ")} targetBranchName={prompt.departure.kind === "branch" ? "another branch" : prompt.departure.kind === "sign_out" || prompt.departure.kind === "account" ? "another account" : "another page or closing this form"}
    supportsDraftSave={prompt.forms.every(form => !!form.save)}
    onStay={() => finish(false)}
    onSaveDraftAndSwitch={async () => { for (const form of prompt.forms) await form.save?.(); finish(true); }}
    onDiscardAndSwitch={async () => { for (const form of prompt.forms) await form.discard(); finish(true); }}
  />}</Context.Provider>;
}
