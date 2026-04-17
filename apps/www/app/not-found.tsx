import Link from "next/link";
import { Container, SurfaceCard } from "@/site-ui";

export default function NotFound() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SurfaceCard className="mx-auto max-w-2xl space-y-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Page not found</p>
          <h1 className="text-4xl font-semibold text-slate-950">We could not find that page.</h1>
          <p className="text-sm leading-7 text-slate-600">
            Try the homepage or contact the team if you were looking for product information.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex items-center justify-center rounded-full bg-[color:var(--school-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--school-secondary)]">
              Go home
            </Link>
            <Link href="/contact" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
              Contact sales
            </Link>
          </div>
        </SurfaceCard>
      </Container>
    </section>
  );
}
