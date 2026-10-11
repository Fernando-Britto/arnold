"use client";

import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

export type NotificationKind = "success" | "error" | "info";

interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
}

interface NotificationContextType {
  notify: (kind: NotificationKind, message: string) => void;
  dismiss: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  autoDismissMs?: number;
}

export function NotificationProvider({ children, autoDismissMs = 5000 }: NotificationProviderProps) {
  const [items, setItems] = useState<Notification[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (kind: NotificationKind, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), autoDismissMs);
    },
    [autoDismissMs, dismiss]
  );

  const colors: Record<NotificationKind, string> = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-gray-700",
  };

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((n) => (
          <div
            key={n.id}
            role={n.kind === "error" ? "alert" : "status"}
            className={`flex items-center gap-3 rounded px-4 py-2 text-sm text-white shadow ${colors[n.kind]}`}
          >
            <span>{n.message}</span>
            <button type="button" aria-label="Cerrar notificación" onClick={() => dismiss(n.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
