import type { Metadata } from "next";
import { ArrowRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { buildPageMetadata, contactChannels, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description:
    "Use the contact page to call, email, or plan a visit with Cedar Grove Academy admissions.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="One clear place for admissions questions and visit requests."
        description={`${siteBrand.name} keeps contact options simple so families can reach the right person quickly without hunting through the site.`}
        primaryAction={{ label: "Call admissions", href: `tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}` }}
        secondaryAction={{ label: "Email admissions", href: `mailto:${siteBrand.email}` }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Response rhythm</p>
            <div className="space-y-3">
              {[
                { label: "Phone", value: siteBrand.admissionsPhone, icon: Phone },
                { label: "Email", value: siteBrand.email, icon: Mail },
                { label: "Office hours", value: siteBrand.hours, icon: Clock3 },
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
            title="Use the channel that feels easiest for your family."
            description="Call, email, or route your question through the visit page. The goal is a quick, human reply, not a maze of forms."
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
                  "Your child's current class or age group",
                  "Whether you want a visit, fee clarification, or admissions guidance",
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Visit and enquiry CTA</p>
              <h2 className="text-3xl font-semibold text-slate-950">Need to visit before you decide?</h2>
              <p className="text-sm leading-7 text-slate-600">
                The admissions team can help you choose a time, explain the process, and answer practical questions about the school day.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/visit">Plan a visit</ButtonLink>
                <ButtonLink href="/admissions" variant="outline">
                  Review admissions
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>
    </>
  );
}
