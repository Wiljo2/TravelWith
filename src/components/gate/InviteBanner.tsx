"use client";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InviteState } from "@/hooks/useTripSession";

interface InviteBannerProps {
  invite: InviteState;
  signedIn: boolean;
}

export default function InviteBanner({ invite, signedIn }: InviteBannerProps) {
  if (invite.error) {
    return (
      <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 pl-3.5 pr-1.5 text-[13px] leading-snug text-destructive">
        <p className="flex-1 py-0.5">{invite.error}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar aviso"
          onClick={invite.dismissError}
          className="-my-1 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <XIcon />
        </Button>
      </div>
    );
  }
  if (!invite.pending) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
      <span aria-hidden>👋</span>
      <p className="flex-1">
        {signedIn ? "Uniéndote al viaje…" : "Te invitaron a un viaje. Inicia sesión o crea tu cuenta para unirte."}
      </p>
    </div>
  );
}
