"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  color: string;
  alpha: number;
  label?: string;
  category: "academic" | "finance" | "admission" | "attendance" | "ambient";
}

interface CinemaCanvasBackgroundProps {
  scrollProgress: number;
  activeBeat: number;
  isCrucibleStressed?: boolean;
}

export function CinemaCanvasBackground({
  scrollProgress,
  activeBeat,
  isCrucibleStressed = false,
}: CinemaCanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const initParticles = () => {
      const isMobile = width < 768;
      const particleCount = isMobile ? 35 : 85;
      const categories: Particle["category"][] = [
        "academic",
        "finance",
        "admission",
        "attendance",
        "ambient",
      ];
      const colors = {
        academic: "rgba(217, 119, 6, ", // Amber/Gold
        finance: "rgba(5, 150, 105, ", // Emerald
        admission: "rgba(14, 165, 233, ", // Sky
        attendance: "rgba(120, 113, 108, ", // Stone
        ambient: "rgba(168, 162, 158, ", // Light Stone
      };

      const labels = [
        "CA1: 18/20",
        "₦185,000",
        "JSS2 Silver",
        "Paystack #4091",
        "Exam: 72%",
        "94.2% Attend",
        "Arrears: ₦0",
        "Broadsheet",
        "Form #ADM-82",
        "Receipt OK",
      ];

      const particles: Particle[] = [];
      for (let i = 0; i < particleCount; i++) {
        const cat = categories[i % categories.length];
        const px = Math.random() * width;
        const py = Math.random() * height;
        particles.push({
          x: px,
          y: py,
          baseX: px,
          baseY: py,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: Math.random() * 3 + 1.5,
          color: colors[cat],
          alpha: Math.random() * 0.45 + 0.25,
          label: i % 4 === 0 ? labels[i % labels.length] : undefined,
          category: cat,
        });
      }
      particlesRef.current = particles;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const render = () => {
      timeRef.current += 0.015;
      const time = timeRef.current;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw dynamic mode background geometry based on active beat
      if (activeBeat === 1) {
        // Beat 1: Fracture - Drifting broken orbits
        ctx.save();
        ctx.strokeStyle = "rgba(217, 119, 6, 0.06)";
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 12]);
        for (let r = 80; r <= 380; r += 90) {
          ctx.beginPath();
          ctx.arc(
            centerX + Math.sin(time * 0.3) * 15,
            centerY + Math.cos(time * 0.3) * 15,
            r,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
        ctx.restore();
      } else if (activeBeat === 2) {
        // Beat 2: The Machine - Horizontal data pipelines
        ctx.save();
        ctx.strokeStyle = "rgba(120, 113, 108, 0.08)";
        ctx.lineWidth = 1;
        const tracks = [0.25, 0.45, 0.65, 0.85];
        tracks.forEach((t) => {
          const y = height * t;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();

          // Flow pulses along tracks
          const pulseX = ((time * 120 + t * 400) % (width + 100)) - 50;
          ctx.fillStyle = "rgba(217, 119, 6, 0.35)";
          ctx.beginPath();
          ctx.arc(pulseX, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      } else if (activeBeat === 3) {
        // Beat 3: Convergence - Magnetic Bezier curves flowing to center
        ctx.save();
        ctx.lineWidth = 1.2;
        const corners = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: 0, y: height },
          { x: width, y: height },
          { x: width / 2, y: 0 },
          { x: width / 2, y: height },
        ];

        corners.forEach((c, idx) => {
          const progressOffset = Math.sin(time + idx) * 0.2;
          const cpX = centerX + (c.x - centerX) * (0.3 + progressOffset);
          const cpY = centerY + (c.y - centerY) * (0.3 - progressOffset);

          const grad = ctx.createLinearGradient(c.x, c.y, centerX, centerY);
          grad.addColorStop(0, "rgba(217, 119, 6, 0.02)");
          grad.addColorStop(0.7, "rgba(217, 119, 6, 0.18)");
          grad.addColorStop(1, "rgba(217, 119, 6, 0.35)");

          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.quadraticCurveTo(cpX, cpY, centerX, centerY);
          ctx.stroke();
        });

        // Glowing center core
        const coreGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          5,
          centerX,
          centerY,
          120
        );
        coreGrad.addColorStop(0, "rgba(217, 119, 6, 0.25)");
        coreGrad.addColorStop(1, "rgba(217, 119, 6, 0)");
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (activeBeat === 4) {
        // Beat 4: The Crucible - Stress grid with glitch jitter
        ctx.save();
        const jitter = isCrucibleStressed ? (Math.random() - 0.5) * 6 : 0;
        ctx.strokeStyle = isCrucibleStressed
          ? "rgba(225, 29, 72, 0.15)"
          : "rgba(5, 150, 105, 0.12)";
        ctx.lineWidth = 1;

        const gridSize = 60;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x + jitter, 0);
          ctx.lineTo(x - jitter, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y + jitter);
          ctx.lineTo(width, y - jitter);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render and update particles
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mode specific motion
        if (activeBeat === 1) {
          // Drifting and orbital dispersion
          p.x += p.vx + Math.sin(time + i) * 0.4;
          p.y += p.vy + Math.cos(time + i * 0.8) * 0.4;
        } else if (activeBeat === 3) {
          // Magnetic pull towards center
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.x += dx * 0.015;
          p.y += dy * 0.015;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }

        // Screen wrap
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Mouse forcefield interaction
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const forceRadius = 140;

          if (dist < forceRadius && dist > 0) {
            const force = (forceRadius - dist) / forceRadius;
            const angle = Math.atan2(dy, dx);
            // Repel on Beat 1 & 2, Attract on Beat 3
            const direction = activeBeat === 3 ? 1 : -1;
            p.x += Math.cos(angle) * force * 7 * direction;
            p.y += Math.sin(angle) * force * 7 * direction;
          }
        }

        // Draw particle node
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw subtle typography tag on select particles
        if (p.label && width > 768 && activeBeat <= 3) {
          ctx.font = "10px 'DM Sans', monospace";
          ctx.fillStyle = `${p.color}${p.alpha * 0.85})`;
          ctx.fillText(p.label, p.x + 8, p.y + 3);
        }

        // Constellation connection lines (sparse for performance)
        for (let j = i + 1; j < Math.min(i + 8, particles.length); j++) {
          const p2 = particles[j];
          const cdx = p.x - p2.x;
          const cdy = p.y - p2.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist < 95) {
            ctx.strokeStyle = `rgba(217, 119, 6, ${
              (1 - cdist / 95) * 0.12
            })`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeBeat, isCrucibleStressed]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-90 transition-opacity duration-700"
      aria-hidden="true"
    />
  );
}
