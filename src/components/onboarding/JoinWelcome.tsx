"use client";
import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import MemberAvatar from "@/components/MemberAvatar";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { travelersSummary, type TripFacts, type WelcomeItem } from "@/utils/joinWelcome";
import type { Tab } from "@/components/TabBar";
import type { RoomMember } from "@/types";

export interface WelcomeTravelers {
  members: RoomMember[];
  // The signed-in user's id (the roster's userId).
  me: string;
  // Placeholder travelers ("Viajero 2…"), counted but not yet in the app.
  placeholders: number;
}

export interface JoinWelcomeProps {
  open: boolean;
  onClose: () => void;
  tripName: string | null;
  facts: TripFacts;
  travelers: WelcomeTravelers;
  items: WelcomeItem[];
  onOpen: (tab: Tab) => void;
}

const MAX_AVATARS = 4;

// Shown once to someone who just joined a trip by invitation: what the trip is and
// what is waiting for them. Nothing is saved; each action only picks a tab.
export default function JoinWelcome({ open, onClose, tripName, facts, travelers, items, onOpen }: JoinWelcomeProps) {
  const mobile = useIsMobile();
  const title = tripName ? `¡Bienvenido a ${tripName}! 👋` : "¡Bienvenido al viaje! 👋";
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };

  const body = (
    <div className="flex flex-col gap-4">
      <FactsRow facts={facts} />
      <TravelersRow {...travelers} />
      {items.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Lo que te espera</h3>
          {items.map((item, i) => (
            <ChoiceCard
              key={item.key}
              icon={item.icon}
              title={item.label}
              line={item.detail}
              highlighted={i === 0 && item.tab === "home"}
              onClick={() => onOpen(item.tab)}
            />
          ))}
        </section>
      )}
      <Button onClick={onClose} className="h-11 w-full font-semibold">Ver el viaje</Button>
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={<span className="block whitespace-normal leading-snug">{title}</span>}>
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold leading-snug">{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function FactsRow({ facts }: { facts: TripFacts }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-secondary-foreground">
      <span className="flex items-center gap-1.5">
        <CalendarDays aria-hidden className="size-4 text-muted-foreground" />{facts.dates}
      </span>
      {facts.destination && (
        <span className="flex items-center gap-1.5">
          <MapPin aria-hidden className="size-4 text-muted-foreground" />{facts.destination}
        </span>
      )}
    </div>
  );
}

function TravelersRow({ members, me, placeholders }: WelcomeTravelers) {
  const { title, line } = travelersSummary(members, me, placeholders);
  const ordered = [...members.filter((m) => m.userId === me), ...members.filter((m) => m.userId !== me)];
  const shown = ordered.slice(0, MAX_AVATARS);
  const rest = ordered.length - shown.length + placeholders;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
      {(shown.length > 0 || rest > 0) && (
        <div className="flex shrink-0 -space-x-2">
          {shown.map((m) => <MemberAvatar key={m.userId} member={m} size={30} />)}
          {rest > 0 && (
            <span className="flex size-[30px] items-center justify-center rounded-full border-2 border-dashed border-border bg-card text-[11px] font-semibold text-muted-foreground">
              +{rest}
            </span>
          )}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{line}</div>
      </div>
    </div>
  );
}
