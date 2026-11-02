"use client";

import { CircleCheck } from "lucide-react";
import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { type Flash, flashCookie } from "@/lib/flash";

/**
 * Snackbars, as in Google's apps: a dark pill rising at the bottom centre for
 * about three seconds. `flash` is the confirmation a Server Action left for
 * this screen (server/flash); it's shown once, then cleared here.
 */
export function Toaster({ flash }: { flash: Flash | null }) {
  useEffect(() => {
    if (!flash) return;
    toast.custom(() => <Snackbar message={flash.message} />, { id: flash.id });
    document.cookie = `${flashCookie}=; Max-Age=0; Path=/; SameSite=Lax`;
  }, [flash]);

  // Sonner places and animates each toast's slot; the pill sits centred in it.
  return (
    <Sonner
      position="bottom-center"
      duration={3000}
      gap={8}
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
      toastOptions={{ unstyled: true, classNames: { toast: "flex w-full justify-center" } }}
    />
  );
}

function Snackbar({ message }: { message: string }) {
  return (
    <div className="flex max-w-full items-center gap-2.5 rounded-full bg-ink py-3 pr-5 pl-4 text-[15px] font-medium text-background shadow-floating">
      <CircleCheck size={18} strokeWidth={2} aria-hidden className="shrink-0" />
      {message}
    </div>
  );
}
