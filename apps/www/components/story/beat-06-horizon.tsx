"use client";

import { pricingTiers } from "@/site";
import { GoldButton } from "@/site-ui";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Compass,
  Globe,
  HelpCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React from "react";

export function Beat06Horizon() {
  const relations = [
    { from: "Sarah Okon", to: "JSS 2 Silver", type: "Enrolled In" },
    { from: "JSS 2 Silver", to: "12 Subjects", type: "Taught By" },
    { from: "Mathematics", to: "CA1, CA2, Exam", type: "Calculated As" },
    { from: "Term 2 Broadsheet", to: "1st Position (92.6%)", type: "Ranked" },
    { from: "Paystack #4091", to: "₦85,000 Arrears", type: "Reconciled" },
    { from: "Parent Portal", to: "Dr. Emeka Okon", type: "Verified" },
  ];

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-28 bg-stone-900 text-stone-100 overflow-hidden">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-6 flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800/80 px-4 py-1.5 backdrop-blur-md"
      >
        <Compass className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-300">
          Chapter 06 — The Horizon
        </span>
      </motion.div>

      {/* Relational Web Visual Strand */}
      <div className="w-full max-w-4xl mb-12">
        <div className="text-center mb-6">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
            The Connected Relational Mesh
          </span>
          <p className="text-xs text-stone-400 mt-1">
            Information ceases to be dead records—it becomes a synchronized web of relationships.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-3">
          {relations.map((rel, idx) => (
            <motion.div
              key={rel.from + rel.to}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3.5 py-2 text-xs font-mono"
            >
              <span className="text-white font-semibold">{rel.from}</span>
              <span className="text-[10px] text-amber-400/80 uppercase font-sans">
                → {rel.type} →
              </span>
              <span className="text-stone-300">{rel.to}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* The Final Driving Question */}
      <div className="max-w-4xl text-center mb-16 z-10">
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400 mb-3">
          THE ULTIMATE INQUIRY
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white font-bold tracking-tight leading-tight">
          What could your school do if it stopped managing information —
          <br />
          <span className="text-amber-400 italic font-light">
            and started using it?
          </span>
        </h2>
        <p className="mt-4 text-stone-400 text-sm sm:text-base max-w-2xl mx-auto font-light leading-relaxed">
          When teachers spend zero hours wrestling formulas, bursars spend zero hours chasing
          bank alert slips, and parents have total trust, your institution can focus on what
          actually matters: educating students.
        </p>
      </div>

      {/* Transparent Commercial Pricing Tiers */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {pricingTiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-3xl p-8 border flex flex-col justify-between transition-all duration-300 ${
              tier.highlighted
                ? "border-amber-500/80 bg-stone-950 shadow-2xl shadow-amber-950/40 relative scale-105"
                : "border-stone-800 bg-stone-950/60"
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-950">
                Most Popular
              </div>
            )}

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-stone-400">
                {tier.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-serif text-4xl sm:text-5xl font-bold text-white">
                  {tier.price}
                </span>
                <span className="text-xs font-mono text-stone-400">{tier.period}</span>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-stone-400 font-light leading-relaxed">
                {tier.description}
              </p>

              <div className="my-6 h-px w-full bg-stone-800" />

              <ul className="space-y-3 text-xs font-light text-stone-300">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-4">
              <Link
                href="/contact"
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  tier.highlighted
                    ? "bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-lg"
                    : "bg-stone-800 text-white hover:bg-stone-700"
                }`}
              >
                <span>{tier.cta}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Final Action Hub */}
      <div className="w-full max-w-4xl rounded-3xl border border-stone-800 bg-stone-950/80 p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ca8a04_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <h3 className="font-serif text-3xl sm:text-4xl text-white font-bold mb-4">
          Ready to see your school operate as one?
        </h3>
        <p className="text-stone-400 text-sm sm:text-base max-w-xl mx-auto font-light leading-relaxed mb-8">
          Book a 15-minute live platform walkthrough. We will set up your session, class arms,
          and broadsheet rules live with your real curriculum structure.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <GoldButton href="/contact" size="lg">
            Book a 15-minute demo
          </GoldButton>
          <Link
            href="/features"
            className="flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900 px-8 py-4 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
          >
            <span>Explore All Capabilities</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
