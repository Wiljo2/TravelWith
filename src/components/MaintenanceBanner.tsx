"use client";

// Shown while the server pauses writes (MAINTENANCE_MODE); pending changes
// stay in the page and are sent again automatically.
export default function MaintenanceBanner() {
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[220] border-b border-border bg-card px-4 py-2 text-center text-[13px] text-foreground shadow-sm"
    >
      Estamos actualizando TravelWith. Tus cambios se guardarán automáticamente en unos minutos; no cierres la página.
    </div>
  );
}
