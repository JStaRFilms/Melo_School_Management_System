"use client";

import React, { useRef } from "react";
import { Container } from "@/site-ui";
import { operationalProof, workflowMarkers } from "@/site";
import { InfiniteSlider } from "../../ui/infinite-slider";
import { ProgressiveBlur } from "../../ui/progressive-blur";

export function ProofBand() {
  const containerRef = useRef<HTMLDivElement>(null);

  const trustWords = [
    "ADMISSIONS",
    "ACADEMICS",
    "BILLING",
    "RESULTS",
    "ADMIN",
    "PORTAL",
    "AUDIT",
    "SESSIONS",
    "TERMS",
    "CLASSES",
    "GRADES",
    "FEES",
  ];

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden border-y border-stone-800/50 bg-melo-ink py-24 text-white sm:pb-32 sm:pt-40"
    >
      <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-center opacity-[0.03]">
        <InfiniteSlider duration={70} gap={100} className="py-2">
          {trustWords.map((word) => (
            <span key={word} className="whitespace-nowrap px-10 text-[14vh] font-serif italic">
              {word}
            </span>
          ))}
        </InfiniteSlider>
        <InfiniteSlider duration={60} gap={100} reverse className="py-2">
          {trustWords.map((word) => (
            <span key={word} className="whitespace-nowrap px-10 text-[14vh] font-serif italic">
              {word}
            </span>
          ))}
        </InfiniteSlider>
      </div>

      <ProgressiveBlur
        direction="left"
        className="absolute inset-y-0 left-0 z-10 w-64"
        blurIntensity={0.6}
      />
      <ProgressiveBlur
        direction="right"
        className="absolute inset-y-0 right-0 z-10 w-64"
        blurIntensity={0.6}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[100vh] w-[100vw] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(202,138,4,0.03)_0%,transparent_70%)]" />
      </div>

      <Container className="relative z-20">
        <div className="mb-32 grid grid-cols-1 items-end gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-6">
            <div className="mb-6 inline-flex items-center gap-3 text-melo-gold/80 transition-colors focus-within:text-melo-gold">
              <span className="h-px w-8 bg-melo-gold/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">
                Operational Evidence
              </span>
            </div>

            <h3 className="mb-8 font-serif text-[2.8rem] leading-[1.05] tracking-tight text-white sm:text-6xl">
              Built for Nigerian school{" "}
              <span className="font-light italic text-melo-gold drop-shadow-sm">
                operations
              </span>
              .
            </h3>

            <p className="max-w-xl text-lg font-light leading-relaxed text-stone-300">
              From automated broadsheet compilation and term synchronization to
              complex fee hierarchies and parent transparency, Melo handles the
              operational messiness of real schools with audit-friendly
              precision.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-4 lg:pl-8">
              {operationalProof.map((point, i) => (
                <div
                  key={point.label}
                  className="group relative flex flex-col items-center sm:items-start sm:px-6"
                >
                  {i > 0 ? (
                    <div className="absolute left-0 top-1/2 hidden h-12 w-px -translate-y-1/2 bg-stone-800/60 sm:block" />
                  ) : null}

                  <div className="mb-2.5 flex items-baseline gap-1">
                    <div className="font-serif text-2xl leading-none tracking-tight text-white sm:text-3xl lg:text-[1.75rem]">
                      <span className="relative inline-block">
                        {point.value}
                        <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-melo-gold/15 transition-transform duration-700 group-hover:scale-x-100" />
                      </span>
                    </div>
                  </div>

                  <p className="text-center text-[10px] font-bold uppercase leading-relaxed tracking-[0.25em] text-stone-500 transition-colors duration-500 group-hover:text-stone-300 sm:text-left sm:text-[9px] lg:text-[10px]">
                    {point.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-stone-800/50 pt-20">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-14">
            <div className="flex-shrink-0 rounded-full border border-stone-700/80 bg-stone-950/70 px-6 py-3 text-[10px] font-black uppercase tracking-[0.5em] text-stone-300 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
              Platform Spectrum
            </div>

            <div className="relative flex-grow overflow-hidden rounded-full border border-stone-800/50 bg-stone-950/35 px-6 py-4">
              <InfiniteSlider duration={42} gap={72} className="px-14 py-1 sm:px-16">
                {workflowMarkers.map((marker) => (
                  <div key={marker} className="group flex items-center gap-4 whitespace-nowrap">
                    <div className="h-1.5 w-1.5 rounded-full bg-melo-gold/55 shadow-[0_0_10px_rgba(202,138,4,0.28)] transition-colors group-hover:bg-melo-gold/90" />
                    <span className="text-[14px] font-medium tracking-wide text-stone-300 transition-colors group-hover:text-white">
                      {marker}
                    </span>
                  </div>
                ))}
              </InfiniteSlider>

              <div className="absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0a0907] via-[#0a0907]/85 to-transparent sm:w-20" />
              <div className="absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0a0907] via-[#0a0907]/85 to-transparent sm:w-20" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
