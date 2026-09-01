"use client";

import React, { useEffect, useRef, useState } from "react";

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
  density: number;
  friction: number;
  springFactor: number;

  constructor(x: number, y: number, color: string = "#1C1917", size: number = 0.8) {
    this.x = x + (Math.random() - 0.5) * 4;
    this.y = y + (Math.random() - 0.5) * 4;
    this.vx = 0;
    this.vy = 0;
    this.baseX = x;
    this.baseY = y;
    this.size = size;
    this.color = color;
    this.alpha = Math.random() * 0.25 + 0.75;
    this.density = Math.random() * 15 + 6;
    this.friction = 0.86;
    this.springFactor = 0.065;
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
      this.vx -= Math.cos(angle) * force * this.density * 1.2;
      this.vy -= Math.sin(angle) * force * this.density * 1.2;
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
  const isVisibleRef = useRef<boolean>(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // IntersectionObserver to pause RAF when scrolled offscreen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    const initParticles = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = container.getBoundingClientRect();
      const width = rect.width || 900;

      const line1 = "Built for every part";
      const line2 = "of your school.";

      const fontSize = Math.min(72, Math.max(48, Math.floor(width * 0.07)));
      const lineHeight = fontSize * 1.15;
      const height = Math.floor(lineHeight * 2 + 30);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#1C1917";
      ctx.font = `600 ${fontSize}px "Instrument Serif", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const centerY = height / 2;
      ctx.fillText(line1, width / 2, centerY - lineHeight / 2);
      ctx.fillText(line2, width / 2, centerY + lineHeight / 2);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const particles: DustParticle[] = [];

      // Lightweight stride ~500 particles max for silky 60fps
      const step = Math.floor(2.8 * dpr);

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = y * 4 * canvas.width + x * 4;
          const alpha = data[index + 3];

          if (alpha > 70) {
            const color = Math.random() > 0.4 ? "#1C1917" : "#44403C";
            const size = Math.random() * 0.5 + 0.5;
            particles.push(new DustParticle(x / dpr, y / dpr, color, size));
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

    document.fonts.ready.then(() => {
      initParticles();
    });

    const render = () => {
      if (isVisibleRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const mouse = mouseRef.current;
        const particles = particlesRef.current;

        for (let i = 0; i < particles.length; i++) {
          particles[i].update(mouse);
          particles[i].draw(ctx);
        }
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

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isMobile]);

  return (
    <div
      ref={containerRef}
      className="relative w-full flex flex-col items-center justify-center my-2 select-none min-h-[120px] sm:min-h-[200px]"
    >
      <h1 className="md:hidden font-serif text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-[1.1] text-center">
        Built for every part <br />
        <span className="text-stone-700 font-normal italic">of your school.</span>
      </h1>

      <div className="hidden md:block w-full">
        <h1 className="sr-only">Built for every part of your school.</h1>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="w-full max-w-4xl mx-auto cursor-default"
        />
      </div>
    </div>
  );
}
