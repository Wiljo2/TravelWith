"use client";
import AuthButton from "@/components/auth/AuthButton";
import PriceChip from "@/components/budget/PriceChip";
import { usdToCop, fmtUSD, fmtCOP } from "@/utils/currency";
import type { SaveState } from "@/hooks/useRoom";

interface AppHeaderProps {
  roomCode: string;
  connected: boolean;
  saveState: SaveState;
  grandTotal: number;
  exchangeRate: number;
  onReset: () => void;
  onLeaveRoom: () => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "guardando…",
  saved: "guardado ✓",
  error: "error ⚠",
};

export default function AppHeader({
  roomCode, connected, saveState, grandTotal, exchangeRate, onReset, onLeaveRoom,
}: AppHeaderProps) {
  return (
    <div className="app-header">
      <div>
        <div className="app-eyebrow">Wonder of the Seas · Orlando · Miami · Bahamas · CocoCay</div>
        <h1 className="app-title">Bahamas &amp; Perfect Day · Nov 26 – Dic 4, 2026</h1>
        <div className="app-subtitle">
          Arrastra cualquier bloque para reorganizar el plan · clic para editar horas
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {roomCode !== "LOCAL" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 12px", fontSize: 12,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: connected ? "#6EE7B7" : "#6b7280", flexShrink: 0,
            }} />
            <span style={{ color: "var(--text-muted)" }}>Sala</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".05em" }}>{roomCode}</span>
            <span style={{
              fontSize: 10,
              color: saveState === "error" ? "#EF4444" : "var(--text-muted)",
              minWidth: 52, textAlign: "left",
            }}>
              {SAVE_LABEL[saveState]}
            </span>
            <button
              title="Restablecer itinerario al default"
              onClick={onReset}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "0 0 0 4px" }}
            >↺</button>
            <button
              onClick={onLeaveRoom}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "0 0 0 4px" }}
            >×</button>
          </div>
        )}
        <div className="price-chips">
          <PriceChip label="Total estimado" value={fmtUSD(grandTotal)} sub={fmtCOP(usdToCop(grandTotal, exchangeRate))} strong />
        </div>
        <AuthButton />
      </div>
    </div>
  );
}
