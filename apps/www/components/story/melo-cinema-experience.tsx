"use client";

import Lenis from "lenis";
import { motion, useScroll } from "framer-motion";
import {
  Compass,
  Cpu,
  Eye,
  Layers,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Beat01Fracture } from "./beat-01-fracture";
import { Beat02Machine } from "./beat-02-machine";
import { Beat03Convergence } from "./beat-03-convergence";
import { Beat04Crucible } from "./beat-04-crucible";
import { Beat05Reveal } from "./beat-05-reveal";
import { Beat06Horizon } from "./beat-06-horizon";
import { CinemaCanvasBackground } from "./cinema-canvas-background";

export function MeloCinemaExperience() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeBeat, setActiveBeat] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Audio synthesizer for micro-acoustic feedback
  const playTickSound = (frequency = 440, duration = 0.04) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Audio context may be restricted before user gesture
    }
  };

  useEffect(() => {
    // Initialize Lenis Smooth Scroll Engine
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
      setScrollProgress(progress);

      // Determine active beat based on scroll segments
      let currentBeat = 1;
      if (progress > 0.82) currentBeat = 6;
      else if (progress > 0.62) currentBeat = 5;
      else if (progress > 0.44) currentBeat = 4;
      else if (progress > 0.24) currentBeat = 3;
      else if (progress > 0.08) currentBeat = 2;
      else currentBeat = 1;

      setActiveBeat((prev) => {
        if (prev !== currentBeat) {
          playTickSound(300 + currentBeat * 100, 0.06);
        }
        return currentBeat;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [soundEnabled]);

  const chapters = [
    { id: 1, label: "Fracture", icon: <Eye className="h-3 w-3" /> },
    { id: 2, label: "The Machine", icon: <Cpu className="h-3 w-3" /> },
    { id: 3, label: "Convergence", icon: <Layers className="h-3 w-3" /> },
    { id: 4, label: "Crucible", icon: <ShieldAlert className="h-3 w-3" /> },
    { id: 5, label: "The Reveal", icon: <Sparkles className="h-3 w-3" /> },
    { id: 6, label: "Horizon", icon: <Compass className="h-3 w-3" /> },
  ];

  const scrollToSection = (beatIndex: number) => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targets = [0, 0.14, 0.33, 0.52, 0.72, 0.94];
    window.scrollTo({
      top: totalHeight * targets[beatIndex - 1],
      behavior: "smooth",
    });
  };

  return (
    <div ref={containerRef} className="relative w-full bg-melo-paper text-melo-stone">
      {/* GPU Particle and Bezier Flow Background */}
      <CinemaCanvasBackground
        scrollProgress={scrollProgress}
        activeBeat={activeBeat}
      />

      {/* Floating Story Navigation Pill & Audio Controls */}
      <aside aria-label="Story chapters" className="fixed top-6 right-6 z-40 hidden md:flex items-center gap-3">
        {/* Audio Toggle */}
        <button
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) playTickSound(600, 0.08);
          }}
          className="flex items-center gap-1.5 rounded-full border border-stone-300/80 bg-white/80 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-md shadow-sm hover:text-stone-900 transition-colors cursor-pointer"
          title="Toggle acoustic interaction sound"
        >
          {soundEnabled ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
              <span className="font-mono text-[10px]">SOUND ON</span>
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 text-stone-400" />
              <span className="font-mono text-[10px]">SOUND OFF</span>
            </>
          )}
        </button>

        {/* Chapter Tracker */}
        <nav aria-label="Chapter jump navigation" className="flex items-center gap-1.5 rounded-full border border-stone-300/80 bg-white/80 p-1.5 backdrop-blur-md shadow-sm">
          {chapters.map((ch) => {
            const isActive = activeBeat === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => scrollToSection(ch.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "bg-melo-ink text-amber-300 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>{ch.id}</span>
                {isActive && <span className="text-[10px] font-sans ml-0.5">{ch.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Top Scroll Indicator Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 bg-amber-500 z-50 origin-left pointer-events-none"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Sequential 6-Beat Narrative Experience */}
      <main className="relative z-10">
        <Beat01Fracture progress={scrollProgress} />
        <Beat02Machine />
        <Beat03Convergence />
        <Beat04Crucible />
        <Beat05Reveal />
        <Beat06Horizon />
      </main>
    </div>
  );
}
