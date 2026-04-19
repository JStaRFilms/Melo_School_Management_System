"use client";

import { motion } from "framer-motion";
import { Container, GoldButton, ButtonLink, cn } from "@/site-ui";

export function HeroEvent() {
  return (
    <section className="relative min-h-[95vh] flex flex-col justify-center overflow-hidden bg-melo-ink rounded-b-[40px] sm:rounded-b-[60px]">
      {/* Cinematic Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-800/40 via-melo-ink to-melo-ink" />
        <div className="absolute inset-0 grain opacity-20" />
        
        {/* Soft floating light sources */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.2 }}
          className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] bg-melo-gold/15 rounded-full blur-[120px]" 
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.6 }}
          className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] bg-amber-600/10 rounded-full blur-[100px]" 
        />
      </div>

      <Container className="relative z-10 pt-32 pb-24 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-3 rounded-full border border-stone-800 bg-stone-900/50 px-4 py-1.5 text-xs font-medium tracking-widest text-melo-gold/80 uppercase backdrop-blur-sm shadow-sm ring-1 ring-white/5 disabled:opacity-50">
              <span className="flex h-2 w-2 rounded-full bg-melo-gold" />
              Not a template. An operating system.
            </span>
          </motion.div>

          <motion.h1 
            className="mt-10 font-serif text-5xl leading-[1.05] text-white sm:text-7xl lg:text-[5.5rem] tracking-tight"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Run your school with <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-melo-gold to-amber-600">
              absolute clarity.
            </span>
          </motion.h1>

          <motion.p 
            className="mt-8 max-w-2xl text-lg leading-relaxed text-stone-400 sm:text-xl font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            Admissions, academics, billing, and parent communication. 
            One unified platform built to handle the rigorous complexity of Nigerian school operations.
          </motion.p>

          <motion.div 
            className="mt-12 flex flex-col items-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <GoldButton href="/contact" size="lg" className="h-14 px-8 text-[15px]">
              Book a walkthrough
            </GoldButton>
            <ButtonLink 
              href="/features" 
              variant="ghost" 
              size="lg" 
              className="h-14 px-8 text-[15px] font-medium text-stone-300 hover:text-white hover:bg-stone-800"
            >
              Explore the platform
            </ButtonLink>
          </motion.div>
        </div>
      </Container>

      {/* Fade overlay for bottom edge blending */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-melo-ink pointer-events-none" />
    </section>
  );
}
