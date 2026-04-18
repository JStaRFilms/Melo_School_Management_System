import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Container, GoldButton, SectionLabel } from "@/site-ui";
import { buildPageMetadata, contactMethods, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Book a demo, ask a question, or get in touch with the Melo team. We respond within 24 hours.",
  path: "/contact",
});

const contactIcons = { Email: Mail, Phone: Phone, Office: MapPin } as const;

export default function ContactPage() {
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -top-32 left-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-b from-amber-100/50 to-transparent blur-3xl" />

        <Container className="relative pb-16 pt-20 sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center stagger">
            <div className="animate-fade-up">
              <SectionLabel>Get in touch</SectionLabel>
            </div>
            <h1 className="mt-6 font-serif text-5xl leading-[1.08] text-melo-ink sm:text-6xl lg:text-7xl animate-fade-up">
              Let&apos;s get your school running on Melo.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-melo-muted animate-fade-up">
              Book a 15-minute demo, ask about pricing, or just say hello. 
              We respond within 24 hours.
            </p>
          </div>
        </Container>
      </section>

      {/* ═══════════════ CONTACT GRID ═══════════════ */}
      <section className="border-t border-melo-border py-20 sm:py-28">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            {/* Left: Contact Form */}
            <div className="rounded-2xl border border-melo-border bg-white p-8 sm:p-10">
              <h2 className="font-serif text-3xl text-melo-ink">Book a demo</h2>
              <p className="mt-2 text-sm text-melo-muted">
                Tell us about your school and we&apos;ll schedule a walkthrough.
              </p>

              <form className="mt-8 space-y-5" action="#" method="POST">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                      Your name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      required
                      className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
                      placeholder="Adebayo Johnson"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-school" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                      School name
                    </label>
                    <input
                      id="contact-school"
                      type="text"
                      name="school"
                      required
                      className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
                      placeholder="Greenfield Academy"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
                      placeholder="admin@school.ng"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                      Phone
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
                      placeholder="+234 812 345 6789"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-students" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                    Number of students
                  </label>
                  <select
                    id="contact-students"
                    name="students"
                    className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30 cursor-pointer"
                  >
                    <option value="">Select a range</option>
                    <option value="1-100">1 – 100</option>
                    <option value="101-300">101 – 300</option>
                    <option value="301-800">301 – 800</option>
                    <option value="800+">800+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-wider text-melo-muted">
                    Anything else?
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={4}
                    className="mt-2 w-full resize-none rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
                    placeholder="Tell us about your school's needs..."
                  />
                </div>

                <GoldButton href="#" className="w-full justify-center">
                  Send request
                </GoldButton>
              </form>
            </div>

            {/* Right: Contact Info */}
            <div className="space-y-10 lg:pt-4">
              <div>
                <h3 className="font-serif text-2xl text-melo-ink">Other ways to reach us</h3>
                <p className="mt-2 text-sm leading-relaxed text-melo-muted">
                  Prefer a direct conversation? We&apos;re always happy to hear from school owners.
                </p>
              </div>

              <div className="space-y-6">
                {contactMethods.map((method) => {
                  const Icon = contactIcons[method.label as keyof typeof contactIcons] ?? Mail;
                  return (
                    <a
                      key={method.label}
                      href={method.href}
                      className="group flex items-start gap-4 rounded-xl border border-melo-border bg-white p-5 transition-all duration-300 hover:border-melo-gold/30 hover:shadow-soft cursor-pointer"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-melo-gold/10 text-melo-gold transition-colors duration-300 group-hover:bg-melo-gold group-hover:text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-melo-muted">{method.label}</p>
                        <p className="mt-1 text-base font-medium text-melo-ink">{method.value}</p>
                        <p className="mt-0.5 text-xs text-melo-muted">{method.description}</p>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Office hours note */}
              <div className="rounded-xl border border-dashed border-melo-border bg-stone-50 p-5">
                <p className="text-sm font-medium text-melo-ink">Response time</p>
                <p className="mt-1 text-sm leading-relaxed text-melo-muted">
                  We respond to demo requests within 24 hours. 
                  Phone calls are answered during business hours ({siteBrand.hours}).
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
