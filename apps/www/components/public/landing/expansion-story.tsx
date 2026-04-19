"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { SectionLabel } from "@/site-ui";

export function ExpansionStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mediaEnd = isMobile ? 0.72 : 0.8;
  const contentStart = isMobile ? 0.58 : 0.75;
  const contentEnd = isMobile ? 0.76 : 0.9;
  const vignetteStart = isMobile ? 0.48 : 0.6;
  const vignetteEnd = isMobile ? 0.8 : 0.9;
  const unityCopy = isMobile
    ? "Bursary, classroom, and admin all update from the same student record."
    : "The bursary, the classroom, and the admin desk all work from the same student record the moment it changes.";
  const trustCopy = isMobile
    ? "Families see published results, balances, and report visibility from one aligned system."
    : "When results, balances, and report visibility agree, families experience a school that feels organized and dependable.";
  const introOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);
  const introY = useTransform(smoothProgress, [0, 0.2], [0, -20]);
  const vignetteOpacity = useTransform(smoothProgress, [vignetteStart, vignetteEnd], [0.24, 0.72]);
  const bridgeLabelOpacity = useTransform(smoothProgress, [0, 0.3], [1, 0]);

  // Media dimensions expansion
  const mediaWidth = useTransform(smoothProgress, [0, mediaEnd], [isMobile ? 320 : 600, isMobile ? 820 : 1400]);
  const mediaHeight = useTransform(smoothProgress, [0, mediaEnd], [isMobile ? 420 : 500, isMobile ? 740 : 800]);
  const borderRadius = useTransform(smoothProgress, [0, mediaEnd], [40, 0]);
  
  // Content appearance
  const contentOpacity = useTransform(smoothProgress, [contentStart, contentEnd], [0, 1]);
  const contentY = useTransform(smoothProgress, [contentStart, 1], [isMobile ? 18 : 30, 0]);
  
  // Background parallax and focus
  const bgScale = useTransform(smoothProgress, [0, 1], [1.05, 1]);
  const bgBlur = useTransform(smoothProgress, [contentStart, contentEnd], ["blur(0px)", "blur(12px)"]);

  if (isMobile) {
    return (
      <section className="bg-melo-paper px-4 py-10">
        <div className="mx-auto max-w-md overflow-hidden rounded-[2rem] border border-melo-border/60 bg-stone-900 shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
          <div className="relative h-[24rem] overflow-hidden border-b border-white/10">
            <Image
              src="/media/unified-operations-still.jpg"
              alt="Unified school operations across academics, billing, approvals, and parent visibility"
              fill
              className="object-cover object-center"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-melo-ink via-melo-ink/55 to-transparent" />
            <div className="absolute inset-x-0 top-6 z-10 px-6 text-center">
              <div className="text-white/75">
                <SectionLabel>The Operational Bridge</SectionLabel>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-7">
              <h2 className="font-serif text-[2.6rem] leading-[0.92] tracking-tight text-white drop-shadow-xl">
                One source of truth
                <br />
                for the whole school.
              </h2>
            </div>
          </div>

          <div className="space-y-5 px-5 pb-28 pt-6 text-white">
            <p className="text-[1.02rem] font-light leading-8 text-stone-300">
              Most schools run across fragmented tools and conflicting records. Melo unifies bursary,
              academics, approvals, and parent visibility into one live operating system, so fees,
              results, and communication move from the same truth.
            </p>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-3xl">
              <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-melo-gold/50 to-transparent" />
              <h3 className="mb-3 font-serif text-[1.8rem] text-melo-gold">Operational Unity</h3>
              <p className="text-[0.98rem] font-light leading-8 text-stone-300">
                Bursary, classroom, and admin all update from the same student record.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-3xl">
              <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-melo-gold/50 to-transparent" />
              <h3 className="mb-3 font-serif text-[1.8rem] text-melo-gold">Parent Trust</h3>
              <p className="text-[0.98rem] font-light leading-8 text-stone-300">
                Families see published results, balances, and report visibility from one aligned system.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-[320svh] bg-melo-paper md:h-[200vh] md:min-h-0">
      <div className="sticky top-0 flex h-[100svh] w-full flex-col items-center justify-start overflow-hidden md:justify-center">
        
        {/* Intro Text */}
        <motion.div 
           style={{ opacity: introOpacity, y: introY }}
           className="absolute top-16 text-center z-20 px-6 md:top-24"
        >
          <SectionLabel>The Operational Bridge</SectionLabel>
          <h2 className="mt-4 font-serif text-3xl sm:text-5xl text-melo-ink max-w-2xl mx-auto leading-tight">
             When the records align, <br/>
             <span className="italic text-melo-gold font-light">the school moves as one.</span>
          </h2>
        </motion.div>

        {/* Expanding Media Container */}
        <motion.div
           style={{
             width: mediaWidth,
             height: mediaHeight,
             borderRadius,
           }}
           className="relative z-10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.3)] border border-melo-border/50 bg-stone-900"
        >
          <motion.div 
            style={{ 
              scale: bgScale,
              filter: bgBlur
            }} 
            className="absolute inset-0"
          >
             <Image 
               src="/media/unified-operations-still.jpg"
               alt="Unified school operations across academics, billing, approvals, and parent visibility"
               fill
               className="object-cover"
               priority
             />
          </motion.div>

          {/* Cinematic Vignette Overlay */}
          <motion.div 
             style={{ opacity: vignetteOpacity }}
             className="absolute inset-0 bg-melo-ink" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-melo-ink via-transparent to-transparent opacity-60" />

          {/* Centered expansion label that fades out */}
          <motion.div 
            style={{ opacity: bridgeLabelOpacity }}
            className="absolute inset-0 flex items-center justify-center"
          >
             <span className="text-white/80 text-sm font-medium tracking-[0.3em] uppercase bg-black/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                The Narrative Bridge
             </span>
          </motion.div>
        </motion.div>

        {/* Final Reveal Content */}
        <motion.div 
           style={{ opacity: contentOpacity, y: contentY }}
           className="absolute inset-0 z-20 flex items-start justify-center pointer-events-none px-6 pb-32 pt-24 md:items-center md:pb-0 md:pt-0"
        >
          <div className="max-w-5xl w-full grid grid-cols-1 gap-6 text-white pointer-events-auto md:grid-cols-2 md:gap-20">
             <div className="flex flex-col justify-center">
                <h3 className="mb-5 font-serif text-[2.65rem] leading-[0.95] tracking-tight drop-shadow-xl sm:text-6xl md:mb-8">
                  One source of truth <br/> for the whole school.
                </h3>
                <p className="max-w-lg text-[1.02rem] font-light leading-8 text-stone-300 sm:text-2xl">
                  Most schools run across fragmented tools and conflicting records. Melo unifies bursary, academics, approvals, and parent visibility into one live operating system, so fees, results, and communication move from the same truth.
                </p>
             </div>
             <div className="flex flex-col gap-5 justify-center md:gap-8">
                <div className="p-6 rounded-[1.75rem] bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-2xl relative overflow-hidden group sm:p-10 sm:rounded-3xl">
                   <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-melo-gold/50 to-transparent" />
                    <h4 className="font-serif text-[1.75rem] mb-3 text-melo-gold sm:text-2xl sm:mb-4">Operational Unity</h4>
                    <p className="text-stone-300 text-[0.98rem] sm:text-lg leading-8 font-light">
                       {unityCopy}
                    </p>
                 </div>
                 <div className="p-6 rounded-[1.75rem] bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-2xl relative overflow-hidden group sm:p-10 sm:rounded-3xl">
                   <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-melo-gold/50 to-transparent" />
                    <h4 className="font-serif text-[1.75rem] mb-3 text-melo-gold sm:text-2xl sm:mb-4">Parent Trust</h4>
                    <p className="text-stone-300 text-[0.98rem] sm:text-lg leading-8 font-light">
                       {trustCopy}
                    </p>
                 </div>
             </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
