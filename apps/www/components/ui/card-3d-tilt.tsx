"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Card3DTiltProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glow?: boolean;
}

export function Card3DTilt({
  children,
  className = "",
  maxTilt = 6,
  glow = true,
}: Card3DTiltProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateXSpring = useSpring(
    useTransform(mouseY, [0, 1], [maxTilt, -maxTilt]),
    { stiffness: 240, damping: 22 }
  );
  const rotateYSpring = useSpring(
    useTransform(mouseX, [0, 1], [-maxTilt, maxTilt]),
    { stiffness: 240, damping: 22 }
  );

  // Top-level declared transforms for specular highlight
  const gleamBackground = useTransform(
    [mouseX, mouseY],
    ([x, y]) =>
      `radial-gradient(circle at ${(x as number) * 100}% ${(y as number) * 100}%, rgba(255,255,255,0.75) 0%, rgba(202,138,4,0.12) 30%, transparent 65%)`
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1200,
        rotateX: isHovered ? rotateXSpring : 0,
        rotateY: isHovered ? rotateYSpring : 0,
      }}
      className={`relative transition-shadow duration-300 ${className}`}
    >
      {children}

      {/* Dynamic Specular Gleam Overlay */}
      {glow && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.14 : 0,
            background: gleamBackground,
          }}
        />
      )}
    </motion.div>
  );
}
