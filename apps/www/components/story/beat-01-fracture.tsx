"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Award,
  BookOpen,
  Calendar,
  CreditCard,
  FileCheck,
  GraduationCap,
  HelpCircle,
  Phone,
  Receipt,
  User,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface Beat01FractureProps {
  progress?: number;
  onExploreNext?: () => void;
}

export function Beat01Fracture({ progress = 0, onExploreNext }: Beat01FractureProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 120 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [-300, 300], [8, -8]);
  const rotateY = useTransform(smoothX, [-300, 300], [-8, 8]);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set(e.clientX - innerWidth / 2);
      mouseY.set(e.clientY - innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-20 overflow-hidden perspective-1200 preserve-3d">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-6 flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 px-4 py-1.5 backdrop-blur-md shadow-sm"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-600">
          Chapter 01 — The Fracture
        </span>
      </motion.div>

      {/* Main Core Question */}
      <div className="max-w-4xl text-center z-20 mb-12">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-4xl sm:text-6xl md:text-7xl text-melo-ink leading-[1.08] tracking-tight"
        >
          A school is one institution.
          <br />
          <span className="italic font-light text-stone-500">
            So why does its information live everywhere?
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-4 text-base sm:text-lg text-stone-600 font-light max-w-xl mx-auto"
        >
          One student. Seven disconnected files. When operations fracture across
          WhatsApp, paper slips, and Excel, the school loses its single source of truth.
        </motion.p>
      </div>

      {/* 3D Kinetic Fracture Stage */}
      <motion.div
        style={{ rotateX, rotateY }}
        className="relative w-full max-w-4xl h-[420px] sm:h-[480px] flex items-center justify-center preserve-3d"
      >
        {/* Central Entity: Student Profile Card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative z-20 w-72 sm:w-80 rounded-3xl border border-stone-800 bg-melo-ink text-white p-6 shadow-2xl shadow-stone-950/30 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-amber-400">
                Master Student Record
              </div>
              <h3 className="font-serif text-xl font-medium text-white">Sarah Okon</h3>
              <div className="text-xs text-stone-400">JSS 2 Silver • Reg: 2026/0491</div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-stone-400">Academic Status</span>
              <span className="text-emerald-400 font-semibold">Active Enrollment</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-stone-400">Session</span>
              <span className="text-stone-300">2025/2026 • Term 2</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-400">Data State</span>
              <span className="text-amber-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                Fragmented (7 Silos)
              </span>
            </div>
          </div>
        </motion.div>

        {/* Orbiting Disconnected Data Fragments */}
        {/* Fragment 1: Broadsheet & CA Scores (Top Left) */}
        <motion.div
          animate={{
            x: [-10, 10, -10],
            y: [-160, -175, -160],
            rotate: [-4, -8, -4],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-6 sm:top-2 left-2 sm:left-6 z-10 w-56 rounded-2xl border border-stone-300/80 bg-white/90 p-3.5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-1">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Grade Entry Sheet (Excel)</span>
          </div>
          <p className="text-[11px] font-mono text-stone-600">
            CA1: 18/20 • CA2: 19/20 • CA3: --
            <br />
            <span className="text-red-600">Exam unentered (Result Week delay)</span>
          </p>
        </motion.div>

        {/* Fragment 2: Bursary Outstanding Balance (Top Right) */}
        <motion.div
          animate={{
            x: [10, -10, 10],
            y: [-150, -165, -150],
            rotate: [5, 9, 5],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute -top-4 sm:top-4 right-2 sm:right-6 z-10 w-60 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 mb-1">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Bursary Invoice Ledger</span>
          </div>
          <p className="text-[11px] font-mono text-stone-700">
            Term Bill: ₦185,000
            <br />
            Paid: ₦100,000 • <span className="font-bold text-rose-600">Arrears: ₦85,000</span>
          </p>
        </motion.div>

        {/* Fragment 3: Paystack Payment Receipt (Bottom Left) */}
        <motion.div
          animate={{
            x: [-15, 5, -15],
            y: [160, 175, 160],
            rotate: [-6, -2, -6],
          }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-8 sm:bottom-4 left-0 sm:left-8 z-10 w-56 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 mb-1">
            <Receipt className="h-3.5 w-3.5" />
            <span>Paystack Webhook</span>
          </div>
          <p className="text-[11px] font-mono text-stone-700">
            Ref: PSTK_882910 • ₦100,000
            <br />
            <span className="text-stone-500">Unlinked to student invoice</span>
          </p>
        </motion.div>

        {/* Fragment 4: Guardian WhatsApp & Attendance (Bottom Right) */}
        <motion.div
          animate={{
            x: [15, -5, 15],
            y: [150, 165, 150],
            rotate: [4, 8, 4],
          }}
          transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute -bottom-6 sm:bottom-6 right-0 sm:right-10 z-10 w-56 rounded-2xl border border-stone-300/80 bg-white/90 p-3.5 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-800 mb-1">
            <Phone className="h-3.5 w-3.5 text-amber-600" />
            <span>Parent Communication</span>
          </div>
          <p className="text-[11px] font-mono text-stone-600">
            Dr. Emeka Okon (Guardian)
            <br />
            <span className="text-amber-700">WhatsApp: "Are report cards ready?"</span>
          </p>
        </motion.div>
      </motion.div>

      {/* Bottom Action Relay / Forward Question */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 z-20 flex flex-col items-center gap-3 text-center"
      >
        <p className="text-sm font-medium text-stone-500 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-amber-600" />
          <span>What actually happens underneath a school?</span>
        </p>
        <div className="h-8 w-px bg-gradient-to-b from-stone-400 to-transparent animate-pulse" />
      </motion.div>
    </section>
  );
}
