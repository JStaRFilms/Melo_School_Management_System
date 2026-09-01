"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  HelpCircle,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Clock,
  Smartphone,
  FileSpreadsheet,
} from "lucide-react";
import { Container, GoldButton, ButtonLink, SectionLabel } from "@/site-ui";
import { Card3DTilt } from "../ui/card-3d-tilt";
import { ArchitecturalDraftingCanvas } from "../story/architectural-drafting-canvas";
import { playTick } from "../../lib/audio-feedback";
import { pricingTiers, platformAddOns } from "@/site";

interface FeatureRow {
  name: string;
  core: boolean | string;
  standard: boolean | string;
  enterprise: boolean | string;
}

interface FeatureCategory {
  category: string;
  features: FeatureRow[];
}

const DETAILED_FEATURE_MATRIX: FeatureCategory[] = [
  {
    category: "Academic Records & Broadsheets",
    features: [
      { name: "Continuous assessment (CA1, CA2, Exams)", core: true, standard: true, enterprise: true },
      { name: "Automated broadsheet compilation (0.4s)", core: true, standard: true, enterprise: true },
      { name: "WAEC / NECO 9-point grading scales", core: true, standard: true, enterprise: true },
      { name: "Printable student report cards & slips", core: true, standard: true, enterprise: true },
      { name: "Class ranking & cumulative averages", core: true, standard: true, enterprise: true },
      { name: "Bespoke custom curriculum rules", core: false, standard: false, enterprise: true },
    ],
  },
  {
    category: "Bursary & Fee Management",
    features: [
      { name: "Term fee structures & invoice generation", core: "Manual receipts", standard: true, enterprise: true },
      { name: "Paystack online card & USSD payments", core: false, standard: true, enterprise: true },
      { name: "Providus dedicated virtual bank accounts", core: false, standard: true, enterprise: true },
      { name: "Automated invoice-payment reconciliation", core: false, standard: true, enterprise: true },
      { name: "Real-time debt aging & arrears tracking", core: "Basic", standard: true, enterprise: true },
      { name: "Multi-campus financial consolidation", core: false, standard: false, enterprise: true },
    ],
  },
  {
    category: "Parent & Student Connectivity",
    features: [
      { name: "Parent mobile web portal (zero app install)", core: false, standard: true, enterprise: true },
      { name: "Direct report card access via student PIN", core: false, standard: true, enterprise: true },
      { name: "WhatsApp & SMS payment receipt alerts", core: false, standard: true, enterprise: true },
      { name: "1-Click WhatsApp payment reminders", core: false, standard: true, enterprise: true },
    ],
  },
  {
    category: "Governance, Security & Support",
    features: [
      { name: "Role-based access (Teachers, Bursar, Principal)", core: true, standard: true, enterprise: true },
      { name: "100% Excel broadsheet & ledger export", core: true, standard: true, enterprise: true },
      { name: "Tenant-isolated database & daily backups", core: true, standard: true, enterprise: true },
      { name: "Staff onboarding workshop & setup support", core: "Standard", standard: "Dedicated", enterprise: "Dedicated SLA" },
      { name: "Custom domain & branded school website", core: "Add-on", standard: "Included Starter", enterprise: "Full Custom" },
    ],
  },
];

const FAQS = [
  {
    q: "What is included in the one-time setup fee?",
    a: "We configure your school's academic sessions, terms, class arms, subjects, custom grading bands (WAEC/NECO), fee structures, and staff accounts. We also import your past student spreadsheets so you start with zero blank screens.",
  },
  {
    q: "Can our student enrollment change mid-term?",
    a: "Yes. You are billed based on your active enrolled student count at the start of each term. If enrollment expands significantly mid-term, changes are pro-rated into your next term statement.",
  },
  {
    q: "How does Paystack & Providus fee collection work?",
    a: "Parents receive direct Paystack payment links and dedicated virtual account numbers on their term invoices. When they pay, the funds settle directly into your school's dedicated merchant bank account with zero manual matching required.",
  },
  {
    q: "Can we export our broadsheets and student records to Excel?",
    a: "Yes, at any time with a single click. You own 100% of your school's data. You can download complete broadsheets (.xlsx), student profiles, and general bursary ledgers without restriction.",
  },
  {
    q: "Do parents or teachers need to download an app?",
    a: "No. Melo runs natively in any standard smartphone, tablet, or desktop web browser. Parents access their child's verified results and fee receipts directly via mobile web with a secure student PIN.",
  },
];

