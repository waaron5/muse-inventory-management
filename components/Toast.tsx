"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastOptions {
  duration?: number;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionLoading?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutIdsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: number, duration: number) => {
      const timeoutId = setTimeout(() => {
        dismiss(id);
      }, duration);
      timeoutIdsRef.current.set(id, timeoutId);
    },
    [dismiss],
  );

  const toast = useCallback(
    (message: string, type: ToastType = "success", options?: ToastOptions) => {
      const id = nextId++;
      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          type,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
          actionLoading: false,
        },
      ]);
      scheduleDismiss(id, options?.duration ?? 3500);
    },
    [scheduleDismiss],
  );

  const handleAction = useCallback(
    async (toastItem: Toast) => {
      if (!toastItem.onAction) return;

      const timeoutId = timeoutIdsRef.current.get(toastItem.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutIdsRef.current.delete(toastItem.id);
      }

      setToasts((prev) =>
        prev.map((t) => (t.id === toastItem.id ? { ...t, actionLoading: true } : t)),
      );

      try {
        await toastItem.onAction();
        dismiss(toastItem.id);
      } catch (error) {
        setToasts((prev) =>
          prev.map((t) => (t.id === toastItem.id ? { ...t, actionLoading: false } : t)),
        );
        toast(error instanceof Error ? error.message : "Action failed", "error");
      }
    },
    [dismiss, toast],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <div className="toast-main">
                <span className="toast-icon">
                  {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
                </span>
                <span className="toast-message">{t.message}</span>
              </div>
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => void handleAction(t)}
                  disabled={t.actionLoading}
                >
                  {t.actionLoading ? "Working..." : t.actionLabel}
                </button>
              )}
              <button className="toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
