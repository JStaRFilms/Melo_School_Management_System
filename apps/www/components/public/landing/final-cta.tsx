"use client";

import { motion } from "framer-motion";
import { Container, GoldButton, ButtonLink } from "@/site-ui";
import { GraduationCap } from "lucide-react";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-melo-ink py-32 sm:py-64">
      {/* Institutional visual framing */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-64 bg-gradient-to-b from-melo-gold/40 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140vw] h-[80vw] bg-[radial-gradient(circle_at_center,_rgba(202,138,4,0.08)_0%,transparent_70%)] blur-[100px]" />
        
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('/grid.svg')] [background-size:60px_60px]" />
      </div>
      
      <Container className="relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex justify-center mb-16">
              <div className="relative">
                 <div className="absolute inset-0 bg-melo-gold/20 blur-2xl rounded-full" />
                 <div className="relative h-20 w-20 rounded-[2.5rem] bg-stone-900 border border-white/5 flex items-center justify-center shadow-2xl">
                    <GraduationCap className="w-10 h-10 text-melo-gold" />
                 </div>
              </div>
            </div>
            
            <h2 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-white leading-[1.05] mb-12 tracking-tight">
               Institutional clarity <br />
               <span className="text-stone-500 italic font-light">for your school.</span>
            </h2>
            
            <p className="text-stone-400 text-xl sm:text-2xl leading-relaxed mb-16 font-light max-w-2xl mx-auto">
              Transition from fragmented workflows to a unified command center. We handle the migration, the training, and the engineering—so you can focus on leadership.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 mb-24">
              <GoldButton href="/contact" size="lg" className="h-16 px-12 text-base w-full sm:w-auto">
                Request a walkthrough
              </GoldButton>
              <ButtonLink 
                href="/pricing" 
                variant="ghost" 
                size="lg" 
                className="h-16 px-12 text-base font-medium text-stone-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5"
              >
                View pricing tiers
              </ButtonLink>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 pt-20 border-t border-white/5 text-left">
               <div className="space-y-4">
                  <div className="text-stone-500 text-[10px] uppercase tracking-[0.2em] font-bold">The Handoff</div>
                  <p className="text-sm text-stone-400 font-light leading-relaxed">Full historical data migration from spreadsheets or legacy systems.</p>
               </div>
               <div className="space-y-4">
                  <div className="text-stone-500 text-[10px] uppercase tracking-[0.2em] font-bold">The Training</div>
                  <p className="text-sm text-stone-400 font-light leading-relaxed">On-site and remote training sessions for every admin, teacher, and bursar.</p>
               </div>
               <div className="space-y-4">
                  <div className="text-stone-500 text-[10px] uppercase tracking-[0.2em] font-bold">The Guarantee</div>
                  <p className="text-sm text-stone-400 font-light leading-relaxed">99.9% uptime with dedicated support lines based in Abuja.</p>
               </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
