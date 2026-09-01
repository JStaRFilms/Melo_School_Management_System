"use client";

import React, { useEffect, useRef } from "react";

export function ArchitecturalDraftingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; vx: number; vy: number }>({
    x: -1000,
    y: -1000,
    vx: 0,
    vy: 0,
  });
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const handleResize = () => {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const vx = e.clientX - prevMouseRef.current.x;
      const vy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      mouseRef.current = { x: e.clientX, y: e.clientY, vx, vy };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000, vx: 0, vy: 0 };
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Anchored micro-particles with Hooke's Law spring physics
    const particleCount = 32;
    const particles = Array.from({ length: particleCount }, () => {
      const baseX = Math.random() * width;
      const baseY = Math.random() * height;
      return {
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.6 + 0.9,
        alpha: Math.random() * 0.25 + 0.15,
      };
    });

    let time = 0;

    const render = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      // 1. Subtle Precision Grid
      ctx.strokeStyle = "rgba(28, 25, 23, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 90;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Drafting Crosshairs (+) at select intersections
      ctx.strokeStyle = "rgba(202, 138, 4, 0.16)";
      ctx.lineWidth = 1;
      const crosshairStep = gridSize * 3;

      for (let x = crosshairStep; x < width; x += crosshairStep) {
        for (let y = crosshairStep; y < height; y += crosshairStep) {
          ctx.beginPath();
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.moveTo(x, y - 4);
          ctx.lineTo(x, y + 4);
          ctx.stroke();
        }
      }

      // 3. Floating Micro-particles with Anchor Springs
      const mouse = mouseRef.current;
      for (const p of particles) {
        // Natural gentle drift
        p.baseX += p.vx;
        p.baseY += p.vy;

        if (p.baseX < 0) p.baseX = width;
        if (p.baseX > width) p.baseX = 0;
        if (p.baseY < 0) p.baseY = height;
        if (p.baseY > height) p.baseY = 0;

        // Cursor proximity repulsion
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 130;

        if (dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          p.x -= (dx / dist) * force * 5;
          p.y -= (dy / dist) * force * 5;
        }

        // Return to anchor via Hooke's Law spring damping
        p.x += (p.baseX - p.x) * 0.05;
        p.y += (p.baseY - p.y) * 0.05;

        // Render particle
        ctx.fillStyle = `rgba(202, 138, 4, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-100"
      aria-hidden="true"
    />
  );
}
