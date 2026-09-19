"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { Rol, Usuario } from "@prisma/client";
import { isAdmin as isAdminUtil, isStaff as isStaffUtil } from "@/middleware/role-gating";

interface AuthContextType {
  user: (Usuario & { rol: Rol }) | null;
  userRole: Rol | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isMember: boolean;
  hasRole: (role: Rol | Rol[]) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: (Usuario & { rol: Rol }) | null;
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

  const logout = () => {
    // This will be implemented in a future phase with actual session management
    console.log("Logout called");
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
