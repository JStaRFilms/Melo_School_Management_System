"use client";
import { useEffect, useRef } from "react";

const dialogStack: HTMLElement[] = [];

/** Modal keyboard containment and focus restoration, including nested overlay recovery. */
export function useDialogFocus(open: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    if (!open || !ref.current) return;
    const root = ref.current;
    const previous = document.activeElement;
    dialogStack.push(root);
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
    (root.querySelector<HTMLElement>("[data-dialog-initial]") ?? focusable()[0] ?? root).focus();
    const keydown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== root) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); escape.current?.(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0]; const last = items[items.length - 1];
      if (!first) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => {
      if (dialogStack[dialogStack.length - 1] !== root) return;
      if (event.target instanceof Node && !root.contains(event.target)) (focusable()[0] ?? root).focus();
    };
    root.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      dialogStack.splice(dialogStack.indexOf(root), 1);
      root.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
