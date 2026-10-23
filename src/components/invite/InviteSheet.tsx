"use client";
import { useState } from "react";
import { Check, Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { LOCAL_ROOM_CODE } from "@/data/localMode";
import { cn } from "@/lib/utils";
import { inviteLink, inviteMessage, inviteText, whatsappUrl } from "@/utils/invite";

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
  tripName?: string | null;
}

const TITLE = "Invitar a tu grupo";

export default function InviteSheet({ open, onOpenChange, roomCode, tripName }: InviteSheetProps) {
  const mobile = useIsMobile();
  const body = <InviteOptions roomCode={roomCode} tripName={tripName} />;

  if (mobile) {
    return <BottomSheet open={open} onOpenChange={onOpenChange} title={TITLE}>{body}</BottomSheet>;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{TITLE}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function InviteOptions({ roomCode, tripName }: { roomCode: string; tripName?: string | null }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = inviteLink(origin, roomCode);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function copy(kind: "link" | "code", text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
    }).catch(() => { /* clipboard blocked: the link and code stay visible to copy by hand */ });
  }

  function share() {
    navigator.share({ title: tripName?.trim() || "TravelWith", text: inviteText(tripName), url: link })
      .catch(() => { /* dismissed */ });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Quien abra el enlace entra al viaje después de iniciar sesión o crear su cuenta.
      </p>
      {roomCode === LOCAL_ROOM_CODE && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-snug text-secondary-foreground">
          En modo local el enlace no funciona: este viaje solo existe en este navegador.
        </p>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary py-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-secondary-foreground">{link}</span>
        <Button variant="outline" size="sm" onClick={() => copy("link", link)} className="bg-card">
          {copied === "link" ? <Check /> : <Link2 />}
          {copied === "link" ? "¡Enlace copiado!" : "Copiar enlace"}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={whatsappUrl(inviteMessage(tripName, link))}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "h-10 w-full gap-2 font-semibold")}
        >
          <MessageCircle className="size-4" />
          Enviar por WhatsApp
        </a>
        {canShare && (
          <Button variant="outline" size="lg" onClick={share} className="h-10 w-full gap-2 bg-card">
            <Share2 className="size-4" />
            Compartir…
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">O comparte el código</div>
          <div className="truncate font-mono text-lg font-semibold tracking-[.12em]">{roomCode}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => copy("code", roomCode)} className="bg-card">
          {copied === "code" ? <Check /> : <Copy />}
          {copied === "code" ? "¡Código copiado!" : "Copiar código"}
        </Button>
      </div>
    </div>
  );
}
