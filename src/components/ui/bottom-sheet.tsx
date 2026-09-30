"use client";

import * as React from "react";
import { Drawer } from "@base-ui/react/drawer";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  initialFocus?: boolean;
}

// iOS-style sheet: slides up from the bottom, swipe down or tap the backdrop to close.
export function BottomSheet({
  open, onOpenChange, title, children, className, bodyClassName, initialFocus = false,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.3*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:absolute" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup
              initialFocus={initialFocus}
              className={cn(
                "flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-2xl bg-card text-card-foreground shadow-[0_-8px_30px_rgba(0,0,0,.14)] outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
                className,
              )}
            >
              <div className="shrink-0 touch-none select-none px-4 pb-2 pt-2.5">
                <div className="mx-auto h-[5px] w-10 rounded-full bg-border" />
                <div className="mt-1.5 flex min-h-8 items-center justify-between gap-3">
                  <Drawer.Title className="truncate text-[15px] font-semibold">{title}</Drawer.Title>
                  <Drawer.Close
                    aria-label="Cerrar"
                    className="-mr-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
                  >
                    <XIcon className="size-5" />
                  </Drawer.Close>
                </div>
              </div>
              <Drawer.Content
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
                  bodyClassName,
                )}
              >
                {children}
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
