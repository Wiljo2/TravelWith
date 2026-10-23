"use client";
import { useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRoom } from "@/hooks/useUserRooms";
import type { TripInfo } from "@/types";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { loadSnapshot } from "@/lib/offline";
import { LOCAL_ROOM_CODE, type LocalVariant } from "@/data/localMode";
import { isSandbox, setSandboxTrip } from "@/data/localSandbox";
import { firstName } from "@/utils/userName";
import SignInOptions, { type SignInOptionsProps } from "@/components/auth/SignInOptions";
import TripList from "@/components/gate/TripList";
import JoinByCode from "@/components/gate/JoinByCode";
import CreateTripForm from "@/components/gate/CreateTripForm";
import WelcomeFirstTrip from "@/components/gate/WelcomeFirstTrip";

interface RoomGateProps {
  onEnter: (code: string) => void;
  user: User | null;
  session: Session | null;
  authLoading: boolean;
  signIn: SignInOptionsProps;
  signOut: () => void;
  rooms: UserRoom[];
  addRoom: (code: string, role?: "owner" | "member", name?: string | null) => void;
  removeRoom: (code: string, accessToken: string) => Promise<void>;
  onEnterLocal?: (variant: LocalVariant) => void;
}

export default function RoomGate({
  onEnter, user, session, authLoading, signIn, signOut, rooms, addRoom, removeRoom, onEnterLocal,
}: RoomGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ code: string; name: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reading a room requires membership, so joining registers first; the
  // members endpoint answers 404 for unknown codes.
  async function join(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (isSandbox()) {
      if (c === LOCAL_ROOM_CODE) onEnter(c);
      else setError("En modo local no hay viajes de otras personas a los que unirse.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await apiFetch(`/api/rooms/${c}/members`, session?.access_token, { method: "POST" }).catch(() => null);
    // Offline: open this device's last copy of the trip, if it has one.
    if (!res && loadSnapshot(c)) {
      setLoading(false);
      onEnter(c);
      return;
    }
    if (!res?.ok) {
      setError(res?.status === 404 ? "Sala no encontrada." : "No se pudo entrar al viaje.");
      setLoading(false);
      return;
    }
    addRoom(c, "member");
    onEnter(c);
  }

  async function create(trip: TripInfo) {
    if (isSandbox()) {
      setSandboxTrip(trip);
      addRoom(LOCAL_ROOM_CODE, "owner", trip.name);
      onEnter(LOCAL_ROOM_CODE);
      return;
    }
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/rooms", session?.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Error al crear el viaje.");
      setLoading(false);
      return;
    }
    const { code } = await res.json();
    addRoom(code, "owner", trip.name);
    onEnter(code);
  }

  // Collaborative model: "delete" always means leaving MY view. The room lives
  // while anyone else still has it; the server deletes it when the last member leaves.
  async function confirmDelete() {
    if (!deleteTarget || (!session?.access_token && !isSandbox())) return;
    setDeleting(true);
    await removeRoom(deleteTarget.code, session?.access_token ?? "");
    setDeleting(false);
    setDeleteTarget(null);
  }

  function openPanel(panel: "create" | "join") {
    setError("");
    setShowCreate(panel === "create");
    setShowJoin(panel === "join");
  }

  function closePanel() {
    setShowCreate(false);
    setShowJoin(false);
    setError("");
  }

  const panel = showCreate ? (
    <CreateTripForm loading={loading} error={error} onSubmit={create} onCancel={closePanel} />
  ) : showJoin ? (
    <JoinByCode loading={loading} error={error} onSubmit={join} onCancel={closePanel} />
  ) : null;

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
                Inicia sesión o crea tu cuenta para ver tus viajes y colaborar en tiempo real con tu grupo.
              </p>
              <SignInOptions {...signIn} />
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

            {rooms.length === 0 ? (
              <WelcomeFirstTrip
                name={firstName(user)}
                panel={panel}
                onCreate={() => openPanel("create")}
                onJoin={() => openPanel("join")}
              />
            ) : (
              <>
                <TripList
                  rooms={rooms}
                  disabled={loading}
                  error={panel ? "" : error}
                  onOpen={join}
                  onRemove={setDeleteTarget}
                />
                {panel ?? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openPanel("join")} className="flex-1 bg-card">
                      Unirse con código
                    </Button>
                    <Button onClick={() => openPanel("create")} className="flex-1 font-semibold">
                      Nuevo viaje
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {onEnterLocal && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={() => onEnterLocal("demo")}
              className="cursor-pointer border-none bg-transparent text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Modo local · datos de prueba, sin cuenta ni guardado
            </button>
            <button
              onClick={() => onEnterLocal("new")}
              className="cursor-pointer border-none bg-transparent text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Modo local · viaje nuevo vacío, como un usuario recién llegado
            </button>
          </div>
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
