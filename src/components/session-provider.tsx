"use client";

import { createContext, useContext } from "react";
import type { SessionUser, AppRole } from "@/lib/auth";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}

export function useRole(): AppRole {
  return useContext(SessionContext)?.role ?? "viewer";
}

export function useCanEdit(): boolean {
  const role = useContext(SessionContext)?.role;
  return role === "admin" || role === "editor";
}
