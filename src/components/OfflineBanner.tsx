import { WifiOff } from "lucide-react";

// Shown while the trip comes from this device's last copy (no internet).
export default function OfflineBanner({ since }: { since: string }) {
  const when = new Date(since).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 ring-1 ring-amber-200">
      <WifiOff className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">Sin conexión.</span> Estás viendo la copia del {when} (los cambios no se guardarán).
        {" "}Se actualiza sola cuando vuelva el internet.
      </p>
    </div>
  );
}
