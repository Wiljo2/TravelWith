"use client";
import { useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRoom } from "@/hooks/useUserRooms";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface RoomGateProps {
  onEnter: (code: string) => void;
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  signInWithGoogle: () => void;
  signOut: () => void;
  rooms: UserRoom[];
  addRoom: (code: string, role?: "owner" | "member", name?: string | null) => void;
  removeRoom: (code: string, accessToken: string) => Promise<void>;
  onEnterLocal?: () => void;
}

export default function RoomGate({
  onEnter, user, session, authLoading, signInWithGoogle, signOut, rooms, addRoom, removeRoom, onEnterLocal,
}: RoomGateProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tripName, setTripName] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ code: string; name: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reading a room requires membership, so joining registers first; the
  // members endpoint answers 404 for unknown codes.
  async function join(code?: string) {
    const c = (code ?? input).trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError("");
    const res = await apiFetch(`/api/rooms/${c}/members`, session?.access_token, { method: "POST" });
    if (!res.ok) {
      setError(res.status === 404 ? "Sala no encontrada." : "No se pudo entrar al viaje.");
      setLoading(false);
      return;
    }
    addRoom(c, "member");
    onEnter(c);
  }

  const canCreate = tripName.trim().length > 0 && !!tripStart && !!tripEnd && tripStart <= tripEnd;

  async function create() {
    if (!canCreate) return;
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/rooms", session?.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tripName.trim(),
        destination: tripDestination.trim() || undefined,
        startDate: tripStart,
        endDate: tripEnd,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Error al crear el viaje.");
      setLoading(false);
      return;
    }
    const { code } = await res.json();
    addRoom(code, "owner", tripName.trim());
    onEnter(code);
  }

  // Collaborative model: "delete" always means leaving MY view. The room lives
  // while anyone else still has it; the server deletes it when the last member leaves.
  async function confirmDelete() {
    if (!deleteTarget || !session?.access_token) return;
    setDeleting(true);
    await removeRoom(deleteTarget.code, session.access_token);
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
      <div className="mb-7 text-center md:mb-9">
        <div className="mb-2 text-[40px]">🧳</div>
        <h1 className="mb-1 text-[22px] font-bold">TravelWith</h1>
        <p className="text-[13px] text-secondary-foreground">
          Planea viajes en grupo · itinerario, presupuesto y tareas en tiempo real
        </p>
      </div>

      <div className="w-full max-w-[380px]">

        {authLoading ? (
          <div className="text-center text-[13px] text-muted-foreground">Cargando...</div>
        ) : !user ? (
          <Card className="rounded-[14px]">
            <CardContent className="px-7 py-2 text-center">
              <p className="mb-5 text-sm leading-relaxed text-secondary-foreground">
                Inicia sesión para ver tus viajes y colaborar en tiempo real con tu grupo.
              </p>
              <Button variant="outline" size="lg" onClick={signInWithGoogle} className="w-full gap-2.5 bg-secondary text-[15px]">
                <GoogleIcon />
                Continuar con Google
              </Button>
            </CardContent>
          </Card>

        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url as string} alt="" width={36} height={36} className="rounded-full border-2 border-border" />
                  : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                      {String(user.user_metadata?.full_name ?? user.email ?? "?")[0].toUpperCase()}
                    </div>
                }
                <div>
                  <div className="text-sm font-semibold">
                    {String(user.user_metadata?.full_name ?? user.email)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="text-xs text-muted-foreground">
                Salir
              </Button>
            </div>

            <div className="mb-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[.07em] text-muted-foreground">
                MIS VIAJES
              </p>

              {rooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-[22px] text-center text-[13px] text-muted-foreground">
                  Aún no tienes viajes. Crea uno o únete con un código.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {rooms.map((r) => (
                    <div
                      key={r.room_code}
                      className="flex items-center overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <button
                        onClick={() => join(r.room_code)}
                        disabled={loading}
                        className="flex flex-1 cursor-pointer items-center justify-between px-4 py-3.5 text-left text-foreground hover:bg-secondary"
                      >
                        <div>
                          <div className="text-[15px] font-semibold">
                            {r.name ?? <span className="font-mono tracking-[.08em]">{r.room_code}</span>}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            <span className="font-mono tracking-wider">{r.room_code}</span>
                            {" · "}{r.role === "owner" ? "Creador" : "Miembro"}
                            {r.trip?.destination && <> · {r.trip.destination}</>}
                          </div>
                        </div>
                        <span className="text-xl opacity-35">→</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ code: r.room_code, name: r.name })}
                        title="Quitar de mi lista"
                        className="flex h-full min-w-12 cursor-pointer items-center justify-center self-stretch border-l border-border px-3.5 text-base text-muted-foreground hover:bg-secondary"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showCreate ? (
              <Card className="rounded-xl py-4">
                <CardContent className="flex flex-col gap-2.5 px-4">
                  <div className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground">NUEVO VIAJE</div>
                  <Input
                    autoFocus
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="Nombre del viaje (ej. Vacaciones 2027)"
                    maxLength={80}
                    className="bg-secondary text-sm"
                  />
                  <Input
                    value={tripDestination}
                    onChange={(e) => setTripDestination(e.target.value)}
                    placeholder="Destino (opcional)"
                    maxLength={80}
                    className="bg-secondary text-sm"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 text-[11px] text-secondary-foreground">
                      Inicio
                      <Input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} className="mt-1 bg-secondary text-[13px]" />
                    </label>
                    <label className="flex-1 text-[11px] text-secondary-foreground">
                      Fin
                      <Input type="date" value={tripEnd} min={tripStart || undefined} onChange={(e) => setTripEnd(e.target.value)} className="mt-1 bg-secondary text-[13px]" />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={create} disabled={loading || !canCreate} className="flex-1 font-semibold">
                      {loading ? "Creando..." : "Crear viaje"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowCreate(false); setError(""); }} className="text-muted-foreground">
                      ×
                    </Button>
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </CardContent>
              </Card>
            ) : showJoin ? (
              <Card className="rounded-xl py-4">
                <CardContent className="px-4">
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && join()}
                      placeholder="Código de sala"
                      maxLength={12}
                      className="flex-1 bg-secondary font-mono text-[15px] tracking-[.1em]"
                    />
                    <Button onClick={() => join()} disabled={loading || !input.trim()} className="font-semibold">
                      Entrar
                    </Button>
                    <Button variant="outline" onClick={() => { setShowJoin(false); setError(""); }} className="text-muted-foreground">
                      ×
                    </Button>
                  </div>
                  {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowJoin(true)} className="flex-1 bg-card">
                  Unirse con código
                </Button>
                <Button onClick={() => setShowCreate(true)} className="flex-1 font-semibold">
                  Nuevo viaje
                </Button>
              </div>
            )}
          </>
        )}

        {onEnterLocal && (
          <button
            onClick={onEnterLocal}
            className="mt-6 w-full cursor-pointer border-none bg-transparent text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Modo local · datos de prueba, sin cuenta ni guardado
          </button>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <div className="text-2xl">🗑</div>
            <DialogTitle>Quitar viaje de tu lista</DialogTitle>
            <DialogDescription className="leading-normal">
              ¿Quitar <strong>{deleteTarget?.name ?? deleteTarget?.code}</strong> de tus viajes?
              Los demás miembros lo conservan y puedes volver con el código{" "}
              <strong className="font-mono">{deleteTarget?.code}</strong>.
              Si eres el último en salir, el viaje se elimina definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1 font-semibold">
              {deleting ? "Quitando..." : "Quitar de mi lista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
