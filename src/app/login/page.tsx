"use client";

import React, { useState } from "react";
import { navigateTo } from "@/lib/navigation";
import { type UserRole } from "@/lib/authorization";
import { postLoginRoute } from "@/lib/login-redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 429) {
        setError("Demasiados intentos. Probá de nuevo en un minuto.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "No se pudo iniciar sesión");
        setLoading(false);
        return;
      }
      navigateTo(
        postLoginRoute(
          new URLSearchParams(window.location.search).get("from"),
          data.role as UserRole
        )
      );
    } catch {
      setError("No se pudo conectar con el servidor");
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-hover px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-[0px_1px_3px_rgba(0,0,0,0.1)]">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold text-ink">ARNOLD</span>
          <span className="text-2xl font-bold text-brand">GYM</span>
        </div>

        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-soft">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={`${input} mb-4`} />

        <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-soft">Contraseña</label>
        <input id="password" type="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={`${input} mb-4`} />

        {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand-strong py-2 font-bold text-surface hover:bg-brand-deep disabled:opacity-60">
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
