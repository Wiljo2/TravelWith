export function DemoVideo() {
  const src = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;
  if (!src) return null;
  return (
    <section id="demo" className="mx-auto w-full max-w-4xl scroll-mt-14 px-4 py-16 sm:px-6 md:py-24">
      <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight md:text-4xl">Míralo en acción</h2>
      <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-muted shadow-lg">
        <video controls preload="metadata" src={src} className="size-full" />
      </div>
    </section>
  );
}
