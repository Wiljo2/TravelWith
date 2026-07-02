"use client";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserRooms } from "../hooks/useUserRooms";

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
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--surface-1)", padding: "20px 16px",
    }}>
      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🚢</div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>TravelWith</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Wonder of the Seas · Bahamas · Nov 2026
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* ── NOT LOGGED IN ── */}
        {authLoading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Cargando...</div>
        ) : !user ? (
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "32px 28px", textAlign: "center",
          }}>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Inicia sesión para ver tus viajes y colaborar en tiempo real con tu grupo.
            </p>
            <button
              onClick={signInWithGoogle}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                width: "100%", padding: "12px 20px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--surface-1)",
                color: "var(--text-primary)", cursor: "pointer", fontSize: 15, fontWeight: 500,
              }}
            >
              <GoogleIcon />
              Continuar con Google
            </button>
          </div>

        ) : (
          /* ── LOGGED IN ── */
          <>
            {/* User header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url as string} alt="" width={36} height={36} style={{ borderRadius: "50%", border: "2px solid var(--border)" }} />
                  : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6EE7B7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#04342C" }}>
                      {String(user.user_metadata?.full_name ?? user.email ?? "?")[0].toUpperCase()}
                    </div>
                }
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {String(user.user_metadata?.full_name ?? user.email)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
                </div>
              </div>
              <button
                onClick={signOut}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "5px 10px", borderRadius: 6 }}
              >
                Salir
              </button>
            </div>

            {/* Mis viajes */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".07em" }}>
                MIS VIAJES
              </p>

              {rooms.length === 0 ? (
                <div style={{
                  background: "var(--surface-2)", border: "1px dashed var(--border)",
                  borderRadius: 12, padding: "22px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13,
                }}>
                  Aún no tienes viajes. Crea uno o únete con un código.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rooms.map((r) => (
                    <div
                      key={r.room_code}
                      style={{
                        display: "flex", alignItems: "center",
                        borderRadius: 12, border: "1px solid var(--border)",
                        background: "var(--surface-2)", overflow: "hidden",
                      }}
                    >
                      <button
                        onClick={() => join(r.room_code)}
                        disabled={loading}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "14px 16px", background: "none", border: "none",
                          color: "var(--text-primary)", cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, letterSpacing: ".08em" }}>
                            {r.room_code}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                            {r.role === "owner" ? "Creador" : "Miembro"} · {new Date(r.joined_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <span style={{ fontSize: 20, opacity: .35 }}>→</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ code: r.room_code, role: r.role })}
                        title="Eliminar sesión"
                        style={{
                          padding: "0 14px", height: "100%", background: "none",
                          border: "none", borderLeft: "1px solid var(--border)",
                          color: "var(--text-muted)", cursor: "pointer", fontSize: 16,
                          display: "flex", alignItems: "center",
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Join / Create */}
            {!showJoin ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowJoin(true)}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 10,
                    border: "1px solid var(--border)", background: "var(--surface-2)",
                    color: "var(--text-primary)", fontWeight: 500, cursor: "pointer", fontSize: 13,
                  }}
                >
                  Unirse con código
                </button>
                <button
                  onClick={create}
                  disabled={loading}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 10,
                    border: "none", background: "#6EE7B7",
                    color: "#04342C", fontWeight: 600, cursor: "pointer", fontSize: 13,
                    opacity: loading ? .6 : 1,
                  }}
                >
                  {loading ? "Creando..." : "Nuevo viaje"}
                </button>
              </div>
            ) : (
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: error ? 8 : 0 }}>
                  <input
                    autoFocus
                    value={input}
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                    placeholder="Código de sala"
                    maxLength={8}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--surface-1)",
                      color: "var(--text-primary)", fontSize: 15, fontFamily: "monospace",
                      letterSpacing: ".1em", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => join()}
                    disabled={loading || !input.trim()}
                    style={{
                      padding: "10px 16px", borderRadius: 8, border: "none",
                      background: "#6EE7B7", color: "#04342C", fontWeight: 600,
                      cursor: "pointer", fontSize: 14, opacity: loading || !input.trim() ? .5 : 1,
                    }}
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => { setShowJoin(false); setError(""); }}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}
                  >
                    ×
                  </button>
                </div>
                {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "28px 24px", maxWidth: 360, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🗑</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
              {deleteTarget.role === "owner" ? "Eliminar sala" : "Salir de la sala"}
            </h3>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {deleteTarget.role === "owner"
                ? <>¿Eliminar la sala <strong style={{ fontFamily: "monospace" }}>{deleteTarget.code}</strong>? Se perderá el itinerario y todos los miembros perderán acceso.</>
                : <>¿Salir de la sala <strong style={{ fontFamily: "monospace" }}>{deleteTarget.code}</strong>? Puedes volver a unirte con el mismo código.</>
              }
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "none",
                  color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 500,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "none",
                  background: "#EF4444", color: "#fff",
                  cursor: deleting ? "wait" : "pointer", fontSize: 13, fontWeight: 600,
                  opacity: deleting ? .6 : 1,
                }}
              >
                {deleting ? "Eliminando..." : deleteTarget.role === "owner" ? "Eliminar sala" : "Salir"}
              </button>
            </div>
          </div>
        </div>
      )}
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
