"use client";

import React, { useEffect, useRef } from "react";

class DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  color: string;
  alpha: number;
  baseAlpha: number;
  density: number;
  friction: number;
  springFactor: number;

  constructor(
    x: number,
    y: number,
    color: string = "#CA8A04",
    size: number = 0.8,
    alpha: number = 0.85
  ) {
    this.x = x + (Math.random() - 0.5) * 6;
    this.y = y + (Math.random() - 0.5) * 6;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.baseX = x;
    this.baseY = y;
    this.size = size;
    this.color = color;
    this.alpha = alpha;
    this.baseAlpha = alpha;
    this.density = Math.random() * 22 + 8;
    this.friction = 0.89;
    this.springFactor = 0.055;
  }

  update(mouse: { x: number; y: number; radius: number }) {
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const distSq = dx * dx + dy * dy;
    const radiusSq = mouse.radius * mouse.radius;

    if (distSq < radiusSq && distSq > 0) {
      const dist = Math.sqrt(distSq);
      const force = (mouse.radius - dist) / mouse.radius;
      const angle = Math.atan2(dy, dx);
      const swirl = (Math.random() - 0.5) * 0.35;
      const nx = Math.cos(angle + swirl);
      const ny = Math.sin(angle + swirl);

      this.vx -= nx * force * this.density * 1.3;
      this.vy -= ny * force * this.density * 1.3;
      this.alpha = Math.min(1.0, this.baseAlpha + force * 0.35);
    } else {
      this.alpha += (this.baseAlpha - this.alpha) * 0.05;
    }

    const springDx = this.baseX - this.x;
    const springDy = this.baseY - this.y;
    this.vx += springDx * this.springFactor;
    this.vy += springDy * this.springFactor;

    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function SandFeatureHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; radius: number }>({
    x: -1000,
    y: -1000,
    radius: 120,
  });
  const animRef = useRef<number | null>(null);
  const particlesRef = useRef<DustParticle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const initParticles = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const isMobile = width < 640;

      // Two-line editorial layout
      const line1 = "Built for every part";
      const line2 = "of your school.";

      // Responsive font sizing ensuring text fits comfortably within 85% width
      let fontSize = isMobile
        ? Math.min(42, Math.max(26, Math.floor(width * 0.08)))
        : Math.min(68, Math.max(44, Math.floor(width * 0.055)));

      ctx.font = `600 ${fontSize}px "Instrument Serif", Georgia, serif`;
      while (
        (ctx.measureText(line1).width > width * 0.85 ||
          ctx.measureText(line2).width > width * 0.85) &&
        fontSize > 20
      ) {
        fontSize -= 2;
        ctx.font = `600 ${fontSize}px "Instrument Serif", Georgia, serif`;
      }

      const lineHeight = fontSize * 1.15;
      const height = Math.floor(lineHeight * 2 + (isMobile ? 30 : 50));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      // Render offscreen text
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#1C1917";
      ctx.font = `600 ${fontSize}px "Instrument Serif", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const centerY = height / 2;
      ctx.fillText(line1, width / 2, centerY - lineHeight / 2);
      ctx.fillText(line2, width / 2, centerY + lineHeight / 2);

      // Extract pixel buffer
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const particles: DustParticle[] = [];

      // Fine dust sampling stride
      const step = isMobile ? Math.floor(3.5 * dpr) : Math.floor(2.2 * dpr);

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * 4 * canvas.width) + (x * 4);
          const alpha = data[index + 3];

          if (alpha > 70) {
            const rand = Math.random();
            let color = "#1C1917";
            if (rand < 0.22) color = "#CA8A04"; // Warm gold dust
            else if (rand < 0.38) color = "#D97706"; // Amber grain
            else if (rand < 0.52) color = "#44403C"; // Ash stone
            else color = "#1C1917"; // Obsidian core

            const grainSize = isMobile
              ? Math.random() * 1.0 + 0.55
              : Math.random() * 0.85 + 0.45;
            const grainAlpha = Math.random() * 0.35 + 0.65;

            particles.push(
              new DustParticle(x / dpr, y / dpr, color, grainSize, grainAlpha)
            );
          }
        }
      }

      particlesRef.current = particles;
      ctx.clearRect(0, 0, width, height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.x = e.touches[0].clientX - rect.left;
        mouseRef.current.y = e.touches[0].clientY - rect.top;
      }
    };

    document.fonts.ready.then(() => {
      initParticles();
    });

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        particles[i].update(mouse);
        particles[i].draw(ctx);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    const handleResize = () => {
      initParticles();
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full flex flex-col items-center justify-center my-2 select-none min-h-[160px] sm:min-h-[200px]"
    >
      <h1 className="sr-only">Built for every part of your school.</h1>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="w-full max-w-4xl cursor-default"
      />
    </div>
  );
}
