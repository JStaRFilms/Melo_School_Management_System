"use client";

import { Container, SectionLabel, GoldButton } from "@/site-ui";
import { capabilities } from "@/site";
import { BookOpen, GraduationCap, CreditCard, Users, Zap, Calendar, ShieldCheck, BarChart3, Globe } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const icons = [BookOpen, GraduationCap, CreditCard, Users, Calendar, Zap];

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
            <SectionLabel>Orchestrated Capabilities</SectionLabel>
            <h2 className="mt-8 font-serif text-5xl sm:text-7xl text-melo-ink leading-[1.05] tracking-tight">
              An ecosystem of <br />
              <span className="text-stone-400 italic font-light">operational excellence.</span>
            </h2>
          </div>
          <div className="lg:w-1/2 pt-4">
             <p className="text-xl text-melo-muted font-light leading-relaxed max-w-xl">
               Melo isn&apos;t just a collection of tools. It&apos;s a cohesive environment where every module feeds into the next, ensuring your school runs with precision and grace.
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
                <span className="text-sm font-medium tracking-widest uppercase text-white/60">Academic Command</span>
              </div>
              
              <div className="mt-auto">
                <h3 className="font-serif text-4xl sm:text-6xl mb-8 leading-tight">{capabilities[1].title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
                   <p className="text-stone-400 text-lg sm:text-xl font-light leading-relaxed">
                     {capabilities[1].description}
                   </p>
                   <ul className="space-y-4 text-stone-300">
                      <li className="flex gap-3 items-center">
                         <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                         <span className="text-sm">Automated broadsheets</span>
                      </li>
                      <li className="flex gap-3 items-center">
                         <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                         <span className="text-sm">Cumulative result analysis</span>
                      </li>
                      <li className="flex gap-3 items-center">
                         <div className="h-1.5 w-1.5 rounded-full bg-melo-gold" />
                         <span className="text-sm">Instant report card generation</span>
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
               Integrated fee collection with Paystack, automated invoicing, and real-time financial tracking for stakeholders.
            </p>
            
            <div className="mt-auto pt-8 border-t border-stone-100 grid grid-cols-2 gap-4 text-center">
                <div>
                   <div className="text-2xl font-serif text-melo-ink">₦0</div>
                   <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Unreconciled Fees</div>
                </div>
                <div>
                   <div className="text-2xl font-serif text-melo-ink">Instant</div>
                   <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Billing Cycles</div>
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
               A dedicated mobile-first portal where parents track performance, pay fees, and stay in the loop.
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
               <BarChart3 className="w-5 h-5 text-melo-ink" />
               <h4 className="font-medium tracking-tight text-melo-ink">Operational Insight</h4>
            </div>
            <p className="text-melo-muted text-base leading-relaxed font-light mb-8">
               Advanced analytics for proprietors to monitor enrollment trends, financial health, and academic standards.
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
               Launch your official school portal on your own domain with academic results and admissions built right in.
            </p>
            <div className="mt-auto h-6 w-32 rounded bg-white/20 relative z-10" />
          </div>
        </div>
      </Container>
    </section>
  );
}
