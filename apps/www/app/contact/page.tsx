import type { Metadata } from "next";
import { ArrowRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { buildPageMetadata, contactChannels, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Use the contact page to reach the SchoolOS team about fit, rollout, and commercial questions.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="One clear place for product questions and demo requests."
        description={`${siteBrand.name} keeps contact options simple so school teams can reach the right person quickly.`}
        primaryAction={{ label: "Request a demo", href: "/visit" }}
        secondaryAction={{ label: "Review packages", href: "/fees" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Response rhythm</p>
            <div className="space-y-3">
              {[
                { label: "Phone", value: siteBrand.phone, icon: Phone },
                { label: "Email", value: siteBrand.email, icon: Mail },
                { label: "Hours", value: siteBrand.hours, icon: Clock3 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <Icon className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        }
      />

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="Contact options"
            title="Use the channel that feels easiest for your team."
            description="Call, email, or route your question through the demo page. The goal is a quick, human reply."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {contactChannels.map((channel) => (
              <SurfaceCard key={channel.label} className="space-y-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                  {channel.label.includes("line") ? <Phone className="h-5 w-5" /> : channel.label.includes("email") ? <Mail className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{channel.label}</p>
                  <p className="text-sm leading-7 text-slate-700">{channel.value}</p>
                  <ButtonLink href={channel.href} variant="outline" className="mt-2 w-fit">
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </ButtonLink>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What to include in your message</p>
              <h2 className="text-3xl font-semibold text-slate-950">Help us answer you faster.</h2>
              <div className="space-y-3">
                {[
                  "The school's current operating setup",
                  "Whether you want a demo, commercial clarification, or rollout guidance",
                  "A phone number or email address that works for you",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <ArrowRight className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Demo and enquiry CTA</p>
              <h2 className="text-3xl font-semibold text-slate-950">Need to see the product before deciding?</h2>
              <p className="text-sm leading-7 text-slate-600">
                The team can help you choose a time, explain the setup path, and answer practical questions about the platform.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/visit">Plan a demo</ButtonLink>
                <ButtonLink href="/about" variant="outline">
                  Read overview
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>
    </>
  );
}
