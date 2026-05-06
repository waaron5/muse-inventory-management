"use client";

import { type ReactNode } from "react";
import { useSetTopBar } from "@/components/TopBarContext";

interface TopBarTitleProps {
  title: ReactNode;
  actions?: ReactNode;
}

export function TopBarTitle({ title, actions }: TopBarTitleProps) {
  useSetTopBar(title, actions ?? null);
  return null;
}
