"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { Rol } from "@prisma/client";
import { isAdmin as isAdminUtil, isStaff as isStaffUtil } from "@/middleware/role-gating";
import { navigateTo } from "@/lib/navigation";

export interface SessionUser {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

interface AuthContextType {
  user: SessionUser | null;
  userRole: Rol | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isMember: boolean;
  hasRole: (role: Rol | Rol[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: SessionUser | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const user = initialUser;
  const userRole = user?.rol || null;
  const isAdmin = user ? isAdminUtil(user.rol) : false;
  const isStaff = user ? isStaffUtil(user.rol) : false;
  const isMember = user?.rol === Rol.SOCIO;

  const hasRole = (role: Rol | Rol[]): boolean => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.rol);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // sin red: igual salimos de la pantalla actual
    } finally {
      navigateTo("/login");
    }
  };

  const value: AuthContextType = {
    user,
    userRole,
    isAuthenticated: !!user,
    isAdmin,
    isStaff,
    isMember,
    hasRole,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
