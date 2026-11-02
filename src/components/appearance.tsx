"use client";

import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useId, useLayoutEffect, useSyncExternalStore } from "react";
import {
  type Appearance,
  appearanceKey,
  appearanceScript,
  appearances,
  saveAppearance,
  savedAppearance,
  showAppearance,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

// Told to the picker when its own choice changes; other tabs hear "storage".
const appearanceChanged = "appearancechange";

/**
 * The saved Appearance, put on <html> before first paint by an inline script
 * in <head>. After that it keeps it there: React clears the attribute when it
 * remounts <html> (in development, and in the root error page), and another
 * tab may choose differently.
 */
export function AppearanceScript() {
  useLayoutEffect(() => {
    showAppearance(savedAppearance());
    const fromAnotherTab = (event: StorageEvent) => {
      if (event.key === appearanceKey || event.key === null) showAppearance(savedAppearance());
    };
    addEventListener("storage", fromAnotherTab);
    return () => removeEventListener("storage", fromAnotherTab);
  }, []);

  // A script React renders on the client never runs, and React warns about
  // one, so it only counts as JavaScript in the server's HTML.
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: appearanceScript }}
    />
  );
}

const options: Record<Appearance, { name: string; icon: LucideIcon }> = {
  light: { name: "Light", icon: Sun },
  dark: { name: "Dark", icon: Moon },
  system: { name: "System", icon: Monitor },
};

function subscribe(onChange: () => void) {
  addEventListener("storage", onChange);
  addEventListener(appearanceChanged, onChange);
  return () => {
    removeEventListener("storage", onChange);
    removeEventListener(appearanceChanged, onChange);
  };
}

/**
 * The account menu's Appearance, on this device only: a row named for the
 * setting, with Light, Dark and System as small icons at its end. Choosing
 * one keeps the menu open, to see it change.
 */
export function AppearancePicker() {
  const appearance = useSyncExternalStore(subscribe, savedAppearance, () => "system" as const);
  const label = useId();
  return (
    <div className="flex h-10 items-center gap-3 pr-1 pl-3">
      <span id={label}>Appearance</span>
      <DropdownMenu.RadioGroup
        aria-labelledby={label}
        value={appearance}
        onValueChange={(value) => {
          saveAppearance(value as Appearance);
          dispatchEvent(new Event(appearanceChanged));
        }}
        className="ml-auto flex gap-0.5"
      >
        {appearances.map((option) => {
          const { name, icon: Icon } = options[option];
          const chosen = option === appearance;
          return (
            <DropdownMenu.RadioItem
              key={option}
              value={option}
              aria-label={name}
              title={name}
              onSelect={(event) => event.preventDefault()}
              className={cn(
                "flex size-8 items-center justify-center rounded-md outline-none",
                chosen ? "bg-selected text-ink" : "text-subtle data-highlighted:bg-hover",
              )}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden />
            </DropdownMenu.RadioItem>
          );
        })}
      </DropdownMenu.RadioGroup>
    </div>
  );
}
