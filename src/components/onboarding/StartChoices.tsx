"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InviteSheet from "@/components/invite/InviteSheet";
import ReelLinkForm from "@/components/onboarding/ReelLinkForm";
import ChoiceCard from "@/components/onboarding/ChoiceCard";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { VOTE_KINDS, VOTE_KIND_KEYS } from "@/constants/votes";
import type { TaskDecides } from "@/types";

export interface StartChoicesProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  tripName?: string | null;
  // What the wizard left to a group vote: the invite card says the group is needed for it.
  toVote?: TaskDecides[];
  // A link that `findIdeaUrls` accepts: it lands in the Ideas form, like a link shared from the phone.
  onPasteLink: (text: string) => void;
  // Hidden without it (local mode and members have no assistant).
  onAskAssistant?: () => void;
}

const TITLE = "Tu viaje está listo 🎉";

// "Para votar las fechas y el destino necesitan al grupo: …".
function inviteLine(toVote: TaskDecides[]): string {
  const subjects = VOTE_KIND_KEYS.filter((k) => toVote.includes(k)).map((k) => VOTE_KINDS[k].subject);
  if (subjects.length === 0) return "Comparte el enlace por WhatsApp y planeen juntos.";
  return `Para votar ${subjects.join(" y ")} necesitan al grupo: comparte el enlace por WhatsApp.`;
}

// "¿Cómo quieres empezar?": offered once, right after creating a trip. Nothing is saved;
// the choice only decides where the creator lands.
export default function StartChoices({ open, onClose, roomCode, tripName, toVote = [], onPasteLink, onAskAssistant }: StartChoicesProps) {
  const mobile = useIsMobile();
  const [inviting, setInviting] = useState(false);
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };

  function invite() {
    setInviting(true);
    onClose();
  }

  const body = (
    <StartOptions inviteLine={inviteLine(toVote)} onInvite={invite} onPasteLink={onPasteLink} onAskAssistant={onAskAssistant} onSkip={onClose} />
  );

  return (
    <>
      {mobile ? (
        <BottomSheet open={open} onOpenChange={onOpenChange} title={TITLE}>{body}</BottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-[17px] font-semibold">{TITLE}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
      <InviteSheet open={inviting} onOpenChange={setInviting} roomCode={roomCode} tripName={tripName} />
    </>
  );
}

interface StartOptionsProps {
  inviteLine: string;
  onInvite: () => void;
  onPasteLink: (text: string) => void;
  onAskAssistant?: () => void;
  onSkip: () => void;
}

function StartOptions({ inviteLine, onInvite, onPasteLink, onAskAssistant, onSkip }: StartOptionsProps) {
  const [pasting, setPasting] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-secondary-foreground">¿Cómo quieres empezar?</p>
      <ChoiceCard
        icon="👥"
        title="Invitar a mi grupo"
        line={inviteLine}
        highlighted
        onClick={onInvite}
      />
      <ChoiceCard
        icon="🎬"
        title="Pegar un TikTok o reel"
        line="Guarda lo que viste del destino; Claude lo ordena por lugar y momento."
        expanded={pasting}
        onClick={() => setPasting((p) => !p)}
      />
      {pasting && <ReelLinkForm onSubmit={onPasteLink} />}
      {onAskAssistant && (
        <ChoiceCard
          icon="✨"
          title="Contarle a la IA"
          line="Describe el viaje en una frase y el asistente propone un primer plan."
          onClick={onAskAssistant}
        />
      )}
      <Button variant="ghost" onClick={onSkip} className="mt-1 h-10 w-full text-muted-foreground">
        Saltar por ahora
      </Button>
    </div>
  );
}
