"use client";

import React, { useEffect, useRef } from "react";

export function ArchitecturalDraftingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // Offscreen cached grid canvas to avoid drawing 100+ paths per frame
    let offscreenCanvas: HTMLCanvasElement | null = null;

    const createOffscreenGrid = () => {
      offscreenCanvas = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      offscreenCanvas.width = Math.floor(width * dpr);
      offscreenCanvas.height = Math.floor(height * dpr);
      const offCtx = offscreenCanvas.getContext("2d");
      if (!offCtx) return;
      offCtx.scale(dpr, dpr);

      // Subtle Precision Grid
      offCtx.strokeStyle = "rgba(28, 25, 23, 0.03)";
      offCtx.lineWidth = 1;
      const gridSize = 100;

      for (let x = 0; x < width; x += gridSize) {
        offCtx.beginPath();
        offCtx.moveTo(x, 0);
        offCtx.lineTo(x, height);
        offCtx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        offCtx.beginPath();
        offCtx.moveTo(0, y);
        offCtx.lineTo(width, y);
        offCtx.stroke();
      }

      // Drafting Crosshairs (+)
      offCtx.strokeStyle = "rgba(202, 138, 4, 0.15)";
      offCtx.lineWidth = 1;
      const crosshairStep = gridSize * 3;

      for (let x = crosshairStep; x < width; x += crosshairStep) {
        for (let y = crosshairStep; y < height; y += crosshairStep) {
          offCtx.beginPath();
          offCtx.moveTo(x - 3, y);
          offCtx.lineTo(x + 3, y);
          offCtx.moveTo(x, y - 3);
          offCtx.lineTo(x, y + 3);
          offCtx.stroke();
        }
      }
    };

    const handleResize = () => {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      createOffscreenGrid();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // 20 lightweight floating particles
    const particleCount = 20;
    const particles = Array.from({ length: particleCount }, () => {
      const baseX = Math.random() * width;
      const baseY = Math.random() * height;
      return {
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.2 + 0.8,
        alpha: Math.random() * 0.2 + 0.1,
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Blit cached grid in 1 single GPU draw call
      if (offscreenCanvas) {
        ctx.drawImage(offscreenCanvas, 0, 0, width, height);
      }

      // Update & render 20 particles
      const mouse = mouseRef.current;
      for (const p of particles) {
        p.baseX += p.vx;
        p.baseY += p.vy;

        if (p.baseX < 0) p.baseX = width;
        if (p.baseX > width) p.baseX = 0;
        if (p.baseY < 0) p.baseY = height;
        if (p.baseY > height) p.baseY = 0;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 120;

        if (dist < radius && dist > 0) {
          const force = (radius - dist) / radius;
          p.x -= (dx / dist) * force * 4;
          p.y -= (dy / dist) * force * 4;
        }

        p.x += (p.baseX - p.x) * 0.05;
        p.y += (p.baseY - p.y) * 0.05;

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
