"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./obhis.module.css";

type NavItem = { href: string; label: string; current: boolean };

export function ObhisNavigation({ name, homeHref, items, applicationHref, portalHref }: { name: string; homeHref: string; items: readonly NavItem[]; applicationHref: string | null; portalHref?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); };

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const background = [document.querySelector("#main-content"), document.querySelector("footer")].filter((element): element is HTMLElement => element instanceof HTMLElement);
    const previousOverflow = document.body.style.overflow;
    const previousAria = background.map((element) => element.getAttribute("aria-hidden"));
    document.body.style.overflow = "hidden";
    background.forEach((element) => { element.setAttribute("aria-hidden", "true"); (element as HTMLElement & { inert: boolean }).inert = true; });
    requestAnimationFrame(() => panel?.querySelector<HTMLElement>("button, a[href]")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => { if (previousAria[index] === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", previousAria[index]!); (element as HTMLElement & { inert: boolean }).inert = false; });
    };
  }, [open]);

  return <header className={styles.header}>
    <Link className={styles.brand} href={homeHref} aria-label={`${name} home`}><span className={styles.mark} aria-hidden="true">◒</span><span>{name}</span></Link>
    <nav className={styles.desktopNav} aria-label="Primary navigation">{items.map((item) => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined}>{item.label}</Link>)}{applicationHref ? <a className={styles.applyButton} href={applicationHref}>Start an application<span className={styles.srOnly}> — opens the secure application</span></a> : null}</nav>
    <button ref={triggerRef} type="button" className={styles.menuButton} aria-expanded={open} aria-controls="obhis-mobile-navigation" aria-haspopup="dialog" onClick={() => setOpen(true)}><span className={styles.srOnly}>Open menu</span><span aria-hidden="true">Menu</span></button>
    {open ? <div id="obhis-mobile-navigation" ref={panelRef} className={styles.mobileDialog} role="dialog" aria-modal="true" aria-label="Site navigation">
      <div className={styles.mobileDialogTop}><span className={styles.brand}>{name}</span><button type="button" className={styles.menuButton} onClick={closeMenu}>Close</button></div>
      <nav className={styles.mobileNav} aria-label="Mobile primary navigation">{items.map((item) => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}{applicationHref ? <a className={styles.applyButton} href={applicationHref}>Start an application</a> : null}{portalHref ? <a className={styles.utilityLink} href={portalHref}>Family portal</a> : null}</nav>
    </div> : null}
  </header>;
}
