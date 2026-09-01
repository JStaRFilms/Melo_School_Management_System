"use client";

import React, { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";

interface KineticHeadingProps {
  lines: Array<{ text: string; italic?: boolean; className?: string }>;
  className?: string;
  as?: "h1" | "h2" | "h3";
}

export function KineticHeading({
  lines,
  className = "",
  as: Component = "h1",
}: KineticHeadingProps) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const controls = useAnimation();

  // Full raw string for screen reader accessibility
  const fullText = lines.map((l) => l.text).join(" ");

  useEffect(() => {
    let isMounted = true;

    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        if (!isMounted) return;
        setFontsLoaded(true);
        controls.start("visible");
      });
    } else {
      setFontsLoaded(true);
      controls.start("visible");
    }

    return () => {
      isMounted = false;
    };
  }, [controls]);

  return (
    <Component
      aria-label={fullText}
      className={`font-serif tracking-tight ${className}`}
    >
      <span className="sr-only">{fullText}</span>
      <span aria-hidden="true" className="block select-none">
        {lines.map((line, lineIdx) => {
          const words = line.text.split(" ");
          return (
            <span
              key={lineIdx}
              className={`block overflow-hidden py-1 leading-[1.04] ${
                line.className || ""
              }`}
            >
              <motion.span
                className={`inline-block ${
                  line.italic ? "italic font-light text-stone-500" : "text-stone-900 font-normal"
                }`}
                initial={{ y: "115%", opacity: 0, rotateX: 18 }}
                animate={fontsLoaded ? { y: 0, opacity: 1, rotateX: 0 } : {}}
                transition={{
                  duration: 0.9,
                  delay: 0.15 + lineIdx * 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {words.map((word, wordIdx) => (
                  <span key={wordIdx} className="inline-block whitespace-nowrap">
                    {word}
                    {wordIdx < words.length - 1 && "\u00A0"}
                  </span>
                ))}
              </motion.span>
            </span>
          );
        })}
      </span>
    </Component>
  );
}