export function CleanPricingExperience() {
  const [studentCount, setStudentCount] = useState(350);
  const [billingCycle, setBillingCycle] = useState<"termly" | "annual">("termly");
  const [showMatrix, setShowMatrix] = useState(false);

  // Rate calculations
  const isAnnual = billingCycle === "annual";
  const coreRate = isAnnual ? 900 : 1000;
  const standardRate = isAnnual ? 1080 : 1200;
  const enterpriseRate = isAnnual ? 1350 : 1500;

  // Selected plan calculation based on slider
  const recommendedTier =
    studentCount <= 200 ? "Core Operations" : studentCount <= 800 ? "Standard" : "Enterprise";

  const currentRate =
    studentCount <= 200 ? coreRate : studentCount <= 800 ? standardRate : enterpriseRate;
  const calculatedTermTotal = studentCount * currentRate;

  return (
    <div className="relative w-full bg-[#FAF9F5] text-stone-900 font-sans selection:bg-amber-500/20 selection:text-stone-950 min-h-screen overflow-x-hidden">
      {/* High-DPI Subtle Architectural Grid Canvas */}
      <ArchitecturalDraftingCanvas />

      {/* ─────────────────────────────────────────────────────────────
          1. HERO & NARRATIVE STATEMENT
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 sm:pt-36 pb-12 sm:pb-16 px-4 sm:px-8 max-w-5xl mx-auto text-center z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/30 bg-amber-50 px-3.5 py-1 text-xs font-mono font-semibold text-amber-800">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Transparent Per-Student Pricing</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-stone-900 leading-[1.08]">
            Simple plans. <span className="text-stone-700 italic font-normal">Real institutional value.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-600 font-light leading-relaxed">
            Pay strictly for the students you teach. No hidden scratch card markups, no per-SMS charges, and 100% data ownership for your school.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. INTERACTIVE STUDENT SCALE & COST PREVIEW BAR
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-10 sm:mt-12 max-w-3xl mx-auto rounded-3xl border border-stone-300 bg-white/95 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-mono uppercase tracking-wider text-stone-600 font-semibold">
                  School Enrollment Scale
                </span>
              </div>
              <div className="font-serif text-3xl font-bold text-stone-900 mt-1">
                {studentCount.toLocaleString()}{" "}
                <span className="text-sm font-sans font-normal text-stone-500">Students</span>
              </div>
            </div>

            {/* Billing Cycle Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-stone-100 border border-stone-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  playTick("click");
                  setBillingCycle("termly");
                }}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                  billingCycle === "termly"
                    ? "bg-white text-stone-950 font-bold shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Termly (3 Terms/Yr)
              </button>
              <button
                type="button"
                onClick={() => {
                  playTick("click");
                  setBillingCycle("annual");
                }}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span>Annual Session</span>
                <span className="text-[9px] bg-amber-200 text-stone-950 font-bold px-1 rounded">
                  Save 10%
                </span>
              </button>
            </div>
          </div>

          {/* Slider */}
          <div className="pt-5 space-y-3">
            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={studentCount}
              onChange={(e) => {
                playTick("soft");
                setStudentCount(parseInt(e.target.value));
              }}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-none"
            />

            <div className="flex justify-between text-[11px] font-mono text-stone-500">
              <span>Small Academy (50–200)</span>
              <span>Mid-Size School (201–800)</span>
              <span>Multi-Campus (800+)</span>
            </div>
          </div>

          {/* Live Calculated Estimate Pill */}
          <div className="mt-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-800 font-bold">
                Estimated Term Investment
              </div>
              <div className="font-serif text-2xl font-bold text-stone-900 mt-0.5">
                ₦{calculatedTermTotal.toLocaleString()}{" "}
                <span className="text-xs font-sans font-normal text-stone-500">
                  /term total for {studentCount} students
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-stone-600">
                Matched: <strong className="text-stone-900">{recommendedTier}</strong>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                @ ₦{currentRate.toLocaleString()}/student
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. 3 TIER PRICING CARDS
      ───────────────────────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-8 pb-16 z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {pricingTiers.map((tier) => {
            const isMatched = tier.name === recommendedTier;
            const rate =
              tier.name === "Core Operations"
                ? coreRate
                : tier.name === "Standard"
                ? standardRate
                : enterpriseRate;

            return (
              <Card3DTilt key={tier.name} maxTilt={4} className="h-full">
                <div
                  className={`relative flex flex-col rounded-3xl border p-7 sm:p-8 transition-all duration-300 h-full justify-between ${
                    tier.highlighted
                      ? "border-stone-900 bg-stone-900 text-white shadow-xl scale-[1.02] ring-1 ring-amber-500/40"
                      : "border-stone-200 bg-white text-stone-900 hover:border-stone-300 shadow-sm"
                  }`}
                >
                  {/* Highlight Badge */}
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider text-stone-950 shadow-md">
                      Most Popular
                    </div>
                  )}

                  {isMatched && !tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-800 border border-stone-700 px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 shadow-sm">
                      Recommended for Your Scale
                    </div>
                  )}

                  {/* Header */}
                  <div>
                    <div
                      className={`text-xs font-mono uppercase tracking-[0.2em] font-bold ${
                        tier.highlighted ? "text-amber-400" : "text-amber-700"
                      }`}
                    >
                      {tier.name}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-serif text-4xl sm:text-5xl font-bold">
                        ₦{rate.toLocaleString()}
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          tier.highlighted ? "text-stone-400" : "text-stone-500"
                        }`}
                      >
                        /student /term
                      </span>
                    </div>

                    <div
                      className={`text-xs font-mono mt-1 ${
                        tier.highlighted ? "text-stone-400" : "text-stone-500"
                      }`}
                    >
                      {tier.setupFee}
                    </div>

                    <p
                      className={`mt-3 text-xs sm:text-sm leading-relaxed font-light ${
                        tier.highlighted ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      {tier.description}
                    </p>

                    <div
                      className={`my-6 h-px ${
                        tier.highlighted ? "bg-stone-800" : "bg-stone-100"
                      }`}
                    />

                    {/* Features List */}
                    <ul className="space-y-3 text-xs sm:text-sm font-light">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check
                            className={`h-4 w-4 shrink-0 mt-0.5 ${
                              tier.highlighted ? "text-amber-400" : "text-emerald-600"
                            }`}
                          />
                          <span className={tier.highlighted ? "text-stone-200" : "text-stone-700"}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-8 pt-4">
                    {tier.highlighted ? (
                      <GoldButton href="/contact" className="w-full justify-center">
                        {tier.cta}
                      </GoldButton>
                    ) : (
                      <ButtonLink
                        href="/contact"
                        variant="outline"
                        className="w-full justify-center"
                      >
                        {tier.cta}
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </Card3DTilt>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. COMMERCIAL ADD-ON SERVICES
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-14 rounded-3xl border border-stone-200 bg-white/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Optional Commercial Add-Ons
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-light mb-6">
            Attach specialized setup services to your onboarding package as your school requires:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {platformAddOns.map((addon) => (
              <div
                key={addon.name}
                className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 font-bold bg-amber-100/70 px-2 py-0.5 rounded">
                    {addon.tag}
                  </span>
                  <h4 className="font-sans font-bold text-stone-900 text-sm mt-2">
                    {addon.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed font-light">
                    {addon.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            5. FULL FEATURE COMPARISON TABLE (COLLAPSIBLE)
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => {
              playTick("click");
              setShowMatrix(!showMatrix);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-sm cursor-pointer"
          >
            <span>{showMatrix ? "Hide Full Feature Comparison" : "Compare All Features & Boundaries"}</span>
            <ChevronDown
              className={`h-4 w-4 text-stone-500 transition-transform duration-200 ${
                showMatrix ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {showMatrix && (
          <div className="mt-8 rounded-3xl border border-stone-300 bg-white p-6 sm:p-8 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs font-sans min-w-[600px]">
              <thead>
                <tr className="border-b border-stone-200 text-stone-900 font-mono text-[11px] uppercase tracking-wider">
                  <th className="pb-4 font-bold">Feature / Capability</th>
                  <th className="pb-4 font-bold text-center">Core</th>
                  <th className="pb-4 font-bold text-center text-amber-700">Standard</th>
                  <th className="pb-4 font-bold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {DETAILED_FEATURE_MATRIX.map((group) => (
                  <React.Fragment key={group.category}>
                    <tr className="bg-stone-50">
                      <td colSpan={4} className="py-2.5 px-3 font-mono font-bold text-[11px] text-stone-900 uppercase">
                        {group.category}
                      </td>
                    </tr>
                    {group.features.map((f) => (
                      <tr key={f.name} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-3 text-stone-800 font-medium">{f.name}</td>
                        <td className="py-3 px-3 text-center">
                          {typeof f.core === "boolean" ? (
                            f.core ? (
                              <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-stone-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-[10px] text-stone-500">{f.core}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center bg-amber-50/30">
                          {typeof f.standard === "boolean" ? (
                            f.standard ? (
                              <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-stone-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-[10px] text-amber-800 font-bold">{f.standard}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {typeof f.enterprise === "boolean" ? (
                            f.enterprise ? (
                              <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-stone-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-[10px] text-stone-700 font-semibold">{f.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. COMMON QUESTIONS (FAQ)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-stone-200 bg-white py-16 sm:py-24 z-10">
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <SectionLabel>Questions</SectionLabel>
              <h2 className="mt-4 font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
                Common questions, straight answers.
              </h2>
            </div>

            <div className="mt-12 space-y-0 divide-y divide-stone-200">
              {FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group py-5 cursor-pointer"
                >
                  <summary className="flex items-center justify-between text-base font-medium text-stone-900 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span>{faq.q}</span>
                    <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs text-stone-500 transition-transform duration-300 group-open:rotate-45 group-open:border-amber-600 group-open:text-amber-600">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FINAL CONVERSION & ONBOARDING PROMISE
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-stone-200 bg-[#FAF9F5] py-20 sm:py-28 z-10">
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center space-y-5">
            <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
              Bring your school structure. <span className="text-amber-700">We will configure it live.</span>
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-stone-600 font-light leading-relaxed">
              Book a 15-minute live platform walkthrough. We will set up your session, class arms, grading rules, and student records with your real curriculum.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <GoldButton href="/contact" size="lg">
                Book a 15-minute demo
              </GoldButton>
              <Link
                href="/features"
                onClick={() => playTick("click")}
                className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-sm font-medium text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer shadow-sm"
              >
                <span>Explore Platform Features</span>
                <ArrowRight className="h-4 w-4 text-stone-400" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
