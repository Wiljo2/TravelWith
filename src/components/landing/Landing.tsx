import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
      <div className="text-6xl" aria-hidden>🧳</div>
      <h1 className="text-4xl font-semibold tracking-tight">TravelWith</h1>
      <p className="max-w-md text-muted-foreground">
        Planea viajes en grupo: itinerario, presupuesto y tareas en tiempo real
      </p>
      <div className="flex flex-col items-center gap-3">
        <a href="/?app=1" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
          Empezar
        </a>
        <a href="/?app=1" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Ya tengo cuenta · Entrar
        </a>
      </div>
    </main>
  );
}
