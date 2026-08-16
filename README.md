# TravelWith

Planificador de itinerarios de viaje colaborativo con vista de calendario día por día, drag & drop y sincronización en tiempo real por sala compartida.

Construido para el viaje **Wonder of the Seas · Bahamas & Perfect Day · Nov 28 – Dic 4, 2026**.

---

## ¿Qué es?

Una app web donde un grupo de viajeros puede planificar su itinerario juntos en tiempo real. Cada persona entra con el mismo **código de sala** y ve exactamente lo mismo: los eventos del día, los horarios, el presupuesto estimado. Si alguien mueve un bloque, todos lo ven al instante.

---

## Funcionalidades

- **Calendario día por día** estilo Google Calendar con columnas por día y ruler de horas
- **Drag & drop** para mover actividades entre horas y entre días
  - El bloque original desaparece al agarrarlo
  - Un bloque fantasma con título y hora actualizada sigue al cursor con snap a 15 minutos
  - Al soltar aparece un toast con opción de **Deshacer**
- **Editor lateral** para cambiar título, hora de inicio/fin, categoría y nota de cada actividad
- **Presupuesto editable** con desglose de crucero, hotel, vuelos y extras — total en tiempo real
- **Categorías con color**: A bordo, Puerto, Miami, Comida, Noche, Logística
- **Ventana de puerto sombreada** en los días de escala (Nassau, CocoCay)
- **Sala compartida** vía código — cualquiera con el código puede ver y editar el itinerario (Supabase)

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 + Vite |
| Estilos | CSS variables inline (sin dependencias de UI) |
| Persistencia | Supabase (Postgres + RLS) |
| Deploy | Vercel |

---

## Estructura del proyecto

```
src/
  constants/        # Categorías, constantes de tiempo y píxeles
  data/             # Itinerario inicial (seed)
  utils/            # fmtHour, durLabel, snapHour, uid, inputStyle
  hooks/
    useItinerary    # Estado local de días y eventos (add, update, delete, move)
    useDragDrop     # Lógica de drag & drop + preview en tiempo real
    useBudget       # Estado de extras y cálculo de totales
    useRoom         # Sincronización con Supabase por código de sala
  components/
    calendar/       # CalendarGrid, DayColumn, EventBlock, HourGutter
    editor/         # EventEditor
    budget/         # BudgetPanel, PriceChip
    RoomGate        # Pantalla de entrada por código de sala
    Toast           # Notificación de acción con Deshacer
  App.jsx           # Orquestador — solo conecta hooks y componentes
```

---

## Correr localmente

```bash
npm install
npm run dev
```

### Modo local (sin cuenta, sin base de datos)

Para trabajar en la UI sin login ni Supabase:

```
http://localhost:3000/?local=1
```

Arranca con los datos de prueba de `src/data/mockRoom.ts` (calendario, presupuesto
y tareas). No guarda nada. También está el enlace *"Modo local"* al pie de la
pantalla de entrada. Solo existe en builds de desarrollo.

### Contra los datos reales

Copia `.env.example` a `.env.local` y llena las cuatro variables desde el
dashboard de Supabase (Settings → API) y la consola de Anthropic.

`SUPABASE_SERVICE_ROLE_KEY` no es opcional: las políticas RLS de `user_rooms`
filtran por `auth.uid()`, que es `null` para un cliente anónimo. Sin esa clave las
salas cargan pero "Mis viajes" sale vacío y unirse o salir de un viaje no
persiste. El servidor avisa por consola si falta.

Para que el login con Google vuelva a `localhost` en vez de a producción, agrega
`http://localhost:3000/**` en Supabase → Authentication → URL Configuration →
Redirect URLs. El `redirectTo` que manda la app es `window.location.origin`; si
ese origen no está en la lista, Supabase redirige al Site URL (producción).

> Local y producción comparten la misma base de datos. Los cambios que hagas en
> `npm run dev` afectan viajes reales — usa una sala de pruebas para experimentar.

Las migraciones están en `supabase/migrations/`; ejecútalas en orden en el
dashboard de Supabase.

---

## Deploy en Vercel

1. Importa el repo desde [vercel.com/new](https://vercel.com/new)
2. Vercel detecta Next.js automáticamente
3. Agrega las variables de `.env.example` en Settings → Environment Variables
4. Comparte la URL + el código de sala con tu grupo
