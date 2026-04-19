"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Container } from "@/site-ui";
import { trustPoints } from "@/site";
import { useRef } from "react";

export function ProofBand() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <section ref={containerRef} className="bg-melo-ink py-20 sm:py-32 text-white border-y border-stone-800 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-stone-500 to-transparent" />
      </div>

      <Container className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-center">
          <div>
            <h3 className="font-serif text-3xl sm:text-5xl text-melo-gold mb-6 leading-tight">
               Built for Nigerian school <br/> operational scale.
            </h3>
            <p className="text-stone-400 text-lg font-light leading-relaxed max-w-md">
              Melo runs on high-availability infrastructure with geographical redundancy, ensuring your school never stops — no matter the load.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-12 sm:gap-20">
            {trustPoints.map((point, i) => (
              <motion.div 
                key={point.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <div className="text-5xl sm:text-6xl font-light tracking-tight text-white mb-3">
                   {point.metric}
                </div>
                <div className="text-xs uppercase tracking-[0.3em] text-melo-gold font-bold">
                  {point.label}
                </div>
                <div className="mt-4 h-1 w-8 bg-stone-800" />
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
      
      {/* Background parallax text for "premium" feel */}
      <motion.div 
         style={{ x }}
         className="absolute bottom-0 left-0 whitespace-nowrap text-[15vh] font-serif text-white/[0.02] pointer-events-none select-none italic"
      >
        Reliability Trust Integrity Growth Scale Clarity Excellence
      </motion.div>
    </section>
  );
}
