const ITEMS = [
  { q: "¿Es gratis?", a: "Sí, TravelWith es gratis mientras está en beta." },
  { q: "¿Necesito cuenta?", a: "Sí, inicias sesión con tu cuenta de Google. No tienes que crear una contraseña." },
  { q: "¿Cómo invito a mis amigos?", a: "Cada viaje tiene un código. Compártelo y quien lo ingrese se une al viaje." },
  {
    q: "¿Funciona sin internet?",
    a: "Sí, puedes consultar la última versión de tu viaje sin conexión, por ejemplo al llegar a migración. Para hacer cambios necesitas internet.",
  },
  {
    q: "¿Qué puede hacer el asistente?",
    a: "Proponer cambios al itinerario, los gastos y los pendientes. Solo se aplican cuando tú los apruebas.",
  },
  { q: "¿En qué monedas?", a: "Los gastos se manejan en USD y COP, con conversión entre ambas." },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-14 px-4 py-16 sm:px-6 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Preguntas frecuentes</h2>
      <div className="mt-8 flex flex-col gap-3">
        {ITEMS.map((item) => (
          <details key={item.q} className="group rounded-xl border border-border bg-card px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
