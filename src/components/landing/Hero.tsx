import { HeroMock } from "@/components/landing/HeroMock";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2 lg:gap-10">
      <div className="flex flex-col items-start gap-6">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Gratis durante la beta
        </span>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          Planea tu próximo viaje en grupo, todos en la misma página
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
      <HeroMock />
    </section>
  );
}
