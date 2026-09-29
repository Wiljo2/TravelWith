"use client";
import { useState } from "react";
import type { RoomMember } from "@/types";
import type { MockPerson } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function MemberAvatar({ member, size = 26 }: { member: RoomMember; size?: number }) {
  return member.avatar ? (
    <img src={member.avatar} alt={member.name} width={size} height={size} className="block shrink-0 rounded-full border-2 border-secondary" />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-primary font-bold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
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
    <div className="mb-7 rounded-xl border border-border bg-card px-[18px] py-3.5">
      <div className={`flex items-center justify-between ${people > 0 || adding ? "mb-2.5" : ""}`}>
        <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground">VIAJEROS</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full border-primary bg-primary/15 px-2.5 text-xs font-semibold text-emerald-700">
            {people} {people === 1 ? "persona" : "personas"}
          </Badge>
          {!adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="h-auto border-dashed bg-secondary px-2.5 py-[3px] text-xs text-muted-foreground">
              + persona
            </Button>
          )}
        </div>
      </div>
      {members.map((m) => (
        <div key={m.userId} className="mb-1.5 flex items-center gap-2">
          <MemberAvatar member={m} /><span className="text-[13px]">{m.name}</span>
          <span className="rounded bg-secondary px-[5px] py-px text-[10px] text-muted-foreground">miembro</span>
        </div>
      ))}
      {mockPeople.map((p) => (
        <div key={p.id} className="mb-1.5 flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary text-[11px] font-semibold text-muted-foreground">{p.name[0].toUpperCase()}</div>
          <span className="text-[13px] text-secondary-foreground">{p.name}</span>
          <span className="rounded bg-secondary px-[5px] py-px text-[10px] text-muted-foreground">simulado</span>
          <button onClick={() => onRemoveMockPerson(p.id)} className="ml-auto cursor-pointer px-1 text-[15px] leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>
      ))}
      {adding && (
        <div className="mt-2 flex gap-1.5">
          <Input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
            placeholder="Nombre del viajero"
            className="flex-1 bg-secondary text-[13px]"
          />
          <Button onClick={submit} className="font-semibold">Agregar</Button>
          <Button variant="outline" onClick={() => { setAdding(false); setName(""); }} className="text-muted-foreground">×</Button>
        </div>
      )}
    </div>
  );
}
