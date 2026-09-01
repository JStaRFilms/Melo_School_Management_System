"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import { playTick } from "../../lib/audio-feedback";

interface MagneticWordProps {
  word: string;
  italic?: boolean;
  isLast?: boolean;
}

function MagneticWord({ word, italic = false, isLast = false }: MagneticWordProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 300, damping: 18 });
  const springY = useSpring(y, { stiffness: 300, damping: 18 });

  const handleMouseMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = (e.clientX - centerX) * 0.25;
    const distanceY = (e.clientY - centerY) * 0.25;

    x.set(distanceX);
    y.set(distanceY);
  };

  const handleMouseEnter = () => {
    setHovered(true);
    playTick("soft");
  };

  const handleMouseLeave = () => {
    setHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
        display: "inline-block",
      }}
      className={`relative cursor-default transition-colors duration-200 ${
        italic
          ? "italic font-light text-stone-500 hover:text-stone-900"
          : "text-stone-900 font-normal hover:text-amber-700"
      }`}
    >
      {word}
      {hovered && (
        <motion.span
          layoutId="wordGlow"
          className="absolute -inset-1 rounded-lg bg-amber-500/10 -z-10 blur-sm pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      {!isLast && "\u00A0"}
    </motion.span>
  );
}

export function MagneticHeroHeading() {
  const line1 = ["A", "school", "is", "one", "institution."];
  const line2 = ["Its", "information", "should", "behave", "like", "one", "system."];

  return (
    <h1
      aria-label="A school is one institution. Its information should behave like one system."
      className="font-serif text-5xl sm:text-7xl md:text-8xl font-normal leading-[1.02] tracking-tight max-w-5xl mx-auto select-none"
    >
      <span className="block overflow-hidden py-1">
        {line1.map((w, i) => (
          <MagneticWord key={i} word={w} isLast={i === line1.length - 1} />
        ))}
      </span>
      <span className="block overflow-hidden py-1">
        {line2.map((w, i) => (
          <MagneticWord key={i} word={w} italic={true} isLast={i === line2.length - 1} />
        ))}
      </span>
    </h1>
  );
}
