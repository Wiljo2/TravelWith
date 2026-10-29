import { HeroMock } from "@/components/landing/HeroMock";
import { HeroGlobe } from "@/components/landing/globe/HeroGlobe";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative isolate">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_55%_at_76%_42%,var(--accent),transparent_72%)]"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-4 px-4 pt-12 pb-16 sm:px-6 md:pt-16 lg:grid-cols-[1fr_1.1fr] lg:gap-2 lg:py-12">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Gratis durante la beta
          </span>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-6xl lg:leading-[1.05]">
            Planea tu próximo viaje en grupo,{" "}
            <span className="bg-linear-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">
              todos en la misma página
            </span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Itinerario, presupuesto, pendientes y un asistente con IA, todo en tiempo real para que
            nadie se quede sin enterarse.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a href="/?app=1" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
              Empezar gratis
            </a>
            <a href="#funciones" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "px-6")}>
              Ver funciones
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <HeroGlobe />
          <HeroMock className="relative mx-auto -mt-12 w-full max-w-xs lg:absolute lg:right-0 lg:bottom-0 lg:mt-0 lg:w-72 xl:-right-12" />
        </div>
      </div>
    </section>
  );
}
