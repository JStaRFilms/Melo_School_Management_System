"use client";

import React, { useState } from "react";
import { ArrowRight, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/site-ui";

interface ContactFormProps {
  campaign?: string;
  title?: string;
  subtitle?: string;
}

export function ContactForm({
  campaign,
  title = "Book a demo",
  subtitle = "Tell us about your school and we'll schedule a walkthrough.",
}: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    school: "",
    email: "",
    phone: "",
    students: "",
    message: "",
    website: "", // honeypot
  });

  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("pending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          campaign,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setFormData({
          name: "",
          school: "",
          email: "",
          phone: "",
          students: "",
          message: "",
          website: "",
        });
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your internet connection.");
    }
  };

  const whatsappNumber = "2348152657887";
  const whatsappText = campaign 
    ? `Hello Melo team, I'd like to book a walkthrough for result-week.`
    : `Hello Melo team, I'd like to book a demo for my school.`;
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-8 text-center shadow-sm [color-scheme:light] sm:p-10 animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle className="h-10 w-10" />
        </div>
        <h3 className="mt-6 font-serif text-3xl text-stone-900">Request received!</h3>
        <p className="mt-4 text-base text-stone-600">
          Thank you for reaching out. A member of our team will get in touch shortly to schedule your walkthrough.
        </p>
        
        <div className="mt-8 border-t border-emerald-500/10 pt-8">
          <p className="text-sm font-medium text-stone-800">
            Want to connect instantly?
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] hover:shadow-md cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Chat with us on WhatsApp
          </a>
          <p className="mt-3 text-xs text-stone-500">
            Prefer WhatsApp? Chat with us directly at <span className="font-semibold">+234 815 265 7887</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-melo-border bg-white p-8 shadow-sm [color-scheme:light] sm:p-10">
      <h2 className="font-serif text-3xl text-melo-ink">{title}</h2>
      <p className="mt-2 text-sm text-melo-muted">{subtitle}</p>

      {status === "error" && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {/* Honeypot field (hidden from screen reader and visual styling) */}
        <div className="absolute -z-50 h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
          <label htmlFor="website-hp">Leave this empty if you are human</label>
          <input
            id="website-hp"
            type="text"
            name="website"
            value={formData.website}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

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
              value={formData.name}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 placeholder:text-melo-muted/70 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
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
              value={formData.school}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 placeholder:text-melo-muted/70 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
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
              value={formData.email}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 placeholder:text-melo-muted/70 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
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
              value={formData.phone}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 placeholder:text-melo-muted/70 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
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
            value={formData.students}
            onChange={handleChange}
            className="mt-2 w-full cursor-pointer rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
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
            value={formData.message}
            onChange={handleChange}
            className="mt-2 w-full resize-none rounded-lg border border-melo-border bg-melo-paper px-4 py-3 text-sm text-melo-ink outline-none transition-colors duration-200 placeholder:text-melo-muted/70 focus:border-melo-gold focus:ring-1 focus:ring-melo-gold/30"
            placeholder="Tell us about your school's needs..."
          />
        </div>

        <button
          type="submit"
          disabled={status === "pending"}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 cursor-pointer h-14 px-8 text-[15px]",
            "bg-melo-gold text-white hover:bg-amber-600 shadow-glow hover:shadow-[0_0_64px_rgba(202,138,4,0.25)] hover:-translate-y-px active:translate-y-0",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {status === "pending" ? (
            <span>Sending request...</span>
          ) : (
            <>
              <span>Send request</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
