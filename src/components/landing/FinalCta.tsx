import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinalCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 rounded-3xl bg-accent px-6 py-14 text-center text-accent-foreground">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">¿Listos para el próximo viaje?</h2>
        <p className="max-w-md text-accent-foreground/80">Crea tu viaje en un minuto e invita a tu grupo.</p>
        <a href="/?app=1" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
          Empezar gratis
        </a>
      </div>
    </section>
  );
}
