"use client";

import React, { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { playTick } from "../../lib/audio-feedback";

export function CinematicShutterTransition() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  // Play Entrance Reveal on initial mount and route change
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    const topBlocks = container.querySelectorAll(".shutter-block-top");
    const bottomBlocks = container.querySelectorAll(".shutter-block-bottom");

    // Reveal: scaleY 1 -> 0
    gsap.set(container, { display: "flex", pointerEvents: "all" });
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(container, { display: "none", pointerEvents: "none" });
        isNavigatingRef.current = false;
      },
    });

    tl.to(topBlocks, {
      scaleY: 0,
      duration: 0.65,
      stagger: { each: 0.04, from: "start" },
      ease: "expo.inOut",
    }).to(
      bottomBlocks,
      {
        scaleY: 0,
        duration: 0.65,
        stagger: { each: 0.04, from: "start" },
        ease: "expo.inOut",
      },
      "<"
    );

    return () => {
      tl.kill();
    };
  }, [pathname]);

  // Intercept internal link navigations
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const handleLinkClick = (e: MouseEvent) => {
      // Preserve modified clicks (Cmd/Ctrl/Shift/Alt), auxiliary clicks (middle-click), and already handled events
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        target.getAttribute("target") === "_blank" ||
        target.hasAttribute("download") ||
        href === window.location.pathname ||
        isNavigatingRef.current
      ) {
        return;
      }

      // Check if it's an internal route
      if (href.startsWith("/") || href.startsWith(window.location.origin)) {
        e.preventDefault();
        isNavigatingRef.current = true;
        playTick("soft");

        const container = containerRef.current;
        if (!container) {
          router.push(href);
          return;
        }

        const topBlocks = container.querySelectorAll(".shutter-block-top");
        const bottomBlocks = container.querySelectorAll(".shutter-block-bottom");

        // Close: scaleY 0 -> 1
        gsap.set(container, { display: "flex", pointerEvents: "all" });
        gsap.set([topBlocks, bottomBlocks], { scaleY: 0 });

        const tl = gsap.timeline({
          onComplete: () => {
            router.push(href);
          },
        });

        tl.to(topBlocks, {
          scaleY: 1,
          duration: 0.5,
          stagger: { each: 0.03, from: "end" },
          ease: "expo.inOut",
        }).to(
          bottomBlocks,
          {
            scaleY: 1,
            duration: 0.5,
            stagger: { each: 0.03, from: "end" },
            ease: "expo.inOut",
          },
          "<"
        );
      }
    };

    document.addEventListener("click", handleLinkClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleLinkClick, { capture: true });
    };
  }, [router]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 w-screen h-screen flex-col z-[99999] pointer-events-none hidden select-none"
    >
      {/* Top Shutter Row */}
      <div className="flex flex-1 w-full overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`top-${i}`}
            className="shutter-block-top flex-1 bg-[#0D0E10] origin-top border-r border-stone-800/40 last:border-r-0 will-change-transform"
          />
        ))}
      </div>

      {/* Bottom Shutter Row */}
      <div className="flex flex-1 w-full overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`bottom-${i}`}
            className="shutter-block-bottom flex-1 bg-[#0D0E10] origin-bottom border-r border-stone-800/40 last:border-r-0 will-change-transform"
          />
        ))}
      </div>
    </div>
  );
}
