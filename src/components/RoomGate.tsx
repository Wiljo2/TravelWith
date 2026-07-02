"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface RoomGateProps {
  onEnter: (code: string) => void;
}

export default function RoomGate({ onEnter }: RoomGateProps) {
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { rooms, addRoom, removeRoom } = useUserRooms(user);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ code: string; role: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function registerMember(code: string) {
    if (!session?.access_token) return;
    await fetch(`/api/rooms/${code}/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }

  async function join(code?: string) {
    const c = (code ?? input).trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms/${c}`);
    if (!res.ok) {
      setError("Sala no encontrada.");
      setLoading(false);
      return;
    }
    await registerMember(c);
    await addRoom(c, "member");
    onEnter(c);
  }

  async function create() {
    setLoading(true);
    const res = await fetch("/api/rooms", { method: "POST" });
    if (!res.ok) {
      setError("Error al crear la sala.");
      setLoading(false);
      return;
    }
    const { code } = await res.json();
    await registerMember(code);
    await addRoom(code, "owner");
    onEnter(code);
  }

  async function confirmDelete() {
    if (!deleteTarget || !session?.access_token) return;
    setDeleting(true);
    if (deleteTarget.role === "owner") {
      await fetch(`/api/rooms/${deleteTarget.code}`, { method: "DELETE" });
    }
    await removeRoom(deleteTarget.code, session.access_token);
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-5">
      <div className="mb-9 text-center">
        <div className="mb-2 text-[40px]">🚢</div>
        <h1 className="mb-1 text-[22px] font-bold">TravelWith</h1>
        <p className="text-[13px] text-secondary-foreground">
          Wonder of the Seas · Bahamas · Nov 2026
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
                          <div className="font-mono text-base font-bold tracking-[.08em]">
                            {r.room_code}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {r.role === "owner" ? "Creador" : "Miembro"} · {new Date(r.joined_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <span className="text-xl opacity-35">→</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ code: r.room_code, role: r.role })}
                        title="Eliminar sesión"
                        className="flex h-full cursor-pointer items-center self-stretch border-l border-border px-3.5 text-base text-muted-foreground hover:bg-secondary"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!showJoin ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowJoin(true)} className="flex-1 bg-card">
                  Unirse con código
                </Button>
                <Button onClick={create} disabled={loading} className="flex-1 font-semibold">
                  {loading ? "Creando..." : "Nuevo viaje"}
                </Button>
              </div>
            ) : (
              <Card className="rounded-xl py-4">
                <CardContent className="px-4">
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && join()}
                      placeholder="Código de sala"
                      maxLength={8}
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
            )}
          </>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <div className="text-2xl">🗑</div>
            <DialogTitle>
              {deleteTarget?.role === "owner" ? "Eliminar sala" : "Salir de la sala"}
            </DialogTitle>
            <DialogDescription className="leading-normal">
              {deleteTarget?.role === "owner"
                ? <>¿Eliminar la sala <strong className="font-mono">{deleteTarget?.code}</strong>? Se perderá el itinerario y todos los miembros perderán acceso.</>
                : <>¿Salir de la sala <strong className="font-mono">{deleteTarget?.code}</strong>? Puedes volver a unirte con el mismo código.</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1 font-semibold">
              {deleting ? "Eliminando..." : deleteTarget?.role === "owner" ? "Eliminar sala" : "Salir"}
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
