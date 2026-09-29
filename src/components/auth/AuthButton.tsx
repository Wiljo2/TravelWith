"use client";
import { useAuth } from "@/hooks/useAuth";
import { Menu } from "@base-ui/react/menu";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signInWithGoogle} className="gap-2 whitespace-nowrap bg-card">
        <GoogleIcon />
        <span className="hidden sm:inline">Iniciar con Google</span>
        <span className="sm:hidden">Entrar</span>
      </Button>
    );
  }

  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const name = (user.user_metadata?.full_name ?? user.email) as string;

  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Tu cuenta" className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {avatar
          ? <img src={avatar} alt={name} width={32} height={32} className="rounded-full border-2 border-card shadow-[0_0_0_1px_var(--border)]" />
          : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{name[0].toUpperCase()}</div>
        }
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className="min-w-52 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 shadow-[0_10px_30px_rgba(0,0,0,.12)] outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-medium">{name}</div>
              {user.email && user.email !== name && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
            </div>
            <Menu.Separator className="mx-1 my-1 h-px bg-border" />
            <Menu.Item
              onClick={signOut}
              className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] outline-none data-highlighted:bg-secondary"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Cerrar sesión
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
