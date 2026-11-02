"use client";

import { ArrowLeft, X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

/**
 * A layer over the page: a bottom sheet on phone, a centred dialog from 800px.
 * Its content is mounted only while open, so a form inside starts fresh each time.
 * With `onBack`, a back arrow beside the close steps back within the sheet.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  onBack,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-5 overflow-y-auto rounded-t-xl bg-popover p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-floating rail:inset-x-auto rail:top-1/2 rail:bottom-auto rail:left-1/2 rail:w-[480px] rail:-translate-x-1/2 rail:-translate-y-1/2 rail:rounded-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="font-heading text-[20px] leading-7 font-medium">{title}</Dialog.Title>
            <div className="-mr-2 flex shrink-0">
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Back" className="flex size-11 items-center justify-center rounded-md hover:bg-hover">
                  <ArrowLeft className="size-5" />
                </button>
              )}
              <Dialog.Close aria-label="Close" className="flex size-11 items-center justify-center rounded-md hover:bg-hover">
                <X className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
