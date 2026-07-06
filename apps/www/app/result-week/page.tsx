import type { Metadata } from "next";
import { CheckCircle2, ClipboardEdit, Sliders, FileSpreadsheet } from "lucide-react";
import { Container, SectionLabel } from "@/site-ui";
import { buildPageMetadata } from "@/site";
import { ContactForm } from "../../components/public/contact/contact-form";

export const metadata: Metadata = buildPageMetadata({
  title: "Result Week Workflows",
  description:
    "Melo helps teachers enter scores, apply your school's grading rules, and preview report cards from one clean workflow.",
  path: "/result-week",
});

export default function ResultWeekPage() {
  const sections = [
    {
      title: "Score entry without the friction",
      description:
        "Give teachers a clean, structured interface to input scores, featuring validation checks to help catch and prevent entry errors.",
      Icon: ClipboardEdit,
      bullets: [
        "Validation checks to ensure scores stay within set limits",
        "Draft saving to help secure entered marks as you go",
        "Progress indicators to track completed score entries",
      ],
    },
    {
      title: "Grading rules that run themselves",
      description:
        "Define your school's custom grading tiers, weightings, and remarks in one place, allowing Melo to apply them consistently across all students.",
      Icon: Sliders,
      bullets: [
        "Support for standard primary and secondary grading scales",
        "Systematic calculation of class averages and cumulative performance",
        "Structured calculations for pass/fail and promotion metrics",
      ],
    },
    {
      title: "Real-time report card previewing",
      description:
        "Preview draft report cards to check layout and formatting before finalizing your school's records.",
      Icon: FileSpreadsheet,
      bullets: [
        "PDF drafts generated for preview within the workspace",
        "Flexible configuration for attendance, principal comments, and school logos",
        "Compilation helpers to view multi-term academic results",
      ],
    },
  ];

  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden bg-stone-900 text-white rounded-b-[40px] sm:rounded-b-[60px]">
        {/* Visual elements */}
        <div className="pointer-events-none absolute inset-0 grain opacity-20" />
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-b from-amber-500/10 to-transparent blur-3xl" />
        
        <Container className="relative pb-24 pt-28 sm:pb-32 sm:pt-40">
          <div className="mx-auto max-w-4xl text-center stagger">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-3 rounded-full border border-stone-800 bg-stone-950/80 px-4 py-1.5 text-xs font-medium tracking-wide text-melo-gold backdrop-blur-sm shadow-sm ring-1 ring-white/5 mb-8">
                <span className="flex h-2 w-2 rounded-full bg-melo-gold animate-pulse" />
                Result-week workflow
              </span>
            </div>
            <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.5rem] animate-fade-up">
              Result week doesn&apos;t have to scatter your school.
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-relaxed text-stone-300 sm:text-xl animate-fade-up">
              Melo helps teachers enter scores, apply your school&apos;s grading rules, and preview report cards from one clean workflow.
            </p>
            <div className="mt-12 animate-fade-up">
              <a
                href="#book-walkthrough"
                className="inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 cursor-pointer h-14 px-8 text-[15px] bg-melo-gold text-white hover:bg-amber-600 shadow-glow hover:shadow-[0_0_64px_rgba(202,138,4,0.25)] hover:-translate-y-px active:translate-y-0"
              >
                Book a result-week walkthrough
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════ DETAILED SECTIONS ═══════════════ */}
      <section className="py-24 sm:py-32 bg-stone-50">
        <Container>
          <div className="space-y-24 sm:space-y-32">
            {sections.map((section, idx) => {
              const Icon = section.Icon;
              const isEven = idx % 2 === 0;
              return (
                <div
                  key={section.title}
                  className="grid gap-12 lg:grid-cols-2 lg:items-center"
                >
                  {/* Text Content */}
                  <div className={isEven ? "lg:pr-8" : "lg:pl-8"}>
                    <div className="h-12 w-12 rounded-xl bg-melo-gold/10 flex items-center justify-center mb-6 border border-melo-gold/20">
                      <Icon className="w-6 h-6 text-melo-gold" />
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl text-melo-ink leading-tight">
                      {section.title}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-melo-muted font-light">
                      {section.description}
                    </p>
                    <ul className="mt-8 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm text-melo-stone font-medium">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-melo-gold" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual card placeholder resembling app UI */}
                  <div className="rounded-2xl border border-melo-border bg-white p-8 shadow-sm flex flex-col justify-center min-h-[300px] border-stone-200">
                    <div className="w-full space-y-4">
                      {idx === 0 && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-semibold text-stone-400 uppercase tracking-widest">
                            <span>Score Entry Status</span>
                            <span className="text-melo-gold">85% Completed</span>
                          </div>
                          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-melo-gold rounded-full w-[85%]" />
                          </div>
                          <div className="space-y-2 mt-4 pt-4 border-t border-stone-100">
                            <div className="flex justify-between items-center text-sm p-2 bg-stone-50 rounded-lg">
                              <span className="font-medium text-stone-800">CA 1 (15 Marks)</span>
                              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Valid</span>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 bg-stone-50 rounded-lg">
                              <span className="font-medium text-stone-800">CA 2 (15 Marks)</span>
                              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Valid</span>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 bg-stone-50 rounded-lg border-2 border-red-200">
                              <span className="font-medium text-stone-800">Exam (70 Marks)</span>
                              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded">Out of bounds (85/70)</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {idx === 1 && (
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Grading Scale Preview</div>
                          <div className="grid grid-cols-5 gap-2 text-center text-xs">
                            <div className="p-2 bg-stone-50 border border-stone-100 rounded">
                              <div className="font-bold text-stone-800">A1</div>
                              <div className="text-stone-400">75-100</div>
                            </div>
                            <div className="p-2 bg-stone-50 border border-stone-100 rounded">
                              <div className="font-bold text-stone-800">B2</div>
                              <div className="text-stone-400">70-74</div>
                            </div>
                            <div className="p-2 bg-stone-50 border border-stone-100 rounded">
                              <div className="font-bold text-stone-800">B3</div>
                              <div className="text-stone-400">65-69</div>
                            </div>
                            <div className="p-2 bg-stone-50 border border-stone-100 rounded">
                              <div className="font-bold text-stone-800">C4</div>
                              <div className="text-stone-400">60-64</div>
                            </div>
                            <div className="p-2 bg-stone-50 border border-stone-100 rounded">
                              <div className="font-bold text-stone-800">F9</div>
                              <div className="text-stone-400">0-39</div>
                            </div>
                          </div>
                          <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl mt-4">
                            <p className="text-xs text-amber-800 leading-relaxed">
                              💡 Changing the scale backfills statistics, averages, and ranks across all classes instantly.
                            </p>
                          </div>
                        </div>
                      )}
                      {idx === 2 && (
                        <div className="space-y-3 border-2 border-stone-100 rounded-xl p-4 bg-stone-50/50">
                          <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-melo-gold flex items-center justify-center text-white text-[10px] font-bold">M</div>
                              <span className="text-xs font-bold text-stone-800">Melo Report Card Draft</span>
                            </div>
                            <span className="text-[10px] bg-stone-200 px-2 py-0.5 rounded font-bold text-stone-600">PREVIEW</span>
                          </div>
                          <div className="text-[10px] text-stone-500 space-y-1">
                            <div className="flex justify-between"><span>Student:</span> <span className="font-semibold text-stone-800">Chidi Obi</span></div>
                            <div className="flex justify-between"><span>Class:</span> <span className="font-semibold text-stone-800">JSS 2 Gold</span></div>
                            <div className="flex justify-between"><span>Cumulative Average:</span> <span className="font-semibold text-stone-800">82.4%</span></div>
                            <div className="flex justify-between"><span>Rank:</span> <span className="font-semibold text-stone-800">3rd of 28</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══════════════ CONTACT SECTION ═══════════════ */}
      <section id="book-walkthrough" className="relative overflow-hidden border-t border-melo-border bg-white py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 grain opacity-5" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-t from-amber-100/30 to-transparent blur-3xl" />
        
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <SectionLabel>Get Started</SectionLabel>
              <h2 className="mt-4 font-serif text-4xl text-melo-ink leading-tight">
                Say goodbye to result-week chaos.
              </h2>
              <p className="mt-4 text-melo-muted text-base leading-relaxed font-light">
                Leave your details below. We&apos;ll schedule a walkthrough showing you how Melo runs result-week with absolute clarity.
              </p>
            </div>
            
            <ContactForm campaign="result-week" title="Book a walkthrough" subtitle="Tell us about your school to customize your walkthrough." />
          </div>
        </Container>
      </section>
    </>
  );
}
