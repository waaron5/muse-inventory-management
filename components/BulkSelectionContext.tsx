"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface BulkSelectionContextValue {
  bulkSelectionActive: boolean;
  setBulkSelectionActive: (active: boolean) => void;
}

const BulkSelectionContext = createContext<BulkSelectionContextValue | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [bulkSelectionActive, setBulkSelectionActive] = useState(false);

  const value = useMemo(
    () => ({ bulkSelectionActive, setBulkSelectionActive }),
    [bulkSelectionActive],
  );

  return <BulkSelectionContext.Provider value={value}>{children}</BulkSelectionContext.Provider>;
}

export function useBulkSelectionActive() {
  return useContext(BulkSelectionContext)?.bulkSelectionActive ?? false;
}

export function useSetBulkSelectionActive() {
  return useContext(BulkSelectionContext)?.setBulkSelectionActive ?? (() => {});
}
