"use client";
import { Button } from "@/components/ui/button";
import EmailAuthForm from "@/components/auth/EmailAuthForm";
import { APPLE_SIGN_IN_ENABLED, type AuthResult, type SignUpResult } from "@/hooks/useAuth";

export interface SignInOptionsProps {
  signInWithGoogle: () => void;
  signInWithApple: () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (name: string, email: string, password: string) => Promise<SignUpResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
}

export default function SignInOptions({
  signInWithGoogle, signInWithApple, signInWithPassword, signUpWithPassword, sendPasswordReset,
}: SignInOptionsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Button variant="outline" size="lg" onClick={signInWithGoogle} className="w-full gap-2.5 bg-secondary text-[15px]">
        <GoogleIcon />
        Continuar con Google
      </Button>
      {APPLE_SIGN_IN_ENABLED && (
        <Button variant="outline" size="lg" onClick={signInWithApple} className="w-full gap-2.5 bg-secondary text-[15px]">
          <AppleIcon />
          Continuar con Apple
        </Button>
      )}

      <div className="my-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        o con tu correo
        <span className="h-px flex-1 bg-border" />
      </div>

      <EmailAuthForm signIn={signInWithPassword} signUp={signUpWithPassword} sendReset={sendPasswordReset} />
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.88 1.15 9.13.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.65zM14.1 5.98c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.79 1.02.08 2.06-.52 2.69-1.27z" />
    </svg>
  );
}
