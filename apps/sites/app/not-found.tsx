import { Container, SurfaceCard, SectionHeading } from "@/site-ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center py-16">
      <Container>
        <SurfaceCard className="mx-auto max-w-2xl space-y-6 text-center">
          <SectionHeading eyebrow="Public site unavailable" title="We could not find this school website." description="The hostname may be unknown, inactive, or not yet connected to a published school site." />
          <p className="text-sm leading-7 text-slate-600">
            Please check the website address or contact the school office directly for the correct public link.
          </p>
        </SurfaceCard>
      </Container>
    </main>
  );
}
