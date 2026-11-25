"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";

export const Drawer = Dialog.Root;
export const DrawerTrigger = Dialog.Trigger;
export const DrawerClose = Dialog.Close;

type DrawerContentProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/*
 * Side sheet on the right, built on Radix Dialog: traps focus, closes on Esc,
 * returns focus to the trigger. Full width on small screens.
 */
export function DrawerContent({ title, description, children, footer, className }: DrawerContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
      <Dialog.Content
        className={cn(
          "motion-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-hairline bg-raised shadow-lifted outline-none",
          className,
        )}
      >
        <header className="flex items-start gap-4 border-b border-hairline px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Dialog.Title className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-14 text-muted tabular">{description}</Dialog.Description>
            ) : null}
          </div>
          <Dialog.Close
            aria-label="Close"
            className="-mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-4 text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-pressed"
          >
            <CloseIcon />
          </Dialog.Close>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">{footer}</footer>
        ) : null}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
