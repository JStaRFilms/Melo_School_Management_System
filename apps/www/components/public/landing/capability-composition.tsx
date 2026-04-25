"use client";

import { capabilities } from "@/site";
import { Container,GoldButton,SectionLabel } from "@/site-ui";
import { motion,useScroll,useTransform } from "framer-motion";
import { CreditCard,Globe,GraduationCap,ShieldCheck,Users,Zap } from "lucide-react";
import { useRef } from "react";

export function CapabilityComposition() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section ref={containerRef} className="py-32 sm:py-48 bg-white relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <Container>
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start mb-24">
          <div className="lg:w-1/2">
            <SectionLabel>Capabilities</SectionLabel>
            <h2 className="mt-8 font-serif text-5xl sm:text-7xl text-melo-ink leading-[1.05] tracking-tight">
              One system to run <br />
              <span className="text-stone-400 italic font-light">the whole school.</span>
            </h2>
          </div>
          <div className="lg:w-1/2 pt-4">
             <p className="text-xl text-melo-muted font-light leading-relaxed max-w-xl">
               Fragmented tools create fragmented schools. Melo replaces the chaos of disconnected spreadsheets and paper trails with a single, calm operating system designed for the institutional realities of Nigerian education.
             </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Main Hero Block: Academic Excellence */}
          <motion.div 
            style={{ y: y1 }}
            className="md:col-span-8 bg-melo-ink rounded-[2.5rem] p-10 sm:p-16 text-white relative overflow-hidden group shadow-2xl shadow-melo-ink/20"
          >
            <div className="absolute -top-24 -right-24 opacity-10 group-hover:opacity-15 transition-opacity duration-1000">
               <GraduationCap className="w-[500px] h-[500px]" />
            </div>
            
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-4 mb-12">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                   <GraduationCap className="w-6 h-6 text-melo-gold" />
                </div>
                 <span className="text-sm font-medium tracking-widest uppercase text-white/60">Core Engine</span>
              </div>
              
              <div className="mt-auto">
                <h3 className="font-serif text-4xl sm:text-6xl mb-8 leading-tight">{capabilities[1].title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
                   <p className="text-stone-400 text-lg sm:text-xl font-light leading-relaxed">
                     {capabilities[1].description}
                   </p>
                    <ul className="space-y-4 text-stone-400">
                        <li className="flex gap-3 items-center">
                           <div className="h-1 w-1 rounded-full bg-melo-gold" />
                           <span className="text-sm font-light">Automated broadsheets with class-specific logic</span>
                        </li>
                        <li className="flex gap-3 items-center">
                           <div className="h-1 w-1 rounded-full bg-melo-gold" />
                           <span className="text-sm font-light">Cumulative performance & session-over-session trends</span>
                        </li>
                        <li className="flex gap-3 items-center">
                           <div className="h-1 w-1 rounded-full bg-melo-gold" />
                           <span className="text-sm font-light">Bespoke, brand-aligned report card generation</span>
                        </li>
                     </ul>
                </div>
                <GoldButton href="/features" className="w-full sm:w-auto h-14 px-10">Explore Academics</GoldButton>
              </div>
            </div>
          </motion.div>

          {/* Secondary Block: Financial Trust */}
          <motion.div 
            style={{ y: y2 }}
            className="md:col-span-4 bg-white rounded-[2.5rem] p-10 border border-melo-border shadow-xl shadow-black/5 flex flex-col group"
          >
            <div className="h-14 w-14 rounded-2xl bg-melo-gold/10 flex items-center justify-center mb-10 border border-melo-gold/20">
               <CreditCard className="w-7 h-7 text-melo-gold" />
            </div>
            
            <h3 className="font-serif text-3xl text-melo-ink mb-6">{capabilities[2].title}</h3>
             <p className="text-melo-muted text-lg leading-relaxed mb-10 font-light">
               Automate invoices, track payments via Paystack, and generate digital receipts that reconcile instantly with your bursary records.
             </p>
            
            <div className="mt-auto pt-8 border-t border-stone-100 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-1">Reconciliation</span>
                   <span className="text-xl font-serif text-melo-ink italic">Zero leakage</span>
                </div>
                <div className="flex flex-col text-right">
                   <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-1">Status</span>
                   <span className="text-xl font-serif text-melo-ink italic">Audit-Ready</span>
                </div>
            </div>
          </motion.div>

          {/* Fragment Row 2 */}
          <div className="md:col-span-4 bg-stone-50 rounded-[2.5rem] p-10 border border-melo-border/50 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
               <Users className="w-5 h-5 text-melo-ink" />
               <h4 className="font-medium tracking-tight text-melo-ink">{capabilities[4].title}</h4>
            </div>
             <p className="text-melo-muted text-base leading-relaxed font-light mb-8">
               Give parents instant access to results, invoices, and attendance—reducing office calls and building long-term trust.
             </p>
            <div className="mt-auto flex -space-x-3">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-10 w-10 rounded-full border-2 border-stone-50 bg-stone-200" />
               ))}
               <div className="h-10 px-3 rounded-full border-2 border-stone-50 bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-500 uppercase">
                  +1.2k Parents
               </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-stone-50 rounded-[2.5rem] p-10 border border-melo-border/50 flex flex-col">
             <div className="flex items-center gap-3 mb-8">
               <ShieldCheck className="w-5 h-5 text-melo-ink" />
               <h4 className="font-medium tracking-tight text-melo-ink">{capabilities[3].title}</h4>
            </div>
            <p className="text-melo-muted text-base leading-relaxed font-light mb-8">
               Coordinate staff with structured approval workflows for results, expenses, and records across every session.
            </p>
            <div className="mt-auto grid grid-cols-4 items-end gap-1.5 h-16">
               <div className="h-[40%] bg-stone-200 rounded-sm" />
               <div className="h-[70%] bg-stone-300 rounded-sm" />
               <div className="h-[55%] bg-stone-200 rounded-sm" />
               <div className="h-[90%] bg-melo-gold rounded-sm" />
            </div>
          </div>

          <div className="md:col-span-4 bg-melo-gold rounded-[2.5rem] p-10 text-white flex flex-col overflow-hidden relative">
            <Globe className="absolute -bottom-10 -right-10 w-40 h-40 opacity-20" />
            <div className="flex items-center gap-3 mb-8">
               <Zap className="w-5 h-5 text-white" />
               <h4 className="font-medium tracking-tight whitespace-nowrap">{capabilities[5].title}</h4>
            </div>
             <p className="text-white/80 text-base leading-relaxed font-light mb-8 relative z-10">
               A professional public-facing site that syncs admissions and results directly from your management dashboard.
             </p>
            <div className="mt-auto h-6 w-32 rounded bg-white/20 relative z-10" />
          </div>
        </div>
      </Container>
    </section>
  );
}
