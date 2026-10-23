"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MIN_PASSWORD_LENGTH } from "@/components/auth/EmailAuthForm";
import type { AuthResult } from "@/hooks/useAuth";

// Opens after the password reset link signs the user in, so they set the new password.
export default function PasswordRecoveryDialog({ open, onSubmit }: {
  open: boolean;
  onSubmit: (password: string) => Promise<AuthResult>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH || busy) return;
    setBusy(true);
    setError("");
    const { error } = await onSubmit(password);
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[360px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Crea tu nueva contraseña</DialogTitle>
          <DialogDescription>Ya entraste con el enlace del correo. Elige una contraseña nueva para tu cuenta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Nueva contraseña (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
            autoComplete="new-password"
            className="bg-secondary text-sm"
          />
          <Button type="submit" disabled={busy || password.length < MIN_PASSWORD_LENGTH} className="font-semibold">
            {busy ? "Guardando..." : "Guardar contraseña"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
