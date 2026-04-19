"use client";

import { motion } from "framer-motion";
import { Container, GoldButton, ButtonLink } from "@/site-ui";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-white py-32 sm:py-64">
      {/* Cinematic background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-melo-gold to-transparent opacity-30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100vw] h-[60vw] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-melo-gold/5 via-transparent to-transparent blur-[120px]" />
      </div>
      
      <Container className="relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto"
        >
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="w-20 h-20 mx-auto bg-melo-ink rounded-[2rem] flex items-center justify-center mb-12 shadow-2xl shadow-melo-ink/20 border border-white/5"
          >
             <span className="text-white font-serif text-3xl">M</span>
          </motion.div>
          
          <h2 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-melo-ink leading-[1.05] mb-10 tracking-tight">
             Begin your <br />
             <span className="text-stone-400 italic font-light">serene transition.</span>
          </h2>
          
          <p className="text-melo-muted text-xl sm:text-2xl leading-relaxed mb-16 font-light max-w-2xl mx-auto">
            We handle the engineering. We train your staff. <br className="hidden sm:block" />
            Your school begins running with absolute clarity.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <GoldButton href="/contact" size="lg" className="h-16 px-12 text-base">
              Book a walkthrough
            </GoldButton>
            <ButtonLink href="/pricing" variant="ghost" size="lg" className="h-16 px-12 text-base font-medium text-stone-500 hover:text-melo-ink bg-stone-100 hover:bg-stone-200">
              Explore pricing
            </ButtonLink>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-24 pt-12 border-t border-stone-100 flex flex-wrap justify-center gap-x-12 gap-y-6"
          >
             <div className="flex items-center gap-2 text-stone-400 text-xs font-medium uppercase tracking-widest">
                <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                No implementation fee
             </div>
             <div className="flex items-center gap-2 text-stone-400 text-xs font-medium uppercase tracking-widest">
                <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                Staff training included
             </div>
             <div className="flex items-center gap-2 text-stone-400 text-xs font-medium uppercase tracking-widest">
                <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                Data migration support
             </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
