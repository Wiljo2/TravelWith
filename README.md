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

Para habilitar la sala compartida, crea un archivo `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Luego ejecuta el SQL de `supabase/migrations/001_init.sql` en el dashboard de Supabase.

Sin las variables de entorno la app funciona igual pero sin sincronización.

---

## Deploy en Vercel

1. Importa el repo desde [vercel.com/new](https://vercel.com/new)
2. Vercel detecta Vite automáticamente
3. Agrega las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Settings → Environment Variables
4. Comparte la URL + el código de sala con tu grupo
