"use client";

import { siteBrand,siteNavigation } from "@/site";
import { ArrowRight,Mail,MapPin,Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/* ─── Utilities ─── */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ─── Container ─── */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-content px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/* ─── Button Link ─── */
export function ButtonLink({
  href,
  children,
  variant = "solid",
  className,
  size = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline" | "ghost";
  className?: string;
  size?: "default" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 cursor-pointer";

  const sizes = {
    default: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-7 py-3.5 text-base rounded-xl",
  };

  const variants = {
    solid:
      "bg-melo-ink text-white hover:bg-stone-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 border border-stone-800",
    outline:
      "border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 shadow-sm",
    ghost:
      "bg-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100",
  };

  return (
    <Link href={href} className={cn(base, sizes[size], variants[variant], className)}>
      {children}
      {variant === "solid" && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}

/* ─── Gold Button ─── */
export function GoldButton({
  href,
  children,
  className,
  size = "default",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  size?: "default" | "lg";
}) {
  const sizes = {
    default: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 cursor-pointer",
        "bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 border border-amber-600/30",
        sizes[size],
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/* ─── Section Label ─── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-melo-gold">
      <span className="inline-block h-px w-6 bg-melo-gold" />
      {children}
    </span>
  );
}

/* ─── Site Header ─── */
import { motion,useMotionValueEvent,useScroll } from "framer-motion";
import { CreditCard,Home,Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedDock } from "../components/ui/animated-dock";
import { MeloLogo } from "../components/ui/melo-logo";

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;

    // Auto-hide during rapid downward scrolls deep in the page, reveal on scroll up
    if (latest > previous && latest > 200) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const dockItems = [
    {
      link: "/",
      label: "Home",
      Icon: <Home size={18} className="text-white drop-shadow-md" />,
    },
    {
      link: "/features",
      label: "Features",
      Icon: <Zap size={18} className="text-white drop-shadow-md" />,
    },
    {
      link: "/pricing",
      label: "Pricing",
      Icon: <CreditCard size={18} className="text-white drop-shadow-md" />,
    },
    {
      link: "/contact",
      label: "Contact",
      Icon: <Mail size={18} className="text-white drop-shadow-md" />,
    }
  ];

  return (
    <>
      {/* ─── DESKTOP HEADER (TOP) & MOBILE LOGO BAR ─── */}
      <motion.header
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: -100, opacity: 0 }
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-3 sm:top-5 inset-x-0 z-50 px-4 sm:px-8 pointer-events-none flex justify-center"
      >
        <div className="flex items-center justify-between relative w-full max-w-7xl">
          {/* Brand Logo */}
          <div className="pointer-events-auto">
            <Link href="/" className="group inline-flex items-center">
              <MeloLogo size={34} showWordmark={true} />
            </Link>
          </div>

          {/* Desktop Center Navigation Dock (Hidden on mobile) */}
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 pointer-events-auto">
            <AnimatedDock items={dockItems} className="shadow-xl" />
          </div>

          {/* Right Action Button */}
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              href="/contact"
              className="flex items-center justify-center h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95 border border-stone-800"
            >
              Demo
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ─── MOBILE BOTTOM NAVIGATION DOCK (BOTTOM ON MOBILE ONLY) ─── */}
      <motion.nav
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: 100, opacity: 0 }
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="sm:hidden fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      >
        <div className="pointer-events-auto">
          <AnimatedDock items={dockItems} className="shadow-2xl" />
        </div>
      </motion.nav>
    </>
  );
}

/* ─── Site Footer ─── */
export function SiteFooter() {
  return (
    <footer className="border-t border-stone-800 bg-stone-950 text-white">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr]">
          {/* Brand */}
          <div className="space-y-5">
            <MeloLogo size={38} showWordmark={true} className="[&_span]:text-white" />
            <p className="max-w-sm text-sm leading-relaxed text-stone-400 font-light">
              {siteBrand.description}
            </p>
          </div>

          {/* Nav */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Navigate</p>
            <div className="mt-5 flex flex-col gap-3">
              {siteNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Contact</p>
            <div className="mt-5 flex flex-col gap-3">
              <a href={`mailto:${siteBrand.email}`} className="flex items-center gap-2 text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer">
                <Mail className="h-3.5 w-3.5" />
                {siteBrand.email}
              </a>
              <a href={`tel:${siteBrand.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer">
                <Phone className="h-3.5 w-3.5" />
                {siteBrand.phone}
              </a>
              <span className="flex items-center gap-2 text-sm text-stone-400">
                <MapPin className="h-3.5 w-3.5" />
                {siteBrand.address}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Ready?</p>
            <p className="text-sm text-stone-400">See Melo in action. Book a 15-minute walkthrough with our team.</p>
            <GoldButton href="/contact">Book a demo</GoldButton>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-800 pt-8 text-xs text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Melo. Built by J StaR Films Studios.</p>
          <p>Built in Abuja, Nigeria 🇳🇬</p>
        </div>
      </Container>
    </footer>
  );
}
