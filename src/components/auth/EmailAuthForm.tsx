"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthResult, SignUpResult } from "@/hooks/useAuth";

export const MIN_PASSWORD_LENGTH = 8;

type Mode = "signin" | "signup" | "reset";

interface EmailAuthFormProps {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  sendReset: (email: string) => Promise<AuthResult>;
}

const SUBMIT_LABEL: Record<Mode, [idle: string, busy: string]> = {
  signin: ["Entrar", "Entrando..."],
  signup: ["Crear cuenta", "Creando cuenta..."],
  reset: ["Enviar enlace", "Enviando..."],
};

export default function EmailAuthForm({ signIn, signUp, sendReset }: EmailAuthFormProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  const trimmedEmail = email.trim();
  const canSubmit =
    trimmedEmail.includes("@") &&
    (mode === "reset" || password.length >= MIN_PASSWORD_LENGTH) &&
    (mode !== "signup" || name.trim().length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    if (mode === "signin") {
      const { error } = await signIn(trimmedEmail, password);
      if (error) setError(error);
    } else if (mode === "signup") {
      const { error, needsConfirmation } = await signUp(name.trim(), trimmedEmail, password);
      if (error) setError(error);
      else if (needsConfirmation) {
        setNotice(`Te enviamos un correo a ${trimmedEmail}. Abre el enlace para activar tu cuenta y luego inicia sesión.`);
        setMode("signin");
      }
    } else {
      const { error } = await sendReset(trimmedEmail);
      if (error) setError(error);
      else setNotice(`Si existe una cuenta con ${trimmedEmail}, te llegará un enlace para crear una nueva contraseña.`);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 text-left">
      {mode === "signup" && (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          autoComplete="name"
          maxLength={80}
          className="bg-secondary text-sm"
        />
      )}
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Correo electrónico"
        autoComplete="email"
        className="bg-secondary text-sm"
      />
      {mode !== "reset" && (
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? `Contraseña (mínimo ${MIN_PASSWORD_LENGTH} caracteres)` : "Contraseña"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="bg-secondary text-sm"
        />
      )}

      <Button type="submit" size="lg" disabled={busy || !canSubmit} className="w-full font-semibold">
        {SUBMIT_LABEL[mode][busy ? 1 : 0]}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="text-xs leading-relaxed text-secondary-foreground">{notice}</p>}

      <div className="flex flex-col items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => switchMode("signup")} className="cursor-pointer hover:text-foreground">
              ¿No tienes cuenta? <span className="font-semibold text-foreground underline underline-offset-4">Crea una</span>
            </button>
            <button type="button" onClick={() => switchMode("reset")} className="cursor-pointer underline underline-offset-4 hover:text-foreground">
              Olvidé mi contraseña
            </button>
          </>
        ) : (
          <button type="button" onClick={() => switchMode("signin")} className="cursor-pointer hover:text-foreground">
            {mode === "signup" ? "¿Ya tienes cuenta? " : ""}
            <span className="font-semibold text-foreground underline underline-offset-4">Inicia sesión</span>
          </button>
        )}
      </div>
    </form>
  );
}
