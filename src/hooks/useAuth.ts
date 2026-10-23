import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuthError, User, Session } from "@supabase/supabase-js";
import { isSandbox, onSandboxChange, sandboxUser, signInSandbox, signOutSandbox } from "@/data/localSandbox";

// Apple needs an Apple Developer account wired into Supabase; the button stays hidden until then.
export const APPLE_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_AUTH_APPLE === "1";

export type AuthResult = { error: string | null };
export type SignUpResult = AuthResult & { needsConfirmation: boolean };

const redirectTo = () => (typeof window !== "undefined" ? window.location.origin : undefined);

function authMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirma tu correo antes de entrar: revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo. Inicia sesión.";
    case "weak_password":
      return "La contraseña es muy débil. Usa al menos 8 caracteres.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
    case "same_password":
      return "La nueva contraseña debe ser distinta a la anterior.";
    case "email_address_invalid":
      return "Ese correo no es válido.";
    default:
      return "No se pudo completar. Intenta de nuevo.";
  }
}

const unavailable = { error: "El inicio de sesión no está disponible." };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (isSandbox()) {
      const sync = () => setUser(sandboxUser());
      sync();
      setLoading(false);
      return onSandboxChange(sync);
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setUser(s?.user ?? null);
      setSession(s ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  function signInWithGoogle() {
    if (isSandbox()) return signInSandbox("google@local.test", "Usuario de Google");
    supabase?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  function signInWithApple() {
    if (isSandbox()) return signInSandbox("apple@local.test", "Usuario de Apple");
    supabase?.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: redirectTo() } });
  }

  async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
    if (isSandbox()) {
      signInSandbox(email);
      return { error: null };
    }
    if (!supabase) return unavailable;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? authMessage(error) : null };
  }

  // With "Confirm email" on in Supabase, sign-up returns no session until the link is opened.
  async function signUpWithPassword(name: string, email: string, password: string): Promise<SignUpResult> {
    if (isSandbox()) {
      signInSandbox(email, name);
      return { error: null, needsConfirmation: false };
    }
    if (!supabase) return { ...unavailable, needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: redirectTo() },
    });
    if (error) return { error: authMessage(error), needsConfirmation: false };
    // An already registered address comes back as a user with no identities (no error, to avoid enumeration).
    if (data.user && data.user.identities?.length === 0) {
      return { error: "Ya existe una cuenta con ese correo. Inicia sesión.", needsConfirmation: false };
    }
    return { error: null, needsConfirmation: !data.session };
  }

  async function sendPasswordReset(email: string): Promise<AuthResult> {
    if (isSandbox()) return { error: null };
    if (!supabase) return unavailable;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
    return { error: error ? authMessage(error) : null };
  }

  async function updatePassword(password: string): Promise<AuthResult> {
    if (!supabase) return unavailable;
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error: error ? authMessage(error) : null };
  }

  function signOut() {
    if (isSandbox()) return signOutSandbox();
    supabase?.auth.signOut();
  }

  return {
    user, session, loading, recovering,
    signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword, sendPasswordReset, updatePassword, signOut,
  };
}
