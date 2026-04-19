"use client";

import { useEffect, useRef, useState, ReactNode } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Container, SectionLabel } from "@/site-ui";

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

  // Media dimensions expansion
  const mediaWidth = useTransform(smoothProgress, [0, 0.8], [isMobile ? 320 : 600, isMobile ? 800 : 1400]);
  const mediaHeight = useTransform(smoothProgress, [0, 0.8], [isMobile ? 400 : 500, isMobile ? 600 : 800]);
  const borderRadius = useTransform(smoothProgress, [0, 0.8], [40, 0]);
  
  // Content appearance
  const contentOpacity = useTransform(smoothProgress, [0.7, 0.9], [0, 1]);
  const contentY = useTransform(smoothProgress, [0.7, 1], [40, 0]);
  
  // Background parallax
  const bgScale = useTransform(smoothProgress, [0, 1], [1.1, 1]);

  return (
    <div ref={containerRef} className="relative h-[200vh] bg-melo-paper">
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        
        {/* Intro Text */}
        <motion.div 
           style={{ opacity: useTransform(smoothProgress, [0, 0.2], [1, 0]), y: useTransform(smoothProgress, [0, 0.2], [0, -20]) }}
           className="absolute top-24 text-center z-20 px-6"
        >
          <SectionLabel>The Operational Bridge</SectionLabel>
          <h2 className="mt-4 font-serif text-3xl sm:text-5xl text-melo-ink max-w-2xl mx-auto leading-tight">
             From scattered complexity to <br/>
             <span className="italic text-melo-gold font-light">one unified command center.</span>
          </h2>
        </motion.div>

        {/* Expanding Media Container */}
        <motion.div
           style={{
             width: mediaWidth,
             height: mediaHeight,
             borderRadius,
           }}
           className="relative z-10 overflow-hidden shadow-2xl shadow-black/20 border border-melo-border/50 bg-stone-200"
        >
          <motion.div style={{ scale: bgScale }} className="absolute inset-0">
             <Image 
               src="https://images.unsplash.com/photo-1523050335102-c89b1811b127?q=80&w=2070&auto=format&fit=crop"
               alt="School Administration"
               fill
               className="object-cover"
             />
             <div className="absolute inset-0 bg-melo-ink/40 mix-blend-multiply" />
          </motion.div>

          {/* Centered expansion label that fades out */}
          <motion.div 
            style={{ opacity: useTransform(smoothProgress, [0, 0.3], [1, 0]) }}
            className="absolute inset-0 flex items-center justify-center"
          >
             <span className="text-white/80 text-sm font-medium tracking-[0.3em] uppercase bg-black/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                Scroll to expand
             </span>
          </motion.div>
        </motion.div>

        {/* Final Reveal Content */}
        <motion.div 
          style={{ opacity: contentOpacity, y: contentY }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        >
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 text-white pointer-events-auto">
             <div>
                <h3 className="font-serif text-4xl sm:text-5xl mb-6 leading-tight">Serenity found <br/> in the data.</h3>
                <p className="text-stone-300 text-lg sm:text-xl font-light leading-relaxed">
                  No more switching between Excel for results, WhatsApp for communication, and a bank app for fees. Melo puts all your school&apos;s data in conversation.
                </p>
             </div>
             <div className="flex flex-col gap-6 justify-center">
                <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                   <h4 className="font-serif text-xl mb-2 text-melo-gold">Operational Unity</h4>
                   <p className="text-stone-400 text-sm leading-relaxed">
                      Every department — from the bursary to the classroom — operates on the same real-time truth.
                   </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                   <h4 className="font-serif text-xl mb-2 text-melo-gold">Parental Trust</h4>
                   <p className="text-stone-400 text-sm leading-relaxed">
                      Instant results and transparent billing build a level of trust that keeps your enrollment growing.
                   </p>
                </div>
             </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
