"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useLayoutEffect,
  type ReactNode,
} from "react";

interface TopBarSetters {
  setTitleSlot: (node: ReactNode) => void;
  setActionsSlot: (node: ReactNode) => void;
}

interface TopBarReaders {
  titleSlot: ReactNode;
  actionsSlot: ReactNode;
}

// Setters never change — subscribing to this context never causes a re-render.
const TopBarSetterContext = createContext<TopBarSetters | null>(null);
// Readers change when slots update — only Navbar subscribes to this.
const TopBarReadContext = createContext<TopBarReaders | null>(null);

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [titleSlot, setTitleSlot] = useState<ReactNode>(null);
  const [actionsSlot, setActionsSlot] = useState<ReactNode>(null);

  // useState setters are stable — this memo object never changes reference.
  const setters = useMemo<TopBarSetters>(
    () => ({ setTitleSlot, setActionsSlot }),

    [],
  );

  const readers = useMemo<TopBarReaders>(
    () => ({ titleSlot, actionsSlot }),
    [titleSlot, actionsSlot],
  );

  return (
    <TopBarSetterContext.Provider value={setters}>
      <TopBarReadContext.Provider value={readers}>{children}</TopBarReadContext.Provider>
    </TopBarSetterContext.Provider>
  );
}

export function useTopBarTitle(): ReactNode {
  return useContext(TopBarReadContext)?.titleSlot ?? null;
}

export function useTopBarActions(): ReactNode {
  return useContext(TopBarReadContext)?.actionsSlot ?? null;
}

/**
 * Call inside a page shell to register title/actions in the topbar.
 * Reads from the stable setter context so slot state changes never cause
 * the calling component to re-render.
 */
export function useSetTopBar(title: ReactNode, actions: ReactNode): void {
  const ctx = useContext(TopBarSetterContext);
  useLayoutEffect(() => {
    ctx?.setTitleSlot(title);
    ctx?.setActionsSlot(actions);
    return () => {
      ctx?.setTitleSlot(null);
      ctx?.setActionsSlot(null);
    };
  }, [ctx, title, actions]);
}
