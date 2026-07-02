"use client";
import { useState } from "react";
import type { RoomMember } from "@/types";
import type { MockPerson } from "@/hooks/useRoom";

function MemberAvatar({ member, size = 26 }: { member: RoomMember; size?: number }) {
  return member.avatar ? (
    <img src={member.avatar} alt={member.name} width={size} height={size} style={{ borderRadius: "50%", border: "2px solid var(--surface-1)", display: "block", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#6EE7B7", border: "2px solid var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, color: "#04342C", flexShrink: 0 }}>
      {member.name[0].toUpperCase()}
    </div>
  );
}

interface TravelersCardProps {
  members: RoomMember[];
  mockPeople: MockPerson[];
  people: number;
  onAddMockPerson: (name: string) => void;
  onRemoveMockPerson: (id: string) => void;
}

export default function TravelersCard({
  members, mockPeople, people, onAddMockPerson, onRemoveMockPerson,
}: TravelersCardProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (trimmed) onAddMockPerson(trimmed);
    setName(""); setAdding(false);
  }

  return (
    <div style={{ marginBottom: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: people > 0 || adding ? 10 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em" }}>VIAJEROS</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "color-mix(in srgb, #6EE7B7 15%, transparent)", border: "1px solid #6EE7B7", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600, color: "#6EE7B7" }}>{people} {people === 1 ? "persona" : "personas"}</div>
          {!adding && <button onClick={() => setAdding(true)} style={{ background: "var(--surface-1)", border: "1px dashed var(--border)", borderRadius: 7, padding: "3px 10px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>+ persona</button>}
        </div>
      </div>
      {members.map((m) => (
        <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <MemberAvatar member={m} /><span style={{ fontSize: 13 }}>{m.name}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", borderRadius: 4, padding: "1px 5px" }}>miembro</span>
        </div>
      ))}
      {mockPeople.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--surface-1)", flexShrink: 0 }}>{p.name[0].toUpperCase()}</div>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.name}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", borderRadius: 4, padding: "1px 5px" }}>simulado</span>
          <button onClick={() => onRemoveMockPerson(p.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
      ))}
      {adding && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
            placeholder="Nombre del viajero"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
          <button onClick={submit} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#6EE7B7", color: "#04342C", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Agregar</button>
          <button onClick={() => { setAdding(false); setName(""); }} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>×</button>
        </div>
      )}
    </div>
  );
}
