import Link from "next/link";
import { Container, GoldButton, ButtonLink } from "@/site-ui";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grain" />
      <Container className="relative flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="font-serif text-8xl text-melo-border sm:text-9xl">404</span>
        <h1 className="mt-4 font-serif text-3xl text-melo-ink sm:text-4xl">Page not found</h1>
        <p className="mt-3 max-w-md text-base text-melo-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <GoldButton href="/">Go home</GoldButton>
          <ButtonLink href="/contact" variant="outline">Contact us</ButtonLink>
        </div>
      </Container>
    </section>
  );
}
